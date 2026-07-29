# Contrato de API

**Esta es la fuente de verdad de la integración entre servicios.** Mientras este
contrato no cambie, cada servicio puede evolucionar por dentro sin coordinar con
los demás. Cambiar un endpoint = PR que se discute con los servicios afectados.

Este documento describe lo que el código hace **hoy** (post-integración). Lo que
todavía no existe está marcado como pendiente y no se documenta como si existiera.

---

## Quién llama a quién

```
navegador ──1──> backend (.NET 8, /api) ──2──> ia (Python/FastAPI, /api/ia)
                     │                              │
                     └──────► MySQL ◄───────────────┘
                                                    │
                                                    3
                                                    ▼
                                        proveedor del modelo
                                        (Google Gemini u OpenRouter)

ops / equipo ──4──> ia (/api/ia/instrucciones)   [directo, NO pasa por el backend]
```

1. **navegador → backend.** Único origen que el navegador conoce. En producción
   es relativo (`/api`) y nginx lo proxea al backend; en desarrollo es
   `http://localhost:5000/api`. Sin API keys: solo JWT en los endpoints
   protegidos.
2. **backend → ia.** Red interna. El backend agrega el header `X-API-Key` y
   traduce el cuerpo (`sesionId` → `sesion_id`).
3. **ia → proveedor del modelo.** La API key del LLM vive solo en el servicio de IA.
4. **ops → ia.** Los endpoints de instrucciones del agente se administran
   directo contra el servicio de IA. **El backend no los expone.**

Convenciones:

- Base del backend: `/api`. Base del servicio de IA: `/api/ia`.
- Autenticación del backend: `Authorization: Bearer <JWT>` en los endpoints
  protegidos. Autenticación del servicio de IA: `X-API-Key`.
- Rate limit del backend: además de las políticas por endpoint (`login`,
  `publico`) hay un **techo global por IP** (`RATE_LIMIT_GLOBAL_POR_MINUTO`,
  default 120/min) que cubre todo endpoint, incluidos los catálogos. `/health`
  está exento. La IP se toma de `X-Forwarded-For` **solo** si la petición viene de
  una red de proxy declarada (`TRUSTED_PROXY_NETWORKS`).
- Formato: JSON. Fechas en ISO 8601 (`DateTime.ToString("o")`, UTC).
- Errores propios del backend: `{ "mensaje": string }`. Eso incluye el `500`
  genérico (`{ "mensaje": "Ocurrió un error inesperado..." }`): hay un
  `UseExceptionHandler` que evita devolver stack traces.
- Hay **dos formas de `400`** y conviven:
  - **Validación de modelo (DataAnnotations)**, que corre ANTES del cuerpo del
    método porque los controllers son `[ApiController]`: `ValidationProblemDetails`
    estándar de ASP.NET (`{ type, title, status, errors }`). Es lo que se recibe
    cuando falta un campo `[Required]`, cuando `correo` no tiene formato de email
    o cuando un texto excede su `StringLength`.
  - **Chequeos manuales del controller**: `{ "mensaje": string }`. Solo se
    alcanzan cuando el modelo pasó la validación (p. ej. un campo con espacios en
    blanco, que satisface `[Required]` pero no `IsNullOrWhiteSpace`).

---

## Backend (.NET 8) — lo que consume el navegador

### `GET /health`

Healthcheck (lo usan `infra/docker-compose.yml` y Coolify). Anónimo y **no toca
la base de datos**.

- **Response `200`:** `{ "status": "ok" }`

### `POST /api/auth/login`

Login del panel. Rate limit por IP (`RATE_LIMIT_LOGIN_POR_MINUTO`, default 10/min).

- **Request:** `{ "correo": string, "password": string }`
  (`correo`: requerido, formato email, ≤150; `password`: requerido, 6–128)
- **Response `200`:** `{ "token": string, "rol": string, "nombre": string }`
- **`401`:** `{ "mensaje": "Correo o contraseña incorrectos" }`
- **`429`:** `{ "mensaje": "Demasiadas solicitudes..." }`

Notas: los estudiantes que crea `POST /api/resultados` quedan **sin contraseña** y
no pueden loguearse. El único usuario con contraseña lo siembra el backend al
arrancar si están definidas `ADMIN_SEED_CORREO` y `ADMIN_SEED_PASSWORD`.

### `GET /api/preguntas`

Preguntas activas (`Estado = true`) con sus opciones. Público, sin rate limit
propio (aplica el techo global por IP, `RATE_LIMIT_GLOBAL_POR_MINUTO`, default
120/min).

- **Response `200`:**
  ```json
  [
    {
      "id": 1,
      "enunciado": "¿Qué actividad te resulta más natural?",
      "categoria": "Vocacional",
      "opciones": [{ "id": 1, "texto": "Cuidar animales..." }]
    }
  ]
  ```

> **No expone la letra ni el peso de cada opción.** Por eso el frontend sigue
> usando su propio banco (`core/data/questions.data.ts`) y este endpoint hoy no
> se consume. Ver [ADR 0003](adr/0003-calculo-riasec-en-el-frontend.md).

### `GET /api/ciudades`, `GET /api/grados`, `GET /api/tipos-documento`

Catálogos del formulario de registro. Públicos, sin rate limit propio (aplica el
techo global por IP, `RATE_LIMIT_GLOBAL_POR_MINUTO`, default 120/min). Los
siembra el backend al arrancar con los mismos valores que usa el frontend.

- **Response `200`:** `[{ "id": number, "nombre": string }]`

> El frontend todavía usa sus listas locales (`core/data/form-options.data.ts`);
> estos endpoints existen para que `POST /api/resultados` pueda resolver los
> nombres que llegan y para cuando el formulario se alimente del backend.

### `POST /api/resultados`

Guarda el informe completo del estudiante. **Público** (`[AllowAnonymous]`): el
estudiante no está logueado. Rate limit por IP (`RATE_LIMIT_PUBLICO_POR_MINUTO`,
default 30/min).

Todo se escribe en **una transacción**: usuario + test + respuestas + resultado.

- **Request:**
  ```json
  {
    "registro": {
      "nombre": "Ana",
      "apellidos": "Pérez Gómez",
      "tipoDocumento": "Tarjeta de Identidad (TI)",
      "numeroDocumento": "1001234567",
      "celular": "3001234567",
      "correo": "ana.perez@ejemplo.com",
      "colegio": "Colegio Nacional",
      "grado": "Once",
      "ciudad": "Bogotá D.C.",
      "edad": "17"
    },
    "respuestas": [
      { "preguntaId": 1, "letra": "A", "texto": "Cuidar animales..." }
    ],
    "resultado": {
      "letra": "A",
      "perfil": "Clínico apasionado por la salud...",
      "carrera": "Medicina Veterinaria",
      "area": "Ciencias de la Salud Animal",
      "contadores": { "A": 8, "B": 5, "C": 2 }
    }
  }
  ```
- **Response `200`:** `{ "id": string, "fecha": string }` (`id` es el id del
  `Resultado` como texto; `fecha` en ISO 8601 UTC, siempre con `Z`)
- **`400`:** `ValidationProblemDetails` de DataAnnotations. Dispara por los
  requeridos (`nombre`, `apellidos`, `numeroDocumento`, `correo`,
  `resultado.letra`), por el formato de `correo` (`[EmailAddress]`) y por los
  largos máximos (`colegio` ≤ 150, `celular` ≤ 30, `resultado.perfil` ≤ 1000, …),
  que el formulario del frontend no limita.
- **`409`:** `{ "mensaje": string }` — el registro no se pudo aplicar: el correo o
  el documento pertenecen a **una cuenta del sistema** (usuario con contraseña o
  con rol), o la base rechazó el guardado por un índice único. El informe **no**
  quedó guardado; el cliente tiene que distinguir esto de un fallo de red.
- **`429`:** rate limit

Cómo lo interpreta el backend (importante, porque no es un guardado literal):

| Campo | Qué hace el backend |
|---|---|
| `registro.tipoDocumento` / `grado` / `ciudad` | Se buscan **por nombre** (case-insensitive) en los catálogos. Si no coinciden, la FK queda en `null`. Nunca se crean filas de catálogo desde este endpoint. |
| `registro.correo` / `numeroDocumento` | Identifican al estudiante: se busca por correo y, si no aparece, por tipo+número de documento. **Si el usuario ya existe no se toca ningún dato de identidad ni de acceso** (`Correo`, `NumeroDocumento`, `TipoDocumentoId`, `Estado`, `PasswordHash`, `RolId`): el endpoint es anónimo y cualquiera podría mandar el correo o el documento de otra persona. Solo se completan los campos descriptivos que estén vacíos (nombre, apellido, celular, colegio, ciudad, grado, edad) y se le cuelga el nuevo test. Si el usuario encontrado **tiene contraseña o rol**, la petición se rechaza con `409`. Si `numeroDocumento` llega vacío, `TipoDocumentoId` queda en `null` (para no chocar el índice único con otros registros sin documento). |
| `registro.edad` | Llega como texto (`"17"`, `"23 o más"`). Si no se puede parsear a entero se conserva la edad anterior (0 en los nuevos). |
| `respuestas[].preguntaId` | **Tiene que ser el `Id` real de la fila en `Preguntas`.** Hoy el frontend manda los ids de su banco local (`1..22`) y funciona solo porque `DbSeeder` inserta las 22 preguntas en una tabla vacía con `AUTO_INCREMENT` en 1. Si la tabla ya tuvo filas, los ids no coinciden: la respuesta se guarda con las FKs en `null` (200 OK) y el backend deja un **warning en el log** con el conteo de respuestas sin resolver. Lo correcto a mediano plazo es consumir `GET /api/preguntas`. |
| `respuestas[].texto` | Con `preguntaId` + `texto` se resuelve la `OpcionRespuesta` (comparación case-insensitive). Si la pregunta o la opción no existen en la base, la respuesta se guarda con las FKs en `null` en vez de fallar; queda registrado como warning. |
| `respuestas[].letra` | **No se persiste**: `Respuesta` no tiene columna para ella (requeriría migración). Viaja porque es el dato con el que el frontend calcula. |
| `resultado.perfil` / `area` | Se busca `PerfilVocacional` por nombre: primero con `perfil`, y si no coincide con `area`. El catálogo se siembra con el nombre del área, así que en la práctica gana `area`. |
| `resultado.carrera` | Se busca `ProgramaAcademico` por nombre. Sin coincidencia → `null`. |
| `resultado.contadores` | De acá salen `Puntaje` (respuestas de la letra ganadora) y `Porcentaje` (`puntaje / total * 100`, 2 decimales); la letra se busca en el diccionario **sin distinguir mayúsculas**. El backend **no recalcula el perfil**. |

### `GET /api/resultados` *(protegido, solo administrador)*

Listado de informes para el panel. Requiere `Authorization: Bearer <JWT>` de un
usuario con rol **`Administrador`** (`[Authorize(Roles = "Administrador")]`):
devuelve nombre y correo de todos los estudiantes, así que un token cualquiera no
alcanza. Orden: `fecha` descendente. Rate limit `publico` por IP.

- **Query params:** `pagina` (1-based, default 1) y `tamano` (default 200, tope
  duro 500). Sin paginación el endpoint materializaba la tabla entera en cada
  refresco del panel.

- **Response `200`:**
  ```json
  [
    {
      "id": 12,
      "nombreEstudiante": "Ana Pérez Gómez",
      "correoEstudiante": "ana.perez@ejemplo.com",
      "puntaje": 8,
      "porcentaje": 36.36,
      "perfilVocacional": "Ciencias de la Salud Animal",
      "programaAcademico": "Medicina Veterinaria",
      "fecha": "2026-07-29T14:03:11.0000000Z"
    }
  ]
  ```
  `perfilVocacional` y `programaAcademico` pueden venir en `null` (no hubo
  coincidencia al guardar). Si el `Test` o el `Usuario` faltan,
  `nombreEstudiante` es `"Desconocido"` y `correoEstudiante` queda vacío.
  `fecha` es ISO 8601 **UTC con `Z`**, igual que en el `POST` (la columna MySQL es
  `datetime(6)` y no lleva zona: el backend fuerza `DateTimeKind.Utc` al
  serializar, para que el navegador no la interprete como hora local).
- **`401`:** sin token o token inválido/vencido.
- **`403`:** token válido de un usuario sin el rol `Administrador`.

> No incluye celular, colegio, ciudad ni grado: el panel los muestra como `—`
> cuando la fila viene del backend.

> **Pendiente (no implementado):** el frontend **no tiene pantalla de login**, así
> que hoy este endpoint es inalcanzable desde la app: `RecordsService` lee el JWT
> de `localStorage` (clave `uniagraria_admin_token`) y, si no está, ni emite la
> petición y el panel cae a su copia local. Para verlo funcionando hay que pegar
> a mano un token obtenido de `POST /api/auth/login`. Falta también un guard en
> la ruta `/admin`.

### `POST /api/ia/chat`

Chat con el asesor IA. **El backend hace de proxy**: es el único endpoint de IA
que ve el navegador, y **no lleva API key**. Público (mismo flujo que el
estudiante), rate limit `publico` por IP.

- **Request (navegador → backend):**
  ```json
  {
    "texto": "¿Qué salidas laborales tiene Medicina Veterinaria?",
    "sesionId": "b3f1...",
    "contexto": {
      "nombre": "Ana",
      "perfil": "Clínico apasionado por la salud y el bienestar de los animales...",
      "area": "Ciencias de la Salud Animal",
      "carrera": "Medicina Veterinaria"
    }
  }
  ```
  (`texto`: requerido, ≤2000; `sesionId`: requerido, ≤100. El frontend genera y
  guarda el `sesionId` en `localStorage`. `contexto` es **opcional**: son los
  datos del informe con los que se personaliza el asesor; cada campo es opcional
  y se omite el objeto entero cuando el estudiante todavía no tiene resultado.)
- **Response `200`:** `{ "reply": string }`
- **`400`:** falta `texto` o `sesionId` → `ValidationProblemDetails` de
  DataAnnotations (`{ type, title, status, errors }`), porque los dos campos son
  `[Required]` y la validación de modelo corre antes del método. El cuerpo
  `{ "mensaje": "Se requieren los campos texto y sesionId." }` solo aparece
  cuando el valor llega con espacios en blanco (`"   "`).
- **`429`:** rate limit
- **`503`:** `{ "mensaje": "El asesor IA no está disponible en este momento..." }`
  Cubre todos los fallos del salto interno: falta `IA_BASE_URL`, la IA respondió
  un código de error, devolvió `reply` vacío o no se pudo contactar (timeout
  `IA_TIMEOUT_SEGUNDOS`, default 110 s, por debajo del `proxy_read_timeout` de
  120 s de nginx). El detalle nunca se le devuelve al cliente; queda en el log
  del backend.

Qué hace el backend con esa petición:

1. `POST {IA_BASE_URL}/api/ia/chat` con el header `X-API-Key: {IA_API_KEY}` y el
   header `X-Cliente-IP: <IP real del navegador>` (la toma de `HttpContext`; el
   servicio de IA lo usa como clave de su rate limit).
2. Traduce el cuerpo a lo que espera Python:
   `{ "texto": ..., "sesion_id": ..., "contexto": { ... } }` (el `contexto` se
   omite si no vino o vino vacío).
3. Guarda el par mensaje/respuesta en `ChatbotConversaciones` (auditoría, *best
   effort*: si el guardado falla, el estudiante igual recibe su respuesta).
   `UsuarioId` queda en `null` porque el chat es anónimo.

El contexto del estudiante (nombre, perfil, área, carrera) **lo manda el
navegador en cada turno**: el servicio de IA no puede deducirlo, porque el
`sesion_id` no se persiste junto al resultado y la IA no consulta las tablas de
`Resultados`/`Usuarios`. Si no llega contexto, el asesor responde en modo
genérico (sin nombre ni carrera). La memoria de la conversación la agrupa la IA
por `sesion_id`.

### Pendientes del backend (no implementados)

Reportes PDF/Excel, gestión de usuarios y auditoría (`Auditoria` existe como
entidad pero nadie escribe en ella).

**Registro del consentimiento (Ley 1581 de 2012).** El formulario exige la
casilla de autorización de tratamiento de datos, pero el frontend la descarta
antes de enviar (`datos.component.ts`) y **no hay dónde guardarla**: ni el
`RegistroDto` ni la entidad `Usuario` tienen campos de consentimiento. Cerrarlo
requiere una **migración de EF** (`consentimiento`, `consentimientoFecha`,
`consentimientoVersion`) y, además, el consentimiento del representante legal
para los estudiantes menores de edad. Hoy no queda evidencia de quién autorizó
el tratamiento.

---

## Servicio de IA (Python / FastAPI + LangGraph) — lo que consume el backend

**El consumidor es el backend .NET, no el navegador.** El servicio no se publica
al host: en `infra/docker-compose.yml` no tiene `ports`, solo lo alcanza el
backend por la red interna.

### `GET /health`

Sin auth y sin contar para el rate limit.

- **Response `200`:** `{ "status": "ok" }`

### `POST /api/ia/chat`

- **Headers:** `X-API-Key: <clave compartida>` (obligatorio; es `SERVICE_API_KEY`
  del lado de la IA e `IA_API_KEY` del lado del backend — **la misma clave**).
- **Headers (opcional):** `X-Cliente-IP: <IP real del estudiante>`, que agrega el
  backend. Es la **clave del rate limit**: sin ella, el único cliente TCP es el
  contenedor del backend y el límite (`RATE_LIMIT`) sería una sola cubeta
  compartida por todos los estudiantes.
- **Request:** `{ "texto": string, "sesion_id": string, "contexto"?: { "nombre"?, "perfil"?, "area"?, "carrera"? } }` ← snake_case
- **Response `200`:** `{ "reply": string }`
- **Errores:** `401` (falta o no coincide la clave), `422` (body inválido),
  `429` (rate limit por estudiante, `RATE_LIMIT` en formato slowapi, default
  `20/minute`, particionado por `X-Cliente-IP`),
  `503` (el servidor no tiene `SERVICE_API_KEY` configurada → *fail-closed*),
  `5xx` (falla al llamar al modelo).

> El contexto del estudiante llega en la petición y es opcional: si no viene, el
> agente responde en modo genérico y **no** se inyecta ningún dato de ejemplo. La
> memoria de la conversación se persiste en MySQL por `sesion_id`. Ver
> `ia/DOCUMENTACION.md`.

### `GET /api/ia/instrucciones` y `PUT /api/ia/instrucciones`

**Administración (ops), no parte del flujo de la app.** Se llaman **directo
contra el servicio de IA** por quien tenga la clave compartida: el backend **no**
expone ninguna ruta equivalente y el navegador no las alcanza.

- **Headers:** `X-API-Key: <clave compartida>` (obligatorio).
- **`GET` Response:** `{ "clave": string, "contenido": string, "actualizado_en": string }`
- **`PUT` Request:** `{ "contenido": string }` → misma respuesta que el `GET`.

Las instrucciones se guardan en MySQL (tabla `agente_instrucciones`). El agente
las lee en cada request, así los cambios aplican en vivo sin redeploy.

---

## Notas

- El **cálculo del perfil es determinístico**, pero hoy vive en el **frontend**:
  el backend solo persiste lo que recibe y deriva `Puntaje`/`Porcentaje` de
  `contadores`. Es un desvío consciente y temporal del documento de arquitectura
  del equipo; ver [ADR 0003](adr/0003-calculo-riasec-en-el-frontend.md).
- El test implementado son **11 áreas identificadas por letra (A–K)**, no los 6
  códigos RIASEC de Holland. Donde la documentación del equipo dice "RIASEC",
  léase "el perfil vocacional de 11 áreas de este test".
- La IA **explica y enriquece**, no decide la recomendación.
- El servicio de IA no es accesible desde el navegador: solo el backend lo
  alcanza por red interna.
