"""API HTTP del servicio de IA (FastAPI).

Expone el endpoint del asesor vocacional y los endpoints para administrar las
instrucciones del agente. El grafo de LangGraph se compila una sola vez al
arrancar y se reutiliza en cada request.

La entrada del chat trae `texto` (mensaje), `sesion_id` y, opcionalmente, el
`contexto` del estudiante (nombre, perfil, área, carrera) que manda el backend a
partir del informe. Si no llega contexto, el agente responde en modo genérico:
NUNCA se inyectan datos de ejemplo, porque un nombre y una carrera inventados le
hablan al estudiante equivocado sin que nada falle.

La memoria de la conversación se lee/guarda en MySQL por `sesion_id` (memory.py),
y las instrucciones del agente viven en MySQL y se editan por API
(instructions.py).

Seguridad: TODOS los endpoints (excepto /health) exigen el header `X-API-Key`
(ver security.py). El chat además está limitado por rate limit por estudiante:
la clave es la cabecera `X-Cliente-IP` que envía el backend con la IP real (sin
ella, el único cliente TCP es el backend y el límite sería global para todos).
"""
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile, status
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from . import db, instructions, memory
from .agent.graph import build_graph
from .config import settings
from .rag import pdf as rag_pdf
from .rag import store as rag_store
from .schemas import (
    ChatRequest,
    ChatResponse,
    DocumentoResponse,
    InstruccionRequest,
    InstruccionResponse,
    RagEstadoResponse,
)
from .security import verificar_api_key

logger = logging.getLogger("uvicorn.error")

# Cabecera con la IP real del estudiante que agrega el backend (IaService).
CABECERA_IP_CLIENTE = "X-Cliente-IP"


def _clave_rate_limit(request: Request) -> str:
    """Clave de partición del rate limit: la IP del estudiante, no la del backend.

    El único cliente TCP de este servicio es el contenedor del backend, así que
    `get_remote_address` metería a todos los estudiantes en la misma cubeta.
    """
    ip = (request.headers.get(CABECERA_IP_CLIENTE) or "").strip()
    return ip or get_remote_address(request)


limiter = Limiter(key_func=_clave_rate_limit)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Crea las tablas (memoria + instrucciones) y siembra el prompt por defecto.
    # Best-effort: si la DB no está lista, el servicio igual arranca.
    try:
        db.init_db()
        instructions.sembrar_por_defecto()
    except Exception:
        logger.exception("No se pudo inicializar la DB al arrancar.")
        # Bien visible: el chat va a responder, pero sin recordar nada de los
        # turnos anteriores y sin poder guardar las instrucciones.
        logger.warning(
            "MEMORIA DE CONVERSACIÓN DESACTIVADA: no se pudo preparar MySQL. "
            "Revisá DB_HOST/DB_USER/DB_PASSWORD. El asesor va a responder sin historial."
        )

    # Base de documentos (RAG). También best-effort y por la misma razón: sin
    # esto el agente responde igual, solo que sin poder consultar el plan de
    # estudios. Lo que NO puede pasar es que el chat quede caído por la base
    # de documentos.
    try:
        rag_store.init_store()
    except Exception:
        logger.exception("No se pudo inicializar la base de documentos (RAG).")
        logger.warning(
            "RAG DESACTIVADO: la herramienta de búsqueda en el plan de estudios no "
            "se le va a ofrecer al modelo. Revisá VECTOR_STORE_URL."
        )
    yield


app = FastAPI(title="Servicio de IA — Asesor Vocacional", version="0.1.0", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

_graph = build_graph()


@app.get("/health")
def health() -> dict:
    """Healthcheck para el reverse proxy / docker-compose (sin auth)."""
    return {"status": "ok"}


@app.post("/api/ia/chat", response_model=ChatResponse, dependencies=[Depends(verificar_api_key)])
@limiter.limit(settings.rate_limit)
def chat(request: Request, body: ChatRequest) -> ChatResponse:
    """Recibe el mensaje del estudiante y devuelve la respuesta del asesor.

    Flujo: carga la memoria de la sesión desde MySQL, agrega el turno del
    estudiante, invoca al agente con el contexto que vino en la petición (o
    ninguno), y persiste tanto la pregunta como la respuesta.
    """
    historial = memory.cargar_memoria(body.sesion_id)
    mensajes = historial + [{"rol": "user", "texto": body.texto}]

    # Solo los campos con valor: el prompt no menciona lo que no sabe.
    contexto = (
        {k: v for k, v in body.contexto.model_dump().items() if v}
        if body.contexto
        else {}
    )

    resultado = _graph.invoke(
        {
            "mensajes": mensajes,
            "contexto": contexto,
            "reply": "",
        }
    )
    reply = resultado["reply"]

    memory.guardar_turno(body.sesion_id, "user", body.texto)
    memory.guardar_turno(body.sesion_id, "assistant", reply)

    return ChatResponse(reply=reply)


@app.get(
    "/api/ia/instrucciones",
    response_model=InstruccionResponse,
    dependencies=[Depends(verificar_api_key)],
)
def get_instrucciones() -> InstruccionResponse:
    """Devuelve las instrucciones (system prompt) actuales del agente."""
    try:
        inst = instructions.obtener_instruccion()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No se pudo leer la base de datos.",
        )
    if not inst:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No hay instrucciones cargadas.",
        )
    return InstruccionResponse(**inst)


@app.put(
    "/api/ia/instrucciones",
    response_model=InstruccionResponse,
    dependencies=[Depends(verificar_api_key)],
)
def put_instrucciones(body: InstruccionRequest) -> InstruccionResponse:
    """Crea o actualiza las instrucciones del agente. Aplican en el próximo chat."""
    try:
        inst = instructions.guardar_instruccion(body.contenido)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No se pudo escribir en la base de datos.",
        )
    return InstruccionResponse(**inst)


# --------------------------------------------------------------------------- #
# Documentos del RAG (plan de estudios)
#
# El agente los consulta con la herramienta `buscar_plan_estudios`; estos
# endpoints son para administrarlos. Como todo acá, exigen X-API-Key: quien los
# expone al navegador es el backend .NET, que además pide rol de administrador
# (ver docs/adr/0002 y docs/adr/0004).
# --------------------------------------------------------------------------- #


def _exigir_rag() -> None:
    """503 si el RAG no está configurado. Mensaje que dice qué falta."""
    if not rag_store.disponible():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "La base de documentos no está configurada: falta VECTOR_STORE_URL "
                "en el servicio de IA."
            ),
        )


@app.get(
    "/api/ia/rag/estado",
    response_model=RagEstadoResponse,
    dependencies=[Depends(verificar_api_key)],
)
def get_rag_estado() -> RagEstadoResponse:
    """Diagnóstico: si el RAG está configurado, si responde y qué hay indexado."""
    return RagEstadoResponse(**rag_store.estado())


@app.get(
    "/api/ia/documentos",
    response_model=list[DocumentoResponse],
    dependencies=[Depends(verificar_api_key)],
)
def get_documentos() -> list[DocumentoResponse]:
    """Documentos indexados, del más nuevo al más viejo."""
    _exigir_rag()
    try:
        return [DocumentoResponse(**d) for d in rag_store.listar_documentos()]
    except Exception:
        logger.exception("RAG: no se pudo listar los documentos.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No se pudo leer la base de documentos.",
        )


@app.post(
    "/api/ia/documentos",
    response_model=DocumentoResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verificar_api_key)],
)
async def post_documento(archivo: UploadFile = File(...)) -> DocumentoResponse:
    """Sube un PDF, lo trocea, lo embebe y lo deja consultable por el agente.

    Es la operación lenta del servicio: una llamada de embeddings por cada lote de
    fragmentos. Un plan de estudios de decenas de páginas puede tardar varios
    segundos, así que quien lo llame necesita un timeout holgado.
    """
    _exigir_rag()

    nombre = (archivo.filename or "").strip()
    if not nombre:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El archivo llegó sin nombre.",
        )

    contenido = await archivo.read()

    maximo = settings.rag_max_pdf_mb * 1024 * 1024
    if len(contenido) > maximo:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"El PDF pesa más de {settings.rag_max_pdf_mb} MB.",
        )
    if not contenido:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="El archivo está vacío."
        )

    # Se valida la firma del archivo y no el Content-Type ni la extensión: los dos
    # los pone el cliente y se equivocan (o mienten) con facilidad.
    if not contenido.startswith(b"%PDF"):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="El archivo no es un PDF (no empieza con %PDF).",
        )

    try:
        return DocumentoResponse(**rag_store.guardar_documento(nombre, contenido))
    except rag_store.DocumentoDuplicado as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error))
    except rag_pdf.PdfSinTexto as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        )
    except Exception:
        logger.exception("RAG: falló la indexación de '%s'.", nombre)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No se pudo indexar el documento.",
        )


@app.delete(
    "/api/ia/documentos/{documento_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(verificar_api_key)],
)
def delete_documento(documento_id: int) -> None:
    """Borra un documento y todos sus fragmentos."""
    _exigir_rag()
    try:
        nombre = rag_store.borrar_documento(documento_id)
    except Exception:
        logger.exception("RAG: falló el borrado del documento %s.", documento_id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No se pudo borrar el documento.",
        )
    if nombre is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="El documento no existe."
        )
