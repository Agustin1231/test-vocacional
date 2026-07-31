# Servicio de IA — Python / LangGraph

Asistente vocacional por agentes, desacoplado del resto del sistema. Acompaña y
explica el resultado del test y resuelve dudas de carreras y campos laborales.

**El consumidor es el backend .NET, no el navegador.** El frontend nunca llama a
este servicio: le habla al backend (`POST /api/ia/chat`), y el backend reenvía acá
agregando el header `X-API-Key` (ver
[`../docs/adr/0002-backend-como-proxy-de-la-ia.md`](../docs/adr/0002-backend-como-proxy-de-la-ia.md)).
En `infra/docker-compose.yml` este servicio **no publica puertos**: solo se alcanza
por la red interna.

Estado: agente LangGraph con **una herramienta** que el modelo decide cuándo
llamar (`agente ⇄ herramientas`), memoria de conversación en MySQL, instrucciones
editables por API y **RAG sobre los documentos de la institución** en una base
pgvector aparte. El detalle del input/output y del grafo está en
[`DOCUMENTACION.md`](DOCUMENTACION.md); el diseño del RAG y por qué es una
herramienta y no una recuperación fija, en
[`../docs/adr/0004-rag-en-pgvector.md`](../docs/adr/0004-rag-en-pgvector.md).

El RAG es **opcional**: con `VECTOR_STORE_URL` vacía el servicio arranca igual, no
se le ofrece la herramienta al modelo y el asesor funciona como antes. Una base de
documentos caída no puede dejar sin chat al estudiante.

Proveedor del modelo: **Google Gemini** directo (`LLM_PROVIDER=google`, el default)
u **OpenRouter** (`LLM_PROVIDER=openrouter`). Se cambia por variables de entorno,
sin tocar código.

## Contrato

Endpoints expuestos en [`../docs/api-contract.md`](../docs/api-contract.md):

| Endpoint | Quién lo llama | Notas |
|---|---|---|
| `POST /api/ia/chat` | el **backend .NET** | Entrada `{ texto, sesion_id }` (snake_case) + header `X-API-Key`. Respuesta `{ reply }`. |
| `GET /health` | compose / Coolify | Sin auth, no cuenta para el rate limit. |
| `GET` / `PUT /api/ia/instrucciones` | el **backend .NET** (panel, solo administrador) | Administración del system prompt. |
| `GET` / `POST` / `DELETE /api/ia/documentos` | el **backend .NET** (panel, solo administrador) | Documentos del RAG. El `POST` es `multipart/form-data`, campo `archivo`. |
| `GET /api/ia/rag/estado` | **ops** (a mano, con la clave compartida) | Diagnóstico del RAG. El backend **no** expone esta ruta. |

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
sin memoria. `VECTOR_STORE_URL` también: sin ella, responde igual pero sin poder
consultar los documentos.

Dos cuidados con las variables del RAG:

- `RAG_EMBEDDING_DIMS` está en **768** y no en las 3072 del modelo porque los
  índices de pgvector no pasan de 2000 dimensiones.
- Cambiar `RAG_EMBEDDING_MODEL` o `RAG_EMBEDDING_DIMS` sobre una base ya indexada
  deja los vectores viejos incomparables con los nuevos. El servicio **aborta
  ruidosamente** si las dimensiones no coinciden con la tabla, en vez de mezclarlos:
  hay que borrar los documentos del panel y volverlos a subir.

## Despliegue

Un `Dockerfile` en esta carpeta = un recurso/app en Coolify, con healthcheck en
`GET /health`. **No se publica al exterior:** solo el backend lo alcanza.

## Responsable

IA e integración: **Agustín**.
