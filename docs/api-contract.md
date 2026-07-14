# Contrato de API

**Esta es la fuente de verdad de la integración entre servicios.** Mientras este
contrato no cambie, cada servicio puede evolucionar por dentro sin coordinar con
los demás. Cambiar un endpoint = PR que se discute con los servicios afectados.

Convenciones:

- Base del backend: `/api`
- Base del servicio de IA (detrás del backend / proxy): `/api/ia`
- Autenticación: `Authorization: Bearer <JWT>` en endpoints protegidos.
- Formato: JSON. Fechas en ISO 8601.

> Los endpoints de abajo son una **plantilla inicial** — complétenlos/ajústenlos
> a medida que se implementan. Cada uno con request, response y un ejemplo.

---

## Backend (.NET 8) — `/api`

### `POST /api/auth/login`
Autenticación de usuarios (roles: estudiante, docente, orientador, admin).

- **Request:** `{ "correo": string, "password": string }`
- **Response:** `{ "token": string, "rol": string, "nombre": string }`

### `GET /api/preguntas`
Banco de preguntas del test (si el test es estructurado).

- **Response:** `[{ "id": number, "texto": string, "opciones": [...] }]`

### `POST /api/resultados`
Registra las respuestas de un estudiante y persiste el resultado calculado.

- **Request:** `{ "registro": {...}, "respuestas": {...}, "resultado": {...} }`
- **Response:** `{ "id": string, "fecha": string }`

### `GET /api/resultados`  *(protegido)*
Listado de informes para el panel de docentes/orientadores.

_(agregar: reportes PDF/Excel, gestión de usuarios, auditoría, etc.)_

---

## Servicio de IA (Python / LangGraph) — `/api/ia`

### `POST /api/ia/chat`
Asesor académico conversacional. Lo consume el **backend** (no el navegador).

- **Headers:** `X-API-Key: <clave compartida>` (obligatorio).
- **Request:** `{ "texto": string, "sesion_id": string }`
- **Response:** `{ "reply": string }`
- **Rate limit** por IP (`429` al superarlo).

> El contexto del estudiante lo arma el servicio de IA internamente (hoy
> hardcodeado; luego desde la DB). La memoria de la conversación se persiste en
> MySQL por `sesion_id`. Ver `ia/DOCUMENTACION.md`.

_(agregar: endpoints de explicación de resultado, RAG sobre programas, etc.)_

---

## Notas

- El **cálculo del perfil (RIASEC) es determinístico** y vive en el backend (o hoy
  en el frontend). La IA **explica y enriquece**, no decide la recomendación.
- El servicio de IA no es accesible desde el navegador: solo el backend (o el
  reverse proxy) lo alcanza por red interna.
