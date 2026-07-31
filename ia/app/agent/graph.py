"""Grafo del agente vocacional (LangGraph).

    START ──► agente ──┬──(el modelo no pidió nada)────────────────► END
                       ├──(pidió herramientas)──► herramientas ──┘ (vuelve a agente)
                       └──(se agotaron las vueltas)──► respuesta_final ──► END

`agente` llama al modelo con las herramientas ofrecidas; si el modelo decide usar
una, `herramientas` la ejecuta y el control vuelve a `agente` con el resultado
adentro de la conversación. El contrato HTTP no cambia: entra `mensajes` +
`contexto`, sale `reply`.

Dos decisiones que importan:

- **Las herramientas se ofrecen solo si están disponibles.** Sin RAG configurado,
  `tools.disponibles()` devuelve vacío, no se hace `bind_tools` y el grafo se
  comporta igual que su versión de un solo nodo. Una base de documentos caída no
  puede dejar sin chat al estudiante.
- **El ciclo está acotado por `MAX_VUELTAS_HERRAMIENTAS`.** Un modelo que insiste
  en buscar giraría indefinidamente, y cada vuelta es una llamada paga. Al
  agotarse, `respuesta_final` lo obliga a contestar con lo que ya tiene.
"""
import logging

from langchain_core.messages import (
    AIMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langgraph.graph import END, START, StateGraph

from . import tools
from .. import instructions
from ..llm import get_llm
from .state import AgentState

logger = logging.getLogger("uvicorn.error")

# Con una sola herramienta, una vuelta alcanza (buscar y responder). Se deja en 2
# para que el modelo pueda reformular la consulta si la primera no trajo nada.
MAX_VUELTAS_HERRAMIENTAS = 2

# Última red de contención: si el modelo termina sin texto, el backend recibiría
# un `reply` vacío y le mostraría al estudiante "el asesor no está disponible".
RESPUESTA_VACIA = (
    "Perdón, no pude armar la respuesta. ¿Podés reformular la pregunta?"
)

# Política de uso de las herramientas. Se agrega al system prompt SOLO cuando hay
# herramientas disponibles, y la pone el código en lugar de dejarla en el prompt
# editable del panel, por una razón concreta que se descubrió probando:
#
# El prompt que administra el equipo dice "no inventes datos de costos, becas ni
# convenios: si no los tienes, invita a consultar la página". Con el RAG activo,
# el modelo leía "no los tienes" como un hecho y contestaba que no sabía, sin
# llegar a buscar en los documentos donde el dato sí estaba. Ese texto se escribió
# cuando el RAG no existía y es razonable que siga ahí.
#
# Dejar esta política en el código evita que el agente pierda una capacidad por
# cómo quedó redactado el prompt, y no contradice sus límites: "no inventes" sigue
# valiendo, esto define cuándo se considera que el dato *se tiene*.
POLITICA_HERRAMIENTAS = (
    "REGLA DE CONSULTA DE DOCUMENTOS (tiene prioridad sobre cualquier indicación "
    "anterior acerca de qué datos tenés o no tenés):\n"
    "Tenés acceso a los documentos oficiales de la institución (plan de estudios y "
    "reglamentos) mediante la herramienta buscar_documentos_oficiales. Esos documentos SÍ "
    "contienen datos administrativos: costos de matrícula, becas y descuentos, "
    "requisitos de admisión, homologaciones y transferencias, prácticas, materias, "
    "créditos y duración.\n"
    "Por lo tanto:\n"
    "1. Si te preguntan cualquier dato de la institución o de sus programas, llamá "
    "primero a buscar_documentos_oficiales. No respondas de memoria y no supongas que no "
    "tenés el dato.\n"
    "2. Si una indicación anterior te dice que invites a consultar la página web o a "
    "un asesor humano cuando no tengas un dato (de costos, becas, convenios o "
    "cualquier otro), eso aplica RECIÉN DESPUÉS de haber buscado y no haber "
    "encontrado nada.\n"
    "3. Si la herramienta devuelve el dato, respondelo citando el documento y la "
    "página. Si devuelve vacío, decí que no lo tenés e invitá a consultar con la "
    "universidad.\n"
    "4. Nunca completes con datos que la herramienta no haya devuelto: la regla de "
    "no inventar sigue en pie."
)


def _system_prompt(contexto: dict, con_herramientas: bool) -> str:
    """Arma el mensaje de sistema, personalizado con el contexto si viene.

    El texto base se lee de la DB (editable por API); si no está disponible, cae
    al valor por defecto. Sobre eso se suman los datos del estudiante y, si hay
    herramientas, la política de uso.

    El orden no es casual y se ajustó a partir de las pruebas: la política va
    ÚLTIMA, después del prompt editable y del contexto. Puesta en el medio no
    alcanzaba para vencer a las instrucciones específicas del prompt del panel
    ("no des datos de costos ni becas, redirigí a la web"), que por nombrar temas
    concretos le ganaban a una regla general. Ver POLITICA_HERRAMIENTAS.
    """
    base = instructions.obtener_base_segura()
    detalles = []
    if contexto.get("nombre"):
        detalles.append(f"El estudiante se llama {contexto['nombre']}.")
    if contexto.get("perfil"):
        detalles.append(f"Su perfil vocacional es: {contexto['perfil']}.")
    if contexto.get("area"):
        detalles.append(f"Área de afinidad: {contexto['area']}.")
    if contexto.get("carrera"):
        detalles.append(f"Programa sugerido: {contexto['carrera']}.")

    prompt = base + (" " + " ".join(detalles) if detalles else "")
    if con_herramientas:
        prompt = f"{prompt}\n\n{POLITICA_HERRAMIENTAS}"
    return prompt


def _to_text(content) -> str:
    """Extrae el texto de la respuesta del modelo.

    Según el modelo, `content` puede ser un string plano o una lista de bloques
    (p. ej. [{"type": "text", "text": "..."}]). Normalizamos a string.
    """
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        partes = [
            b.get("text", "") if isinstance(b, dict) else str(b)
            for b in content
            if not (isinstance(b, dict) and b.get("type") not in (None, "text"))
        ]
        return "".join(partes).strip()
    return str(content).strip()


def _conversacion_inicial(state: AgentState, con_herramientas: bool) -> list:
    """System prompt + historial de la sesión, en mensajes de langchain."""
    mensajes = [
        SystemMessage(content=_system_prompt(state.get("contexto", {}), con_herramientas))
    ]
    for m in state.get("mensajes", []):
        if m.get("rol") == "assistant":
            mensajes.append(AIMessage(content=m.get("texto", "")))
        else:
            mensajes.append(HumanMessage(content=m.get("texto", "")))
    return mensajes


def _agente_node(state: AgentState) -> dict:
    """Llama al modelo. Puede devolver texto o pedidos de herramienta."""
    llm = get_llm()
    herramientas = tools.disponibles()
    if herramientas:
        llm = llm.bind_tools(herramientas)

    conversacion = list(
        state.get("conversacion") or _conversacion_inicial(state, bool(herramientas))
    )
    respuesta = llm.invoke(conversacion)
    conversacion.append(respuesta)

    return {"conversacion": conversacion, "reply": _to_text(respuesta.content)}


def _herramientas_node(state: AgentState) -> dict:
    """Ejecuta lo que pidió el modelo y mete los resultados en la conversación."""
    conversacion = list(state["conversacion"])
    ultimo = conversacion[-1]
    catalogo = tools.por_nombre()

    for llamada in getattr(ultimo, "tool_calls", []) or []:
        herramienta = catalogo.get(llamada["name"])
        if herramienta is None:
            # El modelo se inventó un nombre. Se le contesta con el error en vez
            # de cortar la conversación: normalmente reintenta bien.
            logger.warning("El modelo pidió una herramienta inexistente: %s", llamada["name"])
            resultado = f"No existe la herramienta '{llamada['name']}'."
        else:
            try:
                resultado = herramienta.invoke(llamada.get("args", {}))
            except Exception as error:
                logger.warning(
                    "Falló la herramienta %s (%s).", llamada["name"], type(error).__name__
                )
                resultado = "La herramienta falló. No inventes el dato."

        conversacion.append(
            ToolMessage(content=str(resultado), tool_call_id=llamada["id"])
        )

    return {
        "conversacion": conversacion,
        "vueltas_herramientas": state.get("vueltas_herramientas", 0) + 1,
    }


def _respuesta_final_node(state: AgentState) -> dict:
    """Fuerza una respuesta en texto: se llama al modelo SIN herramientas.

    Solo se llega acá si el modelo agotó las vueltas permitidas y seguía pidiendo
    buscar. Sin herramientas que ofrecer, no le queda otra que contestar con lo
    que ya tiene en la conversación.
    """
    logger.info("Se agotaron las vueltas de herramientas: se fuerza la respuesta final.")
    respuesta = get_llm().invoke(state["conversacion"])
    return {"reply": _to_text(respuesta.content) or RESPUESTA_VACIA}


def _decidir(state: AgentState) -> str:
    """Ruteo después de `agente`."""
    ultimo = state["conversacion"][-1]
    pidio_herramientas = bool(getattr(ultimo, "tool_calls", None))

    if not pidio_herramientas:
        return END
    if state.get("vueltas_herramientas", 0) >= MAX_VUELTAS_HERRAMIENTAS:
        return "respuesta_final"
    return "herramientas"


def build_graph():
    """Compila y devuelve el grafo. Se construye una vez al arrancar la app."""
    grafo = StateGraph(AgentState)
    grafo.add_node("agente", _agente_node)
    grafo.add_node("herramientas", _herramientas_node)
    grafo.add_node("respuesta_final", _respuesta_final_node)

    grafo.add_edge(START, "agente")
    grafo.add_conditional_edges(
        "agente",
        _decidir,
        {"herramientas": "herramientas", "respuesta_final": "respuesta_final", END: END},
    )
    grafo.add_edge("herramientas", "agente")
    grafo.add_edge("respuesta_final", END)
    return grafo.compile()
