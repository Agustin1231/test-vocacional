# Backend — .NET 8 Web API (Clean Architecture)

Servicio institucional y orquestador. Es el **punto único de acceso a los datos**
(MySQL), el único cliente del servicio de IA y el único origen que el navegador
conoce.

## Qué hace hoy

- Login con JWT (`POST /api/auth/login`).
- Catálogos del formulario: `GET /api/ciudades`, `GET /api/grados`,
  `GET /api/tipos-documento`.
- Banco de preguntas: `GET /api/preguntas` (sin la letra/peso de cada opción).
- `POST /api/resultados` — público y transaccional: guarda usuario + test +
  respuestas + resultado.
- `GET /api/resultados` — protegido con JWT, listado para el panel.
- `POST /api/ia/chat` — **proxy hacia el servicio de IA**: agrega el header
  `X-API-Key`, traduce `sesionId` → `sesion_id` y audita la conversación en
  `ChatbotConversaciones`. La API key nunca llega al navegador
  (ver [ADR 0002](../docs/adr/0002-backend-como-proxy-de-la-ia.md)).
- `GET /health` — anónimo, sin tocar la base (healthcheck del compose y Coolify).
- CORS por lista de orígenes y **rate limit por IP** (login y endpoints públicos).

## Qué NO hace (todavía)

Honestidad sobre el alcance, porque el esquema sugiere más de lo que hay:

- **Reportes PDF/Excel:** no existen. El panel del frontend exporta un CSV desde
  su copia local, no desde el backend.
- **Roles y permisos:** el JWT lleva el rol como claim, pero **ningún endpoint usa
  `[Authorize(Roles = ...)]`**. `GET /api/resultados` acepta a cualquier usuario
  autenticado.
- **Auditoría:** la entidad `Auditoria` existe en el esquema; nadie escribe en
  ella.
- **El cálculo del perfil** vive en el frontend; el backend solo persiste lo que
  recibe (ver [ADR 0003](../docs/adr/0003-calculo-riasec-en-el-frontend.md)).
- **Gestión de usuarios / alta de administradores por API:** no hay endpoints. El
  admin inicial lo crea el seeder desde variables de entorno.

## Contrato

Los endpoints que este servicio expone están definidos en
[`../docs/api-contract.md`](../docs/api-contract.md), con el detalle de cómo
interpreta cada campo. **Cambiar el contrato = PR** que se discute con los
servicios afectados (frontend, IA).

## Estructura (Clean Architecture)

```
backend/
├── VocacionalTest.sln
├── Dockerfile                        # SDK 8.0 (build) → aspnet 8.0 (runtime), puerto 5000
└── src/
    ├── VocacionalTest.Domain/         # entidades (Usuario, Test, Respuesta, Resultado, …). Sin dependencias.
    ├── VocacionalTest.Application/    # DTOs + interfaces de servicios (contratos de la app)
    ├── VocacionalTest.Infrastructure/ # EF Core: AppDbContext, Migrations, DbSeeder + implementación de los servicios
    └── VocacionalTest.Api/            # controllers, Program.cs (JWT, CORS, rate limit, Swagger)
```

Dependencias: `Api → Infrastructure → Application → Domain`. Los controllers solo
dependen de las interfaces de `Application`.

## Cómo correr en local

Requiere **.NET SDK 8** y un MySQL accesible.

```bash
cp .env.example .env      # completar con valores locales
dotnet restore
dotnet run --project src/VocacionalTest.Api
```

Queda escuchando en **http://localhost:5000** (`launchSettings.json`), que es lo
que espera el frontend en desarrollo
(`frontend/src/environments/environment.development.ts`). En `Development` además
sirve Swagger en `/swagger`.

`src/VocacionalTest.Api/VocacionalTest.Api.http` tiene una petición lista para
cada endpoint (incluido el login y el chat).

### Base de datos

**Al arrancar, el backend aplica solo las migraciones pendientes**
(`Database.MigrateAsync()`) y después corre `DbSeeder`. Si eso falla, se registra
el error y el servicio arranca igual (así `/health` sigue respondiendo y el
contenedor no entra en reinicio infinito), pero cualquier endpoint que toque la
base va a devolver 500.

Para aplicarlas a mano (o desde cero, sin arrancar la API):

```bash
dotnet tool install --global dotnet-ef       # una sola vez
dotnet ef database update \
  --project src/VocacionalTest.Infrastructure \
  --startup-project src/VocacionalTest.Api
```

**El seeder es idempotente:** llena cada tabla **solo si está vacía**, no borra ni
actualiza nada. Siembra tipos de documento, grados, ciudades, roles, los 11
perfiles vocacionales, los programas de UNIAGRARIA y las **22 preguntas** con sus
opciones — con los mismos textos que usa el frontend, porque
`POST /api/resultados` resuelve los catálogos y las opciones **por nombre/texto**.
Si los cambiás en un lado, cambialos en el otro.

El **usuario administrador** se crea solo si están definidas `ADMIN_SEED_CORREO` y
`ADMIN_SEED_PASSWORD` y ese correo no existe todavía. No hay credenciales
hardcodeadas: sin esas variables no queda ningún usuario con contraseña, y por lo
tanto no se puede hacer login.

## Variables de entorno

Ver [`.env.example`](.env.example). El `.env` real **no** se commitea. En
desarrollo se carga desde `../../.env` o `./.env` si el archivo existe; en el
contenedor no hay ningún `.env` y las variables las inyecta el orquestador.

| Variable | Obligatoria | Nota |
|---|:--:|---|
| `DB_HOST`, `DB_NAME`, `DB_USER` | sí | Si falta alguna, el arranque falla con un mensaje claro. Con Docker, `DB_HOST=mysql`. |
| `DB_PORT`, `DB_PASSWORD` | no | `DB_PORT` default `3306`. |
| `JWT_SIGNING_KEY` | sí | **Mínimo 32 caracteres**: HmacSha256 lo exige y el backend no arranca con menos. |
| `JWT_ISSUER`, `JWT_AUDIENCE` | sí | |
| `JWT_EXPIRES_MINUTES` | no | Default 120. |
| `IA_BASE_URL` | para el chat | Sin ella, `POST /api/ia/chat` responde `503`. Con Docker, `http://ia:8000`. |
| `IA_API_KEY` | para el chat | Clave compartida; tiene que coincidir con `SERVICE_API_KEY` de la IA. |
| `CORS_ORIGINS` | no | Lista separada por comas, sin barra final. Default `http://localhost:4200`. |
| `IA_TIMEOUT_SEGUNDOS` | no | Default 110. Tiene que quedar por debajo del `proxy_read_timeout` de nginx (120 s). |
| `RATE_LIMIT_LOGIN_POR_MINUTO` | no | Default 10 por IP. |
| `RATE_LIMIT_PUBLICO_POR_MINUTO` | no | Default 30 por IP. |
| `RATE_LIMIT_GLOBAL_POR_MINUTO` | no | Default 120 por IP; techo para **todo** endpoint (catálogos incluidos). `/health` no cuenta. |
| `TRUSTED_PROXY_NETWORKS` | no | Redes/IPs (CIDR, separadas por comas) desde las que se acepta `X-Forwarded-For`. Default: redes privadas. |
| `ADMIN_SEED_CORREO`, `ADMIN_SEED_PASSWORD` | no | Las dos o ninguna; crean el admin inicial. |
| `ASPNETCORE_URLS` | no | **Ya la fija el Dockerfile** (`http://+:5000`); solo hace falta si corrés fuera del contenedor. |
| `ASPNETCORE_ENVIRONMENT` | no | El Dockerfile la fija en `Production`. En `Development` se publica Swagger y las páginas de error con stack trace + PII: no usarlo en un despliegue. |

## Orquestación

**Esta carpeta ya no tiene su propio `docker-compose.yml`** (se eliminó). El
`Dockerfile` es lo único que aporta al despliegue; cómo se conecta con MySQL, la
IA y el frontend se define en un solo lugar:
[`../infra/docker-compose.yml`](../infra/docker-compose.yml) — la única
orquestación del repo (regla 3 de [`../docs/ARQUITECTURA.md`](../docs/ARQUITECTURA.md)).

Para levantar todo junto, desde la raíz del repo:

```bash
docker compose -f infra/docker-compose.yml up --build
```

## Despliegue

Un `Dockerfile` en esta carpeta = un recurso/app en Coolify. Las variables de
entorno se configuran en Coolify (no hay `.env` en la imagen) y el healthcheck
apunta a `GET /health`.

## Responsables

Backend: **Juan, Santiago**.
