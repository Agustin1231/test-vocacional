"""API HTTP del servicio de IA (FastAPI).

Expone el endpoint del asesor vocacional. El grafo de LangGraph se compila una
sola vez al arrancar y se reutiliza en cada request.
"""
from fastapi import FastAPI

from .agent.graph import build_graph
from .schemas import ChatRequest, ChatResponse

app = FastAPI(title="Servicio de IA — Asesor Vocacional", version="0.1.0")
_graph = build_graph()


@app.get("/health")
def health() -> dict:
    """Healthcheck para el reverse proxy / docker-compose."""
    return {"status": "ok"}


@app.post("/api/ia/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    """Recibe la conversación + contexto y devuelve la respuesta del asesor."""
    resultado = _graph.invoke(
        {
            "mensajes": [m.model_dump() for m in req.mensajes],
            "contexto": req.contexto.model_dump(),
            "reply": "",
        }
    )
    return ChatResponse(reply=resultado["reply"])
