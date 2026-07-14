# Servicio de IA — Agente vocacional (LangGraph)

Documento del **input y output** del agente y de cómo está armado por dentro.

## Qué es

Un asistente conversacional construido con **LangGraph**. Esta primera versión
**no tiene herramientas**: recibe una conversación (input), llama al modelo de
lenguaje y devuelve una respuesta (output). La infraestructura ya queda lista
para agregar nodos (RAG, ramificación, herramientas) sin cambiar el contrato.

## El grafo

```
START ──► agente ──► END
```

Un solo nodo, `agente`: arma un mensaje de sistema con el contexto del
estudiante, le suma el historial de la conversación, invoca al LLM y devuelve el
texto en `reply`. El estado que fluye por el grafo está en
[`app/agent/state.py`](app/agent/state.py); el grafo en
[`app/agent/graph.py`](app/agent/graph.py).

---

## Contrato HTTP

### Endpoint

```
POST /api/ia/chat
Content-Type: application/json
```

(Además: `GET /health` → `{ "status": "ok" }` para el healthcheck.)

### Headers

| Header | Req. | Descripción |
|---|:--:|---|
| `Content-Type: application/json` | sí | |
| `X-API-Key: <clave>` | sí | Clave compartida con el backend. Sin ella → `401`. |

### Input

**La entrada es solo `texto`.** El prompt del agente, la memoria de la
conversación y el contexto del estudiante los arma el servicio internamente. Hoy
están hardcodeados (ver `app/agent/datos_demo.py`); más adelante vendrán de la
base de datos vía el backend.

```json
{
  "texto": "¿Qué campos laborales tiene mi carrera?"
}
```

| Campo | Tipo | Req. | Descripción |
|---|---|:--:|---|
| `texto` | string | sí | Mensaje del estudiante. |

### Output

```json
{
  "reply": "Camila, con tu perfil investigador y tu interés por los animales, Medicina Veterinaria encaja muy bien. ¿Querés que te cuente cómo es el plan de estudios?"
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `reply` | string | Respuesta del asesor para mostrar al estudiante. |

### Errores

- `401 Unauthorized` — falta el header `X-API-Key` o es incorrecto.
- `422 Unprocessable Entity` — el body no respeta el esquema (falta `texto`).
- `429 Too Many Requests` — se superó el rate limit.
- `503 Service Unavailable` — el servidor no tiene `SERVICE_API_KEY` configurada.
- `5xx` — falla al llamar al modelo. El frontend ya muestra un fallback ante error.

---

## Seguridad y rate limit

- **Autenticación:** el servicio no es público. Cada request al `/api/ia/chat`
  exige el header `X-API-Key` con la clave compartida (`SERVICE_API_KEY` en el
  `.env`). La comparación es de tiempo constante. **Fail-closed:** si el servidor
  no tiene clave configurada, rechaza todo. El consumidor es el backend (.NET),
  no el navegador.
- **Rate limit:** por IP, configurable con `RATE_LIMIT` (formato slowapi, p. ej.
  `20/minute`). Al superarlo, `429`.
- `GET /health` no requiere auth ni cuenta para el rate limit.

---

## Ejemplo con curl

```bash
curl -X POST http://localhost:8000/api/ia/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-secret-cambiar" \
  -d '{ "texto": "¿Qué campos laborales tiene mi carrera?" }'
```

---

## Cómo correr en local

```bash
cd ia
cp .env.example .env        # LLM_PROVIDER=google + GOOGLE_API_KEY (o openrouter)
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Variables de entorno en [`.env.example`](.env.example). La API key **nunca** se
commitea ni se expone al frontend.

---

## Contexto y memoria (hoy hardcodeados)

El contexto del estudiante y la memoria de la conversación viven en
`app/agent/datos_demo.py` con valores fijos. **Es temporal:** deben venir de la
base de datos (MySQL) vía el backend:

- **Contexto:** perfil del test (RIASEC), nombre, programa sugerido, etc.
- **Memoria:** historial de la conversación persistido por estudiante/sesión.

El request solo trae `texto`; cuando exista la DB, el backend mandará también el
identificador del estudiante/sesión y este servicio cargará su contexto y memoria.

## Cómo se extiende (futuro)

- **Contexto/memoria reales:** reemplazar `datos_demo.py` por una consulta a la DB
  (o recibir el identificador del estudiante en el request). El input público
  sigue siendo `texto`.
- **Agregar una herramienta / RAG:** se suma un nodo al grafo en `graph.py` y las
  aristas que definen cuándo entra. El input/output HTTP no cambia.
- **Memoria persistente:** LangGraph soporta *checkpointers* para gestionar el
  historial dentro del propio grafo.
- **Cambiar de proveedor/modelo:** variables en el `.env`, sin tocar código.
  `LLM_PROVIDER=google` usa Gemini directo con `GOOGLE_API_KEY`;
  `LLM_PROVIDER=openrouter` usa OpenRouter con `OPENROUTER_API_KEY`.

## Estructura de la carpeta

```
ia/
├── app/
│   ├── main.py          # FastAPI: expone POST /api/ia/chat (auth + rate limit)
│   ├── schemas.py       # input (texto) / output (reply)
│   ├── config.py        # variables de entorno
│   ├── security.py      # verificación del header X-API-Key
│   ├── llm.py           # cliente del modelo (Google / OpenRouter)
│   └── agent/
│       ├── state.py        # estado del grafo
│       ├── graph.py        # definición del grafo LangGraph
│       └── datos_demo.py   # contexto + memoria hardcodeados (temporal → DB)
├── requirements.txt
├── Dockerfile
├── .env.example
└── DOCUMENTACION.md     # este archivo
```
