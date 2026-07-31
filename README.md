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

## Produccion

El sistema esta desplegado en Coolify: frontend en **https://test-vocacional.agustinynatalia.site**, backend y servicio de IA en dominios propios, y un MySQL compartido. Cada push a `main` redespliega solo.

Que URL usa cada servicio para hablar con los demas dentro del servidor, que headers son obligatorios, por que el uuid de una app no sirve como hostname y como probar cada endpoint: **[docs/DESPLIEGUE.md](docs/DESPLIEGUE.md)**. Leerlo antes de tocar variables de entorno o de agregar una llamada entre servicios.

Lo que falta para cerrar la integracion, con el archivo donde se toca cada cosa: **[docs/PENDIENTES.md](docs/PENDIENTES.md)**.

## Stack

- Frontend: Angular 18 (SPA servida por nginx, que ademas proxea `/api` al backend)
- Backend: .NET 8 Web API (Clean Architecture, EF Core)
- Base de datos: MySQL 8 (una sola base para backend y servicio de IA)
- IA: servicio Python (FastAPI + LangGraph), consumido solo por el backend
- RAG: PostgreSQL + pgvector, una base **aparte** con los PDF de la institucion y sus embeddings (ver [docs/adr/0004](docs/adr/0004-rag-en-pgvector.md))

## Levantar todo junto (local)

`infra/docker-compose.yml` es la **unica** orquestacion del repo (el `backend/docker-compose.yml` se elimino). Levanta los 5 servicios: frontend, backend, ia, mysql y `ragdb` (la base pgvector del RAG).

Antes de arrancar:

1. `cp backend/.env.example backend/.env` y completarlo. Ojo: `DB_HOST=mysql` (no `localhost`), `DB_USER`/`DB_PASSWORD` iguales a `MYSQL_USER`/`MYSQL_PASSWORD` del paso 3, y `JWT_SIGNING_KEY` de **32 caracteres o mas** (si es mas corta el backend no arranca).
2. `cp ia/.env.example ia/.env` y completarlo (`DB_HOST=mysql`, las mismas credenciales de base + la API key del proveedor del modelo).
3. Crear `infra/.env` (no se commitea) con las cinco variables que el compose exige y que **no tienen valor por defecto**:

```
MYSQL_ROOT_PASSWORD=...   # password de root de MySQL
MYSQL_USER=mysql          # usuario de aplicacion (el mismo nombre que en produccion)
MYSQL_PASSWORD=...        # password de ese usuario
IA_API_KEY=...            # clave compartida backend <-> ia
RAG_DB_PASSWORD=...       # password del Postgres/pgvector del RAG (alfanumerica: va dentro de una URL)
```

Si falta alguna, el compose falla ruidosamente en vez de levantar una base con password conocida o una IA sin autenticar. `IA_API_KEY` se inyecta en los dos lados desde una sola variable: al backend como `IA_API_KEY` y a la IA como `SERVICE_API_KEY`.

`MYSQL_USER` existe para que local use un usuario de aplicacion con permisos solo sobre `test_vocacional`, igual que produccion, en lugar de correr todo como `root`. Se aplica **solo al inicializar el volumen**: si ya tenias `infra_mysql_data` de antes, hay que rehacerlo con `docker compose -f infra/docker-compose.yml down -v`.

```bash
docker compose -f infra/docker-compose.yml up --build
```

Queda expuesto al host solo el frontend en **http://localhost:8080**. El backend se publica unicamente en loopback (`127.0.0.1:5000`, para depurar: saltear nginx tambien saltea el `X-Forwarded-For` con el que se aplica el rate limit). La IA y MySQL solo se alcanzan por la red interna.

Cada servicio tambien se puede levantar solo desde su carpeta (ver su `README.md`); para eso no hace falta Docker.

Para depurar algo que solo se ve en el despliegue, se puede levantar este mismo compose con los valores reales de las apps de Coolify y una copia de la base: **[docs/DESPLIEGUE.md](docs/DESPLIEGUE.md), seccion 9**.

## Equipo

- Backend: Juan, Santiago
- Frontend: Natalia
- IA e integracion: Agustin

## Estado

Los 4 servicios estan implementados e integrados entre si (rama `integracion`).

**Funciona hoy:**

- **Frontend:** flujo completo (avatar → datos → quiz de 22 preguntas → resultado → asesor IA) + panel `admin` con login (metricas, informes, preguntas, agente IA y documentos del RAG). Calcula el perfil en el navegador y envia el informe al backend.
- **Backend:** login con JWT, catalogos (`/api/ciudades`, `/api/grados`, `/api/tipos-documento`), `GET /api/preguntas`, `POST /api/resultados` (publico, transaccional), `GET /api/resultados` (protegido), `POST /api/ia/chat` (proxy hacia la IA), `GET`/`PUT /api/ia/instrucciones` (proxy protegido, solo administrador), `GET /health`, CORS y rate limit por IP. Al arrancar aplica las migraciones de EF Core y siembra catalogos, perfiles, programas y las 22 preguntas.
- **IA:** `POST /api/ia/chat` autenticado con `X-API-Key`, memoria de conversacion en MySQL por `sesion_id`, instrucciones del agente editables por API y **RAG sobre los documentos de la institucion**: el equipo sube el plan de estudios en PDF desde el panel y el agente lo consulta con una herramienta que el modelo decide cuando llamar, citando documento y pagina.

**No implementado todavia:** reportes PDF/Excel y auditoria (`Auditoria` existe como entidad pero nadie escribe en ella). Del RAG faltan re-indexar y descargar un documento ya subido (ver [docs/adr/0004](docs/adr/0004-rag-en-pgvector.md)).

**Desvio conocido:** el perfil se calcula en el frontend, no en el backend. Es consciente y temporal — ver [docs/adr/0003](docs/adr/0003-calculo-riasec-en-el-frontend.md).

Detalle del contrato en [docs/api-contract.md](docs/api-contract.md) y del patron de repo en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).
