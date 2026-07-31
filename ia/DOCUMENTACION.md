# Servicio de IA — Agente vocacional (LangGraph)

Documento del **input y output** del agente y de cómo está armado por dentro.

## Qué es

Un asistente conversacional construido con **LangGraph**. Recibe un mensaje
(input), llama al modelo de lenguaje y devuelve una respuesta (output).

Tiene **una herramienta**: buscar en los documentos oficiales de la institución
(RAG sobre pgvector). El modelo decide si la usa según lo que le preguntaron: la
llama para un dato del plan de estudios y no la llama para un saludo. El contrato
HTTP no cambió al agregarla. Diseño y mediciones en
[`../docs/adr/0004-rag-en-pgvector.md`](../docs/adr/0004-rag-en-pgvector.md).

## Quién lo consume

**El backend .NET, no el navegador.** El frontend hace `POST /api/ia/chat` contra
el **backend**, que hace de proxy: agrega el header `X-API-Key`, traduce el cuerpo
(`{ texto, sesionId }` en camelCase → `{ texto, sesion_id }` en snake_case) y
audita la conversación en su propia tabla `ChatbotConversaciones`. Ver
[`../docs/adr/0002-backend-como-proxy-de-la-ia.md`](../docs/adr/0002-backend-como-proxy-de-la-ia.md).

Consecuencias prácticas:

- Este servicio **no se expone al host**: en `infra/docker-compose.yml` no tiene
  `ports`, solo lo alcanza el backend por la red interna.
- La clave `X-API-Key` (`SERVICE_API_KEY`) tiene que coincidir con `IA_API_KEY` del
  backend. Nunca llega al navegador.
- Si el backend no lo puede contactar (o esto devuelve un error o un `reply`
  vacío), el backend le responde al navegador un `503` genérico. El detalle del
  error nunca sale del backend.

## El grafo

```
START ──► agente ──┬──(el modelo no pidió nada)────────────────► END
                   ├──(pidió herramientas)──► herramientas ──┘ (vuelve a agente)
                   └──(se agotaron las vueltas)──► respuesta_final ──► END
```

- **`agente`** arma el mensaje de sistema (prompt de la DB + contexto del
  estudiante + política de herramientas), le suma el historial e invoca al LLM con
  las herramientas ofrecidas. El modelo puede devolver texto o pedidos de
  herramienta.
- **`herramientas`** ejecuta lo que pidió y mete el resultado en la conversación;
  el control vuelve a `agente`, que ahora responde con el dato a la vista.
- **`respuesta_final`** es la salida de emergencia: si el modelo agotó
  `MAX_VUELTAS_HERRAMIENTAS` y seguía pidiendo buscar, se lo invoca **sin**
  herramientas para forzar una respuesta en texto. Sin esto, `reply` podría llegar
  vacío al backend y el estudiante vería "el asesor no está disponible".

Tres detalles que conviene saber antes de tocarlo:

- **Las herramientas se ofrecen solo si están disponibles.** Sin RAG configurado,
  `tools.disponibles()` devuelve vacío, no se hace `bind_tools` y el grafo se
  comporta igual que su versión de un solo nodo.
- **El ciclo está acotado.** Cada vuelta es una llamada paga al modelo.
- **La política de uso de la herramienta la pone el código**, no el prompt
  editable del panel. Ver `POLITICA_HERRAMIENTAS` en `graph.py` y la tabla de
  mediciones del ADR 0004: sin ella, el prompt del panel ("no inventes datos de
  costos ni becas: si no los tienes, invitá a consultar la página") hacía que el
  modelo no llegara a buscar.

El estado que fluye por el grafo está en
[`app/agent/state.py`](app/agent/state.py); el grafo en
[`app/agent/graph.py`](app/agent/graph.py) y las herramientas en
[`app/agent/tools.py`](app/agent/tools.py).

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
| `X-API-Key: <clave>` | sí | Clave compartida (`SERVICE_API_KEY` = `IA_API_KEY` del backend). La agrega el backend, no el navegador. Sin ella → `401`. |

### Input

El cuerpo es **snake_case** y trae el mensaje (`texto`), el identificador de
sesión (`sesion_id`) y, opcional, el `contexto` del estudiante
(`nombre`, `perfil`, `area`, `carrera`) que manda el backend a partir del informe.
No recibe historial: lo reconstruye este servicio desde MySQL con el `sesion_id`
(ver sección "Memoria"). El prompt base lo arma el servicio leyéndolo de la DB.

Si `contexto` no llega (o llega vacío), el agente responde en **modo genérico**:
sin nombre ni carrera. Nunca se rellena con datos de ejemplo, porque un contexto
inventado le habla al estudiante equivocado sin que nada falle.

```json
{
  "texto": "¿Qué campos laborales tiene mi carrera?",
  "sesion_id": "estudiante-123"
}
```

| Campo | Tipo | Req. | Descripción |
|---|---|:--:|---|
| `texto` | string | sí | Mensaje del estudiante (el backend lo limita a 2000 caracteres). |
| `sesion_id` | string | sí | Agrupa la memoria de la conversación. Lo genera el navegador (`SessionService`, UUID v4 en `localStorage`) y lo reenvía el backend como `sesion_id`. |

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
- `5xx` — falla al llamar al modelo.

Ninguno de estos códigos llega al navegador tal cual: el backend los traduce a un
`503` con `{ "mensaje": "El asesor IA no está disponible..." }`, y el frontend
muestra un mensaje de *fallback* en el chat.

---

## Seguridad y rate limit

- **Autenticación:** el servicio no es público. Cada request al `/api/ia/chat`
  exige el header `X-API-Key` con la clave compartida (`SERVICE_API_KEY` en el
  `.env`). La comparación es de tiempo constante. **Fail-closed:** si el servidor
  no tiene clave configurada, rechaza todo. El consumidor es el backend (.NET),
  no el navegador.
- **Rate limit:** por estudiante (clave = cabecera `X-Cliente-IP` que agrega el
  backend con la IP real; si falta, cae a la IP del cliente TCP, que es el propio
  backend, y el límite pasa a ser global). Configurable con `RATE_LIMIT` (formato slowapi, p. ej.
  `20/minute`). Al superarlo, `429`.
- `GET /health` no requiere auth ni cuenta para el rate limit.

---

## Ejemplo con curl

Así llama el backend a este servicio (para depurar a mano hace falta la clave
compartida; desde el navegador esto no se puede hacer):

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

**Son endpoints de operación, no del flujo de la app:** se llaman **directo contra
este servicio** (por red interna o con un port-forward), por quien tenga la clave
compartida. El backend .NET **no** expone ninguna ruta equivalente, así que el
navegador no los alcanza ni por accidente.

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

## Contexto del estudiante

Llega en cada petición dentro de `contexto` (lo arma el frontend con el informe
recién calculado y lo reenvía el backend). El servicio no consulta la tabla de
resultados: con `sesion_id` solo agrupa la memoria, no identifica a nadie.
Si `contexto` viene vacío el prompt no menciona nombre ni carrera.

## Cómo se extiende (futuro)

- **Contexto desde la DB:** hoy lo manda el cliente. Para que la IA lo resuelva
  sola haría falta que el backend persista el `sesion_id` junto al resultado y que
  este servicio lo consulte; el contrato HTTP del chat no cambiaría (el `contexto`
  ya es opcional).
- **Agregar otra herramienta:** se declara con `@tool` en `agent/tools.py` y se
  suma a `disponibles()`. El grafo, el ciclo y el contrato HTTP no se tocan. Lo que
  sí hay que escribir con cuidado es su **docstring**: es lo único que el modelo ve
  de la herramienta y decide con eso si la llama (ver más abajo).
- **RAG sobre más documentos:** ya funciona para cualquier PDF con texto que se
  suba desde el panel. Lo que no está es re-indexar ni descargar un documento ya
  subido (ADR 0004).
- **Cambiar de proveedor/modelo:** variables en el `.env`, sin tocar código.
  `LLM_PROVIDER=google` usa Gemini directo con `GOOGLE_API_KEY`;
  `LLM_PROVIDER=openrouter` usa OpenRouter con `OPENROUTER_API_KEY`.

## Estructura de la carpeta

```
ia/
├── app/
│   ├── main.py          # FastAPI: chat, instrucciones y documentos (auth/rate limit)
│   ├── schemas.py       # input/output de chat, instrucciones y documentos
│   ├── config.py        # variables de entorno (MySQL + RAG)
│   ├── security.py      # verificación del header X-API-Key
│   ├── db.py            # engine + metadata compartidos de MySQL
│   ├── memory.py        # tabla y lectura/escritura de memoria en MySQL
│   ├── instructions.py  # instrucciones del agente en MySQL (editables por API)
│   ├── llm.py           # cliente del modelo (Google / OpenRouter)
│   ├── agent/
│   │   ├── state.py        # estado del grafo
│   │   ├── graph.py        # grafo LangGraph + política de uso de herramientas
│   │   └── tools.py        # herramientas que el modelo puede llamar
│   └── rag/
│       ├── pdf.py          # extrae el texto del PDF y lo trocea
│       ├── embeddings.py   # texto -> vectores (Google, 768 dims)
│       └── store.py        # pgvector: guardar, listar, borrar y buscar
├── requirements.txt
├── Dockerfile
├── .env.example
└── DOCUMENTACION.md     # este archivo
```

Ojo con una asimetría a propósito: **`db.py` y `rag/store.py` son bases distintas**
con `MetaData` distintas. La memoria y las instrucciones viven en el MySQL de
negocio; los documentos y sus vectores, en pgvector. Registrar las tablas del RAG en
`db.metadata` haría que `init_db()` intentara crear una columna `vector` en MySQL al
arrancar.
