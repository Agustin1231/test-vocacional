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

La entrada trae el mensaje (`texto`) y el identificador de sesión (`sesion_id`).
El prompt del agente y el contexto del estudiante los arma el servicio
internamente (el contexto hoy está hardcodeado en `app/agent/datos_demo.py`; luego
vendrá de la DB). **La memoria de la conversación se lee y se guarda en MySQL por
`sesion_id`** (ver sección "Memoria").

```json
{
  "texto": "¿Qué campos laborales tiene mi carrera?",
  "sesion_id": "estudiante-123"
}
```

| Campo | Tipo | Req. | Descripción |
|---|---|:--:|---|
| `texto` | string | sí | Mensaje del estudiante. |
| `sesion_id` | string | sí | Agrupa la memoria de la conversación. |

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
  -d '{ "texto": "¿Qué campos laborales tiene mi carrera?", "sesion_id": "estudiante-123" }'
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

## Memoria (MySQL)

La memoria de la conversación se persiste en MySQL. El servicio administra su
propia tabla `conversacion_memoria` y la crea sola al arrancar (`app/memory.py`).

Tabla:

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | BIGINT PK | autoincremental |
| `sesion_id` | VARCHAR(255) | agrupa los turnos de una conversación |
| `rol` | VARCHAR(20) | `user` o `assistant` |
| `texto` | TEXT | contenido del turno |
| `creado_en` | DATETIME | timestamp |

Flujo por request: se cargan los últimos turnos de `sesion_id`, se agrega el
mensaje nuevo, se invoca al agente y se guardan pregunta y respuesta.

**Best-effort:** si la DB no está disponible, se registra el error y el agente
responde igual (sin memoria) en vez de caerse. Config por `DB_*` en el `.env`.

## Instrucciones del agente (MySQL, editables por API)

El "system prompt" base del asesor **no está hardcodeado**: vive en la tabla
`agente_instrucciones` y se administra por endpoints protegidos. El agente lo lee
en cada request, así los cambios aplican **en vivo** sin redeploy. Al arrancar se
siembra un valor por defecto si la tabla está vacía (`app/instructions.py`).

Endpoints (ambos requieren `X-API-Key`):

```bash
# Ver las instrucciones actuales
curl -H "X-API-Key: dev-secret-cambiar" http://localhost:8000/api/ia/instrucciones

# Cambiarlas
curl -X PUT -H "X-API-Key: dev-secret-cambiar" -H "Content-Type: application/json" \
  -d '{ "contenido": "Sos el asesor de UNIAGRARIA. Responde breve y sugiere agendar una cita." }' \
  http://localhost:8000/api/ia/instrucciones
```

Tabla `agente_instrucciones`: `id`, `clave` (única, hoy `system_prompt`),
`contenido` (TEXT), `actualizado_en`.

## Contexto (hoy hardcodeado)

El contexto del estudiante vive en `app/agent/datos_demo.py` con valores fijos.
**Es temporal:** el perfil del test (RIASEC), nombre y programa sugerido deben
venir de MySQL vía el backend.

## Cómo se extiende (futuro)

- **Contexto real:** reemplazar `CONTEXTO_DEMO` por una consulta a la DB usando el
  `sesion_id` / identificador del estudiante. El contrato HTTP no cambia.
- **Agregar una herramienta / RAG:** se suma un nodo al grafo en `graph.py` y las
  aristas que definen cuándo entra. El input/output HTTP no cambia.
- **Cambiar de proveedor/modelo:** variables en el `.env`, sin tocar código.
  `LLM_PROVIDER=google` usa Gemini directo con `GOOGLE_API_KEY`;
  `LLM_PROVIDER=openrouter` usa OpenRouter con `OPENROUTER_API_KEY`.

## Estructura de la carpeta

```
ia/
├── app/
│   ├── main.py          # FastAPI: chat + endpoints de instrucciones (auth/rate limit)
│   ├── schemas.py       # input/output del chat y de las instrucciones
│   ├── config.py        # variables de entorno (incluida la URL de MySQL)
│   ├── security.py      # verificación del header X-API-Key
│   ├── db.py            # engine + metadata compartidos de MySQL
│   ├── memory.py        # tabla y lectura/escritura de memoria en MySQL
│   ├── instructions.py  # instrucciones del agente en MySQL (editables por API)
│   ├── llm.py           # cliente del modelo (Google / OpenRouter)
│   └── agent/
│       ├── state.py        # estado del grafo
│       ├── graph.py        # grafo LangGraph (lee el system prompt de la DB)
│       └── datos_demo.py   # contexto hardcodeado (temporal → DB)
├── requirements.txt
├── Dockerfile
├── .env.example
└── DOCUMENTACION.md     # este archivo
```
