"""API HTTP del servicio de IA (FastAPI).

Expone el endpoint del asesor vocacional. El grafo de LangGraph se compila una
sola vez al arrancar y se reutiliza en cada request.

La entrada es solo `texto`. El contexto del estudiante y la memoria de la
conversación se arman acá dentro (hoy hardcodeados, ver agent/datos_demo.py;
más adelante vendrán de la base de datos vía el backend).

Seguridad: cada request exige el header `X-API-Key` (ver security.py) y está
limitada por rate limit por IP (slowapi).
"""
from fastapi import Depends, FastAPI, Request
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from .agent.datos_demo import CONTEXTO_DEMO, MEMORIA_DEMO
from .agent.graph import build_graph
from .config import settings
from .schemas import ChatRequest, ChatResponse
from .security import verificar_api_key

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Servicio de IA — Asesor Vocacional", version="0.1.0")
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

    El contexto y la memoria se arman internamente (hoy hardcodeados).
    """
    mensajes = MEMORIA_DEMO + [{"rol": "user", "texto": body.texto}]

    resultado = _graph.invoke(
        {
            "mensajes": mensajes,
            "contexto": CONTEXTO_DEMO,
            "reply": "",
        }
    )
    return ChatResponse(reply=resultado["reply"])
