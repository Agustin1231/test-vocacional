# ADR 0002 — El backend hace de proxy hacia el servicio de IA

- **Estado:** aceptado
- **Fecha:** 2026-07-29

## Contexto

El servicio de IA exige el header `X-API-Key` con una clave compartida
(`SERVICE_API_KEY`) y es *fail-closed*: sin clave, rechaza todo.

Si el navegador llamara directo a `/api/ia/chat` del servicio de IA, esa clave
tendría que estar en el bundle de Angular o en la configuración de nginx: en
cualquiera de los dos casos queda **al alcance de cualquiera** que abra las
DevTools, y con ella se puede consumir el LLM (que se paga por token) desde
afuera. La alternativa de dejar el endpoint sin clave es peor.

Además hacía falta un lugar donde auditar las conversaciones: el esquema ya tiene
la tabla `ChatbotConversaciones`, y el único servicio que administra ese esquema
es el backend.

## Decisión

El **backend .NET es el único cliente del servicio de IA**. Expone
`POST /api/ia/chat` (público, rate limit por IP) y hacia adentro:

1. Llama a `{IA_BASE_URL}/api/ia/chat` agregando `X-API-Key: {IA_API_KEY}`
   (misma clave que `SERVICE_API_KEY` de la IA; en `infra/docker-compose.yml` es
   una sola variable, `IA_API_KEY`).
2. Traduce el cuerpo: `{ texto, sesionId }` (camelCase, lo que manda el
   navegador) → `{ texto, sesion_id }` (snake_case, lo que espera FastAPI).
3. Guarda el par mensaje/respuesta en `ChatbotConversaciones`.
4. Traduce cualquier falla del salto interno a un `503` con un mensaje genérico;
   el detalle queda en el log del backend, nunca en la respuesta.

El servicio de IA **no se publica al host**: en el compose no tiene `ports`.

## Consecuencias

- **La API key nunca llega al navegador.** El bundle del frontend no contiene
  ninguna clave y el servicio de IA solo es alcanzable desde la red interna.
- **Auditoría en un solo lugar:** toda conversación queda en
  `ChatbotConversaciones`. Es *best effort*: si el guardado falla se registra y el
  estudiante igual recibe su respuesta. `UsuarioId` queda en `null` porque el chat
  del estudiante es anónimo.
- **Precio: un salto más de red** por cada mensaje (navegador → nginx → backend →
  ia). Por eso el `HttpClient` del backend tiene timeout de 110 s
  (`IA_TIMEOUT_SEGUNDOS`) y nginx usa `proxy_read_timeout 120s` para `/api/`: una
  respuesta del LLM puede tardar más que los defaults, y el timeout del backend
  tiene que quedar por debajo del de nginx (con 30 s, el backend cortaba y
  devolvía 503 mientras la IA seguía respondiendo y persistiendo el turno).
- **Punto único de falla adicional:** si el backend está caído, el chat no
  funciona aunque la IA esté sana. Se acepta: sin backend tampoco se puede
  guardar el informe.
- El contrato del navegador queda en camelCase y el de Python en snake_case; la
  traducción está fijada con `JsonPropertyName` en `IaChatServicioRequest` para
  que no dependa de la configuración del serializador.
- El frontend dejó de mandar el historial: la memoria la agrupa la IA por
  `sesion_id`. El **contexto del estudiante sí viaja** en cada turno
  (`{ texto, sesionId, contexto? }` → `{ texto, sesion_id, contexto? }`), porque
  el servicio de IA no persiste el `sesion_id` junto al resultado y no puede
  resolver de quién es la sesión. Si en el futuro la IA consulta la base, el
  campo puede dejar de enviarse sin romper el contrato (ya es opcional).
- El backend reenvía además la IP real del estudiante en `X-Cliente-IP`: es la
  clave con la que la IA particiona su rate limit. Sin ella, el único cliente TCP
  que la IA ve es el contenedor del backend y el límite sería global.
