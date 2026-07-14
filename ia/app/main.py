"""API HTTP del servicio de IA (FastAPI).

Expone el endpoint del asesor vocacional y los endpoints para administrar las
instrucciones del agente. El grafo de LangGraph se compila una sola vez al
arrancar y se reutiliza en cada request.

La entrada del chat trae `texto` (mensaje) y `sesion_id`. El contexto del
estudiante se arma acá dentro (hoy hardcodeado, ver agent/datos_demo.py). La
memoria de la conversación se lee/guarda en MySQL por `sesion_id` (memory.py), y
las instrucciones del agente viven en MySQL y se editan por API (instructions.py).

Seguridad: TODOS los endpoints (excepto /health) exigen el header `X-API-Key`
(ver security.py). El chat además está limitado por rate limit por IP (slowapi).
"""
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request, status
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from . import db, instructions, memory
from .agent.datos_demo import CONTEXTO_DEMO
from .agent.graph import build_graph
from .config import settings
from .schemas import (
    ChatRequest,
    ChatResponse,
    InstruccionRequest,
    InstruccionResponse,
)
from .security import verificar_api_key

logger = logging.getLogger("uvicorn.error")

limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Crea las tablas (memoria + instrucciones) y siembra el prompt por defecto.
    # Best-effort: si la DB no está lista, el servicio igual arranca.
    try:
        db.init_db()
        instructions.sembrar_por_defecto()
    except Exception:
        logger.exception("No se pudo inicializar la DB al arrancar.")
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
    estudiante, invoca al agente, y persiste tanto la pregunta como la respuesta.
    """
    historial = memory.cargar_memoria(body.sesion_id)
    mensajes = historial + [{"rol": "user", "texto": body.texto}]

    resultado = _graph.invoke(
        {
            "mensajes": mensajes,
            "contexto": CONTEXTO_DEMO,
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
