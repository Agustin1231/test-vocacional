# Servicio de IA — Python / LangGraph

Asistente vocacional por agentes, desacoplado del resto del sistema. Responsable
de: acompañar/explicar el resultado del test, resolver dudas de carreras y campos
laborales, y responder con datos verificados de la institución (RAG sobre un
vector store). Consume un LLM en la nube vía **OpenRouter**.

> Carpeta a llenar por IA e integración (Agustín). La estructura interna
> (grafo de agentes, nodos, RAG, memoria) queda a criterio del equipo.

## Contrato

Endpoints expuestos en [`../docs/api-contract.md`](../docs/api-contract.md). El
frontend ya consume `POST /api/ia/chat`
(ver `frontend/src/app/core/services/ai-chat.service.ts`).

**Este servicio no se expone al navegador:** solo el backend (o el reverse proxy)
lo alcanza por red interna.

## Cómo correr en local

_(completar cuando exista el proyecto — típicamente:)_

```bash
cp .env.example .env      # completar con valores locales
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Variables de entorno

Ver [`.env.example`](.env.example). La API key de OpenRouter **nunca** se
commitea ni se expone al frontend.

## Despliegue

Un `Dockerfile` en esta carpeta = un recurso/app en Coolify.
