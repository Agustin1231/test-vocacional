"""Embeddings para el RAG, con la misma API key de Google que usa el chat.

Se usan dos clientes y no uno: Google pide declarar para qué es el embedding
(`task_type`). Un texto indexado como `RETRIEVAL_DOCUMENT` y una pregunta
embebida como `RETRIEVAL_QUERY` caen en el mismo espacio pero optimizado para
compararse entre sí; usar el mismo tipo para los dos lados empeora el ranking.

Cambiar de modelo de embeddings es cambiar `RAG_EMBEDDING_MODEL`, igual que el
resto del servicio. Pero cambiarlo sobre una base ya indexada deja los vectores
viejos incomparables con los nuevos: hay que borrar los documentos y volverlos a
subir (ver `store.py`, que aborta si cambian las dimensiones).
"""
import logging

from ..config import settings

logger = logging.getLogger("uvicorn.error")

# Google acepta varios textos por llamada, pero no ilimitados. 50 es conservador
# y mantiene cada request lejos del tope de tokens del lote.
TAMANO_LOTE = 50

_documentos = None
_consultas = None


def _cliente(task_type: str):
    from langchain_google_genai import GoogleGenerativeAIEmbeddings

    return GoogleGenerativeAIEmbeddings(
        model=settings.rag_embedding_model,
        google_api_key=settings.google_api_key,
        task_type=task_type,
        # Ver config.rag_embedding_dims: 768 y no el default del modelo (3072)
        # porque pgvector no indexa por encima de 2000 dimensiones.
        output_dimensionality=settings.rag_embedding_dims,
    )


def _para_documentos():
    global _documentos
    if _documentos is None:
        _documentos = _cliente("RETRIEVAL_DOCUMENT")
    return _documentos


def _para_consultas():
    global _consultas
    if _consultas is None:
        _consultas = _cliente("RETRIEVAL_QUERY")
    return _consultas


def embeber_documentos(textos: list[str]) -> list[list[float]]:
    """Vectores de los fragmentos a indexar, en el mismo orden que entraron."""
    if not textos:
        return []

    cliente = _para_documentos()
    vectores: list[list[float]] = []
    for inicio in range(0, len(textos), TAMANO_LOTE):
        lote = textos[inicio:inicio + TAMANO_LOTE]
        vectores.extend(cliente.embed_documents(lote))
        logger.info("RAG: embebidos %s/%s fragmentos.", len(vectores), len(textos))

    if len(vectores) != len(textos):
        raise RuntimeError(
            f"El proveedor devolvió {len(vectores)} vectores para {len(textos)} fragmentos."
        )
    return vectores


def embeber_consulta(texto: str) -> list[float]:
    """Vector de la pregunta del estudiante."""
    return _para_consultas().embed_query(texto)
