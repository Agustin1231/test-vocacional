# Servicio de IA — Python / LangGraph

Asistente vocacional por agentes, desacoplado del resto del sistema. Responsable
de: acompañar/explicar el resultado del test, resolver dudas de carreras y campos
laborales, y responder con datos verificados de la institución (RAG sobre un
vector store). Consume un LLM en la nube vía **OpenRouter**.

Versión inicial: agente LangGraph **sin herramientas** (input → output). El
detalle del input/output y del grafo está en [`DOCUMENTACION.md`](DOCUMENTACION.md).

## Contrato

Endpoints expuestos en [`../docs/api-contract.md`](../docs/api-contract.md). El
frontend ya consume `POST /api/ia/chat`
(ver `frontend/src/app/core/services/ai-chat.service.ts`).

**Este servicio no se expone al navegador:** solo el backend (o el reverse proxy)
lo alcanza por red interna.

## Cómo correr en local

```bash
cp .env.example .env      # LLM_PROVIDER=google + GOOGLE_API_KEY (o openrouter)
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Variables de entorno

Ver [`.env.example`](.env.example). La API key de OpenRouter **nunca** se
commitea ni se expone al frontend.

## Despliegue

Un `Dockerfile` en esta carpeta = un recurso/app en Coolify.
