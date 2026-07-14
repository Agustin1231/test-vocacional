"""Grafo del agente vocacional (LangGraph).

Versión inicial SIN herramientas: un único nodo que recibe la conversación,
llama al modelo y devuelve la respuesta.

    START ──► agente ──► END

Escalar el asistente = agregar nodos y aristas a este grafo (p. ej. un nodo de
RAG antes de `agente`, o ramificación condicional), sin cambiar el contrato
HTTP de entrada/salida.
"""
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph

from ..llm import get_llm
from .state import AgentState


def _system_prompt(contexto: dict) -> str:
    """Arma el mensaje de sistema, personalizado con el contexto si viene."""
    base = (
        "Sos un asesor vocacional de UNIAGRARIA. Acompañás a estudiantes de "
        "secundaria a entender su resultado del test vocacional y a explorar "
        "programas académicos. Respondés en español, claro y cálido, sin inventar "
        "datos de la institución."
    )
    detalles = []
    if contexto.get("nombre"):
        detalles.append(f"El estudiante se llama {contexto['nombre']}.")
    if contexto.get("perfil"):
        detalles.append(f"Su perfil vocacional es: {contexto['perfil']}.")
    if contexto.get("area"):
        detalles.append(f"Área de afinidad: {contexto['area']}.")
    if contexto.get("carrera"):
        detalles.append(f"Programa sugerido: {contexto['carrera']}.")
    return base + (" " + " ".join(detalles) if detalles else "")


def _agente_node(state: AgentState) -> dict:
    """Único nodo del grafo: conversación -> respuesta del modelo."""
    llm = get_llm()

    mensajes = [SystemMessage(content=_system_prompt(state.get("contexto", {})))]
    for m in state.get("mensajes", []):
        if m.get("rol") == "assistant":
            mensajes.append(AIMessage(content=m.get("texto", "")))
        else:
            mensajes.append(HumanMessage(content=m.get("texto", "")))

    respuesta = llm.invoke(mensajes)
    return {"reply": respuesta.content}


def build_graph():
    """Compila y devuelve el grafo. Se construye una vez al arrancar la app."""
    grafo = StateGraph(AgentState)
    grafo.add_node("agente", _agente_node)
    grafo.add_edge(START, "agente")
    grafo.add_edge("agente", END)
    return grafo.compile()
