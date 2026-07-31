"""Herramientas que el modelo puede decidir llamar.

Hoy hay una sola: la búsqueda en los documentos de la institución (RAG). El
modelo decide si la usa a partir de la descripción de abajo, que es lo único que
ve de ella, así que ese texto es parte del comportamiento del agente y no un
comentario: si dice de menos, el modelo contesta de memoria sobre el plan de
estudios; si dice de más, la llama para saludar.

Cuando el RAG no está configurado, `disponibles()` devuelve una lista vacía y el
grafo no le ofrece ninguna herramienta al modelo (ver `graph.py`). Es la razón por
la que el chat sigue funcionando igual con la base de documentos caída.
"""
import logging

from langchain_core.tools import tool

from ..config import settings
from ..rag import store

logger = logging.getLogger("uvicorn.error")

# Tope de caracteres del texto que se le devuelve al modelo. Con top_k fragmentos
# de ~1200 caracteres el total ya es del orden de un prompt largo; sin tope, un
# documento con fragmentos gigantes empujaría fuera la conversación.
MAX_CARACTERES_RESPUESTA = 8000


@tool
def buscar_documentos_oficiales(consulta: str) -> str:
    """Busca en los documentos oficiales de UNIAGRARIA (plan de estudios y
    reglamentos de los programas de pregrado).

    Usala para CUALQUIER dato concreto y verificable sobre la institución o sus
    programas, del tipo que estaría escrito en un documento oficial. Por ejemplo, y
    sin que la lista sea limitativa: materias y en qué semestre se cursan, créditos,
    duración, perfil de egreso, facultad, requisitos de admisión, costos de
    matrícula, becas y descuentos, homologaciones y transferencias, prácticas
    obligatorias, títulos que otorga, modalidad y jornada.

    **Ante la duda, llamala.** Es mejor buscar y no encontrar nada que contestar de
    memoria: los datos de la institución cambian y responder uno viejo o inventado
    le hace tomar una decisión equivocada al estudiante.

    Lo único para lo que NO sirve es lo que no es un dato de la institución:
    conversar, contener a alguien indeciso, o interpretar el resultado del test
    vocacional. Eso se responde sin herramienta.

    La consulta va en lenguaje natural y describe el dato buscado (por ejemplo
    "costo del semestre de Derecho" o "materias de primer semestre de Derecho"), no
    una palabra sola.

    Devuelve los fragmentos textuales encontrados, cada uno con el documento y la
    página de donde sale. Si no devuelve nada, significa que el dato NO está en los
    documentos: en ese caso decile al estudiante que no lo tenés y sugerile
    consultarlo con la universidad. Nunca completes con datos que no aparezcan acá.
    """
    consulta = (consulta or "").strip()
    if not consulta:
        return "No se recibió una consulta para buscar."

    try:
        resultados = store.buscar(consulta)
    except store.RagNoConfigurado:
        # No debería pasar: si el RAG no está configurado, la herramienta no se
        # le ofrece al modelo. Se cubre igual para no romper la conversación.
        logger.warning("RAG: se llamó a la herramienta con el RAG sin configurar.")
        return "La base de documentos no está disponible en este momento."
    except Exception as error:
        logger.warning("RAG: falló la búsqueda (%s).", type(error).__name__)
        return (
            "No se pudo consultar la base de documentos en este momento. "
            "No inventes el dato: decile al estudiante que no podés verificarlo ahora."
        )

    if not resultados:
        return (
            f"No se encontró nada sobre '{consulta}' en los documentos de la institución. "
            "El dato NO está disponible: no lo completes por tu cuenta."
        )

    partes = []
    total = 0
    for numero, r in enumerate(resultados, start=1):
        bloque = (
            f"[{numero}] {r['documento']}, página {r['pagina']} "
            f"(similitud {r['similitud']}):\n{r['texto']}"
        )
        if total + len(bloque) > MAX_CARACTERES_RESPUESTA:
            break
        partes.append(bloque)
        total += len(bloque)

    # El resultado de la búsqueda ya lo loguea `store.buscar` (siempre, con la mejor
    # similitud). Acá solo se avisa lo que esa línea no puede saber: que se
    # descartaron fragmentos relevantes por el tope de caracteres. Si aparece
    # seguido, conviene bajar RAG_TOP_K o RAG_CHUNK_CHARS en vez de subir el tope.
    if len(partes) < len(resultados):
        logger.warning(
            "RAG: se recortaron %s de %s fragmentos por el tope de %s caracteres.",
            len(resultados) - len(partes),
            len(resultados),
            MAX_CARACTERES_RESPUESTA,
        )

    return (
        "Fragmentos encontrados en los documentos de la institución. Respondé solo "
        "con lo que digan, y mencioná el documento y la página.\n\n"
        + "\n\n".join(partes)
    )


def disponibles() -> list:
    """Herramientas que se le ofrecen al modelo en esta configuración."""
    if not store.disponible():
        return []
    return [buscar_documentos_oficiales]


def por_nombre() -> dict:
    """Índice nombre -> herramienta, para ejecutar lo que pida el modelo."""
    return {h.name: h for h in disponibles()}
