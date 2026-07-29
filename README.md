# Test Vocacional

Aplicacion web que aplica un test vocacional y direcciona a los estudiantes hacia programas academicos segun su perfil.

## Arquitectura

Capas desacopladas / microservicios. La capa de inteligencia artificial esta desacoplada del resto: se puede cambiar de proveedor o de modelo tocando solo las variables de entorno del servicio de IA, sin afectar backend ni frontend.

El navegador habla **solo con el backend**: el chat del asesor tambien entra por `/api/ia/chat` del backend, que hace de proxy hacia el servicio de IA agregando la clave compartida (`X-API-Key`). El frontend no guarda ninguna API key.

El repositorio sigue un patron **monorepo por servicios, contract-first**: una carpeta autocontenida por servicio, que se comunican solo por el contrato REST. El detalle de por que este patron y como esta organizado el repo esta en **[docs/ARQUITECTURA.md](docs/ARQUITECTURA.md)**.

## Estructura del repositorio

```
test-vocacional/
├── docs/          # documentacion compartida + contrato de API + decisiones (ADR)
├── frontend/      # Angular (SPA)              — Natalia
├── backend/       # .NET 8 Clean Architecture  — Juan, Santiago
├── ia/            # servicio Python LangGraph  — Agustin
├── infra/         # orquestacion (docker-compose) para levantar todo junto
└── referencia/    # HTML de referencia del test
```

Cada carpeta de servicio tiene su propio `Dockerfile`, `README.md` y `.env.example`. El contrato entre servicios vive en [docs/api-contract.md](docs/api-contract.md).

## Stack

- Frontend: Angular 18 (SPA servida por nginx, que ademas proxea `/api` al backend)
- Backend: .NET 8 Web API (Clean Architecture, EF Core)
- Base de datos: MySQL 8 (una sola base para backend y servicio de IA)
- IA: servicio Python (FastAPI + LangGraph), consumido solo por el backend

## Levantar todo junto (local)

`infra/docker-compose.yml` es la **unica** orquestacion del repo (el `backend/docker-compose.yml` se elimino). Levanta los 4 servicios: frontend, backend, ia y mysql.

Antes de arrancar:

1. `cp backend/.env.example backend/.env` y completarlo. Ojo: `DB_HOST=mysql` (no `localhost`) y `JWT_SIGNING_KEY` de **32 caracteres o mas** (si es mas corta el backend no arranca).
2. `cp ia/.env.example ia/.env` y completarlo (`DB_HOST=mysql` + la API key del proveedor del modelo).
3. Crear `infra/.env` (no se commitea) con las dos variables que el compose exige y que **no tienen valor por defecto**:

```
MYSQL_ROOT_PASSWORD=...   # password de root de MySQL
IA_API_KEY=...            # clave compartida backend <-> ia
```

Si falta alguna de las dos, el compose falla ruidosamente en vez de levantar una base con password conocida o una IA sin autenticar. `IA_API_KEY` se inyecta en los dos lados desde una sola variable: al backend como `IA_API_KEY` y a la IA como `SERVICE_API_KEY`.

```bash
docker compose -f infra/docker-compose.yml up --build
```

Queda expuesto al host solo el frontend en **http://localhost:8080**. El backend se publica unicamente en loopback (`127.0.0.1:5000`, para depurar: saltear nginx tambien saltea el `X-Forwarded-For` con el que se aplica el rate limit). La IA y MySQL solo se alcanzan por la red interna.

Cada servicio tambien se puede levantar solo desde su carpeta (ver su `README.md`); para eso no hace falta Docker.

## Equipo

- Backend: Juan, Santiago
- Frontend: Natalia
- IA e integracion: Agustin

## Estado

Los 4 servicios estan implementados e integrados entre si (rama `integracion`).

**Funciona hoy:**

- **Frontend:** flujo completo (avatar → datos → quiz de 22 preguntas → resultado → asesor IA) + panel `admin`. Calcula el perfil en el navegador y envia el informe al backend.
- **Backend:** login con JWT, catalogos (`/api/ciudades`, `/api/grados`, `/api/tipos-documento`), `GET /api/preguntas`, `POST /api/resultados` (publico, transaccional), `GET /api/resultados` (protegido), `POST /api/ia/chat` (proxy hacia la IA), `GET /health`, CORS y rate limit por IP. Al arrancar aplica las migraciones de EF Core y siembra catalogos, perfiles, programas y las 22 preguntas.
- **IA:** `POST /api/ia/chat` autenticado con `X-API-Key`, memoria de conversacion en MySQL por `sesion_id` e instrucciones del agente editables por API.

**No implementado todavia:** reportes PDF/Excel, autorizacion por rol (`[Authorize(Roles = ...)]`), auditoria, pantalla de login del panel (hoy el JWT se pega a mano en `localStorage`) y RAG sobre programas.

**Desvio conocido:** el perfil se calcula en el frontend, no en el backend. Es consciente y temporal — ver [docs/adr/0003](docs/adr/0003-calculo-riasec-en-el-frontend.md).

Detalle del contrato en [docs/api-contract.md](docs/api-contract.md) y del patron de repo en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).
