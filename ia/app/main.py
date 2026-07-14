"""API HTTP del servicio de IA (FastAPI).

Expone el endpoint del asesor vocacional. El grafo de LangGraph se compila una
sola vez al arrancar y se reutiliza en cada request.

La entrada trae `texto` (mensaje) y `sesion_id`. El contexto del estudiante se
arma acá dentro (hoy hardcodeado, ver agent/datos_demo.py). La memoria de la
conversación se lee y se guarda en MySQL por `sesion_id` (ver memory.py).

Seguridad: cada request exige el header `X-API-Key` (ver security.py) y está
limitada por rate limit por IP (slowapi).
"""
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from . import memory
from .agent.datos_demo import CONTEXTO_DEMO
from .agent.graph import build_graph
from .config import settings
from .schemas import ChatRequest, ChatResponse
from .security import verificar_api_key

logger = logging.getLogger("uvicorn.error")

limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Crea la tabla de memoria si no existe. Best-effort: si la DB no está lista,
    # el servicio igual arranca (la memoria degradará a vacío hasta que vuelva).
    try:
        memory.init_db()
    except Exception:
        logger.exception("No se pudo inicializar la memoria en MySQL al arrancar.")
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
