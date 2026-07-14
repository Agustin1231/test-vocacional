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

### Input

```json
{
  "mensajes": [
    { "rol": "user",      "texto": "Hola, ¿qué carrera me conviene?" },
    { "rol": "assistant", "texto": "Contame qué te gusta hacer." },
    { "rol": "user",      "texto": "Me gustan los animales y la biología." }
  ],
  "contexto": {
    "nombre":  "Camila",
    "perfil":  "Investigador / Realista",
    "area":    "Ciencias de la vida",
    "carrera": "Medicina Veterinaria"
  }
}
```

| Campo | Tipo | Req. | Descripción |
|---|---|:--:|---|
| `mensajes` | array | sí | Historial en orden cronológico. Vacío = primer turno. |
| `mensajes[].rol` | `"user"` \| `"assistant"` | sí | Quién dijo el mensaje. |
| `mensajes[].texto` | string | sí | Contenido del turno. |
| `contexto` | objeto | no | Datos para personalizar la respuesta. Todos los campos son opcionales. |
| `contexto.nombre` | string | no | Nombre del estudiante. |
| `contexto.perfil` | string | no | Perfil vocacional (resultado del test). |
| `contexto.area` | string | no | Área de afinidad. |
| `contexto.carrera` | string | no | Programa sugerido por el test. |

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

- `422 Unprocessable Entity` — el body no respeta el esquema (FastAPI lo valida).
- `5xx` — falla al llamar al modelo. El frontend ya muestra un mensaje de fallback
  ante error de conexión (ver `ai-chat.service.ts`).

Este formato coincide con lo que el frontend ya envía en
`frontend/src/app/core/services/ai-chat.service.ts` y con
[`../docs/api-contract.md`](../docs/api-contract.md).

---

## Ejemplo con curl

```bash
curl -X POST http://localhost:8000/api/ia/chat \
  -H "Content-Type: application/json" \
  -d '{
    "mensajes": [{ "rol": "user", "texto": "¿Qué campos laborales tiene Veterinaria?" }],
    "contexto": { "carrera": "Medicina Veterinaria" }
  }'
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

## Cómo se extiende (futuro)

- **Agregar una herramienta / RAG:** se suma un nodo al grafo en `graph.py` y las
  aristas que definen cuándo entra. El input/output HTTP no cambia.
- **Memoria persistente:** LangGraph soporta *checkpointers*; hoy la memoria es el
  array `mensajes` que envía el cliente en cada request.
- **Cambiar de proveedor/modelo:** variables en el `.env`, sin tocar código.
  `LLM_PROVIDER=google` usa Gemini directo con `GOOGLE_API_KEY`;
  `LLM_PROVIDER=openrouter` usa OpenRouter con `OPENROUTER_API_KEY`.

## Estructura de la carpeta

```
ia/
├── app/
│   ├── main.py          # FastAPI: expone POST /api/ia/chat
│   ├── schemas.py       # input/output (Pydantic)
│   ├── config.py        # variables de entorno
│   ├── llm.py           # cliente del modelo (OpenRouter)
│   └── agent/
│       ├── state.py     # estado del grafo
│       └── graph.py     # definición del grafo LangGraph
├── requirements.txt
├── Dockerfile
├── .env.example
└── DOCUMENTACION.md     # este archivo
```
