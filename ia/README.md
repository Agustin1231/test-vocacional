# Servicio de IA — Python / LangGraph

Asistente vocacional por agentes, desacoplado del resto del sistema. Acompaña y
explica el resultado del test y resuelve dudas de carreras y campos laborales.

**El consumidor es el backend .NET, no el navegador.** El frontend nunca llama a
este servicio: le habla al backend (`POST /api/ia/chat`), y el backend reenvía acá
agregando el header `X-API-Key` (ver
[`../docs/adr/0002-backend-como-proxy-de-la-ia.md`](../docs/adr/0002-backend-como-proxy-de-la-ia.md)).
En `infra/docker-compose.yml` este servicio **no publica puertos**: solo se alcanza
por la red interna.

Estado: agente LangGraph de **un solo nodo, sin herramientas** (input → output),
con memoria de conversación en MySQL e instrucciones editables por API. El RAG
sobre datos de la institución (vector store) **todavía no está implementado**. El
detalle del input/output y del grafo está en [`DOCUMENTACION.md`](DOCUMENTACION.md).

Proveedor del modelo: **Google Gemini** directo (`LLM_PROVIDER=google`, el default)
u **OpenRouter** (`LLM_PROVIDER=openrouter`). Se cambia por variables de entorno,
sin tocar código.

## Contrato

Endpoints expuestos en [`../docs/api-contract.md`](../docs/api-contract.md):

| Endpoint | Quién lo llama | Notas |
|---|---|---|
| `POST /api/ia/chat` | el **backend .NET** | Entrada `{ texto, sesion_id }` (snake_case) + header `X-API-Key`. Respuesta `{ reply }`. |
| `GET /health` | compose / Coolify | Sin auth, no cuenta para el rate limit. |
| `GET` / `PUT /api/ia/instrucciones` | **ops** (a mano, con la clave compartida) | Administración del system prompt. El backend **no** expone estas rutas. |

`X-API-Key` es la variable `SERVICE_API_KEY` de este servicio, y tiene que ser la
misma que `IA_API_KEY` del backend. Es *fail-closed*: sin clave configurada, el
servicio rechaza todo.

## Cómo correr en local

```bash
cp .env.example .env      # LLM_PROVIDER=google + GOOGLE_API_KEY (o openrouter)
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Con Docker, la forma normal es levantarlo junto al resto desde la raíz del repo
(`infra/docker-compose.yml` es la única orquestación):

```bash
docker compose -f infra/docker-compose.yml up --build
```

## Variables de entorno

Ver [`.env.example`](.env.example). La API key del modelo **nunca** se commitea ni
se expone al frontend. `DB_*` es opcional: sin base, el agente responde igual pero
sin memoria.

## Despliegue

Un `Dockerfile` en esta carpeta = un recurso/app en Coolify, con healthcheck en
`GET /health`. **No se publica al exterior:** solo el backend lo alcanza.

## Responsable

IA e integración: **Agustín**.
