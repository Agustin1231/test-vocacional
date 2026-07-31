# Despliegue en producción (Coolify)

Cómo está montado el sistema en el servidor, qué URL usa cada servicio para
hablar con los demás y cómo probar cada endpoint sin equivocarse.

Este documento es el complemento operativo de [api-contract.md](api-contract.md):
allá está **qué** expone cada servicio, acá está **en qué dirección se le pega**.

Todo lo que sigue está verificado contra el servidor, no es teoría.

---

## 1. Qué hay desplegado

Servidor: `72.60.26.136`. Instancia Coolify: `coolify.agustinynatalia.site`,
proyecto `test-vocacional` (uuid `zjbc45w1prkq3totbnjsbl5v`), entorno
`production`. Los 4 componentes viven en la red Docker `coolify`.

| Componente | App en Coolify | URL pública | Puerto interno |
|---|---|---|---|
| Frontend (Angular + nginx) | `u14emf8b2wi99h70cn1044a6` | `https://test-vocacional.agustinynatalia.site` | 80 |
| Backend (.NET 8) | `naxzef248r1caanqcq719brd` | `https://back-tv.72.60.26.136.sslip.io` | 5000 |
| Servicio de IA (FastAPI) | `e10chwajo7f0dptnihtevztk` | `https://ia-testvocacional.72.60.26.136.sslip.io` | 8000 |
| MySQL 8 | `ccjq4iloe2o90pq1p3ogkcac` | (interno, ver sección 6) | 3306 |
| pgvector del RAG | **no es un recurso de Coolify** (`test-vocacional-rag`) | (interno, ver sección 10) | 5432 |

Las tres apps despliegan desde la rama `main` de este repo. Como el repo es
privado, Coolify clona con una **deploy key** SSH de solo lectura. Cada push a
`main` dispara redeploy automático por webhook.

Nota sobre los dominios `sslip.io`: `back-tv.72.60.26.136.sslip.io` resuelve a
`72.60.26.136` por DNS público, sin necesidad de registrar nada. Backend e IA
son **alcanzables desde internet**. La barrera del servicio de IA es su
`X-API-Key`; la del backend son sus rate limits, su CORS y el JWT en los
endpoints protegidos.

---

## 2. El recorrido real de una petición

```
navegador
   │  https://test-vocacional.agustinynatalia.site/api/ciudades
   ▼
Traefik (coolify-proxy)  ── TLS, rutea por Host ──►  nginx del frontend
                                                          │
                                    location ^~ /api/     │  https://coolify-proxy
                                    Host: back-tv...      │  (red interna)
                                                          ▼
                                                   Traefik otra vez
                                                          │
                                                          ▼
                                                    backend .NET
                                                     │        │
                                     X-API-Key       │        │  EF Core
                                                     ▼        ▼
                                            servicio de IA   MySQL
                                                     │
                                                     ▼
                                              Google Gemini
```

Puntos que importan:

- El navegador **solo** conoce el dominio del frontend. Nunca le pega directo al
  backend ni a la IA, y no carga ninguna API key.
- El salto frontend a backend **no** es DNS directo entre contenedores: pasa por
  Traefik. El porqué está en la sección 3.
- El backend hoy llama a la IA por su **URL pública** (`IA_BASE_URL`), es decir
  que el tráfico sale al proxy y vuelve. Funciona y está bien, pero se puede
  acortar (ver sección 8).

---

## 3. Regla de oro de la red interna

**No se puede usar el uuid de una app como hostname.** Es el error que ya nos
costó tiempo una vez.

Coolify nombra el contenedor de una app como `<uuid>-<timestamp>`, y ese
timestamp **cambia en cada redeploy**:

```
naxzef248r1caanqcq719brd-203938301989   <- backend
u14emf8b2wi99h70cn1044a6-203513362779   <- frontend
e10chwajo7f0dptnihtevztk-200356020157   <- servicio de IA
```

El único alias de red de cada contenedor es ese nombre completo. Un
`http://naxzef248r1caanqcq719brd:5000` **no resuelve** (comprobado: el DNS de
Docker devuelve "no existe"), y aunque se usara el nombre completo con
timestamp, se rompería en el siguiente deploy.

**La forma correcta de que una app le hable a otra es a través de Traefik**, que
sí tiene alias estables en la red `coolify`: `coolify-proxy` y `traefik`.

```
https://coolify-proxy       + header  Host: <FQDN del destino>
```

Traefik recibe la petición y la rutea al contenedor que tenga ese FQDN
configurado, sin importar cómo se llame el contenedor hoy.

Dos requisitos cuando se hace esto desde nginx con la URL en una variable:

- `proxy_ssl_server_name on` para que se envíe el SNI correcto en el handshake.
- `proxy_ssl_verify off` porque Traefik presenta su certificado por defecto ante
  un SNI que no reconoce.

La **excepción** es MySQL: su contenedor se llama exactamente igual que su uuid
(`ccjq4iloe2o90pq1p3ogkcac`, sin sufijo), así que ese sí sirve como hostname
estable y es lo que usan backend e IA en `DB_HOST`.

---

## 4. Tabla de direcciones internas

| Desde | Hacia | URL a usar | Headers obligatorios |
|---|---|---|---|
| navegador | backend | `/api/...` (relativo, mismo dominio) | ninguno, salvo `Authorization: Bearer <JWT>` en los protegidos |
| frontend (nginx) | backend | `https://coolify-proxy` | `Host: back-tv.72.60.26.136.sslip.io` |
| backend | IA | `https://ia-testvocacional.72.60.26.136.sslip.io` | `X-API-Key: <IA_API_KEY>`, `X-Cliente-IP: <ip del navegador>` |
| backend | MySQL | `ccjq4iloe2o90pq1p3ogkcac:3306` | credenciales de `DB_*` |
| IA | MySQL | `ccjq4iloe2o90pq1p3ogkcac:3306` | credenciales de `DB_*` |
| cualquier app | otra app (genérico) | `https://coolify-proxy` | `Host: <FQDN del destino>` |

El `X-Cliente-IP` no es decorativo: es la clave con la que el servicio de IA
particiona su rate limit. Sin ese header, todos los estudiantes comparten una
sola cubeta, porque para la IA el único cliente TCP es el contenedor del backend.

---

## 5. Cómo probar cada cosa

### Desde afuera (tu máquina)

```bash
# Frontend
curl -I https://test-vocacional.agustinynatalia.site

# Backend directo
curl https://back-tv.72.60.26.136.sslip.io/health
# {"status":"ok"}

# Backend a través del frontend, que es la ruta que usa la app de verdad.
# Si esto falla pero el anterior funciona, el problema es el proxy de nginx.
curl https://test-vocacional.agustinynatalia.site/api/ciudades

# Servicio de IA
curl https://ia-testvocacional.72.60.26.136.sslip.io/health

# Chat de IA directo (requiere la clave compartida, cuerpo en snake_case)
curl -X POST https://ia-testvocacional.72.60.26.136.sslip.io/api/ia/chat \
  -H "X-API-Key: $SERVICE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"texto":"hola","sesion_id":"prueba-1"}'

# Chat de IA como lo llama el navegador (camelCase, sin clave)
curl -X POST https://test-vocacional.agustinynatalia.site/api/ia/chat \
  -H "Content-Type: application/json" \
  -d '{"texto":"hola","sesionId":"prueba-1"}'
```

Ojo con el cuerpo del chat: el navegador manda `sesionId` y el servicio de IA
espera `sesion_id`. La traducción la hace el backend. Pegarle directo a la IA
con `sesionId` devuelve `422`.

### Desde adentro de la red

```bash
# Comprobar el salto interno tal como lo hace nginx
docker exec <contenedor-del-frontend> \
  wget -qO- --no-check-certificate \
  --header="Host: back-tv.72.60.26.136.sslip.io" \
  https://coolify-proxy/health

# Nombre real del contenedor (cambia en cada deploy)
docker ps --format '{{.Names}}' | grep u14emf8b2wi99h70cn1044a6
```

---

## 6. Base de datos

Una sola base, `test_vocacional`, compartida por backend y servicio de IA. El
backend es dueño del esquema de negocio (EF Core) y la IA solo escribe sus
tablas (`agente_instrucciones`, memoria de conversación por `sesion_id`).

- **Host interno:** `ccjq4iloe2o90pq1p3ogkcac`, puerto `3306`.
- **Usuario:** `mysql`. La contraseña vive en las variables de entorno de cada
  app, no en el repo.

**Acceso externo: hoy está CERRADO.** El contenedor no publica ningún puerto en
el host (`docker inspect` devuelve `PortBindings: map[]`), así que la base solo se
alcanza desde la red `coolify`. Para conectar DBeaver hay que reactivarlo en
Coolify (*Database → Settings → Public port*), y apagarlo al terminar.

Cuando se reactiva se usa `72.60.26.136:5436`, no el 5432 habitual, porque ese
puerto ya lo ocupa el Postgres interno de Coolify. En el cliente hay que poner
`allowPublicKeyRetrieval=true` y `useSSL=false`, si no MySQL 8 rechaza la
conexión con "Public Key Retrieval is not allowed".

**Versión real del servidor:** `8.4.10`. La app en Coolify usa la etiqueta
`mysql:8`, igual que `infra/docker-compose.yml`, así que local y producción
coinciden. `sql_mode` y charset son los de fábrica de esa imagen
(`utf8mb4` / `utf8mb4_0900_ai_ci`, `STRICT_TRANS_TABLES`).

El usuario de aplicación es `mysql@%` y sus permisos son exactamente
`GRANT ALL PRIVILEGES ON test_vocacional.*` (más `USAGE` global): no es
superusuario del servidor.

---

## 7. Variables que gobiernan el routing

Solo las que afectan cómo se encuentran los servicios entre sí. El listado
completo está en el `.env.example` de cada carpeta.

**Frontend**

| Variable | Valor en producción | Valor local (docker-compose) |
|---|---|---|
| `BACKEND_URL` | `https://coolify-proxy` | `http://backend:5000` |
| `BACKEND_HOST` | `back-tv.72.60.26.136.sslip.io` | `backend` |

`nginx.conf` es una **plantilla**: el entrypoint de la imagen de nginx corre
`envsubst` al arrancar y reemplaza esas dos variables. Por eso el `proxy_pass`
usa una variable de nginx y no un hostname literal: con un literal, nginx
resolvería el DNS al arrancar y el contenedor no levantaría cuando el backend no
existe en su red. Con variable, la resolución es por request y un backend caído
da 502 en `/api` pero la SPA se sigue sirviendo.

**Backend**

| Variable | Valor en producción |
|---|---|
| `IA_BASE_URL` | `https://ia-testvocacional.72.60.26.136.sslip.io` |
| `IA_API_KEY` | la misma cadena que `SERVICE_API_KEY` del servicio de IA |
| `IA_TIMEOUT_SEGUNDOS` | `110`, por debajo del `proxy_read_timeout` de 120 s de nginx |
| `CORS_ORIGINS` | `https://test-vocacional.agustinynatalia.site` |
| `ASPNETCORE_URLS` | `http://+:5000` |
| `DB_HOST` / `DB_PORT` | `ccjq4iloe2o90pq1p3ogkcac` / `3306` |

`IA_API_KEY` (backend) y `SERVICE_API_KEY` (IA) **son la misma clave**. Si se
rota una hay que rotar la otra en el mismo momento, o el chat empieza a devolver
`503`.

El healthcheck de Docker del backend está **deshabilitado** a propósito: la
imagen base no trae `curl` ni `wget`, así que el healthcheck fallaba y Coolify
marcaba el contenedor como unhealthy aunque respondiera bien. El `/health` del
backend sigue existiendo y funcionando por HTTP.

**Servicio de IA**

| Variable | Valor en producción |
|---|---|
| `SERVICE_API_KEY` | clave compartida con el backend |
| `LLM_PROVIDER` | `google` |
| `GOOGLE_MODEL` | `gemini-flash-lite-latest` |
| `RATE_LIMIT` | `20/minute`, particionado por `X-Cliente-IP` |
| `APP_PORT` | `8000` |
| `DB_HOST` / `DB_PORT` | `ccjq4iloe2o90pq1p3ogkcac` / `3306` |
| `VECTOR_STORE_URL` | `postgresql+psycopg://rag:<password>@test-vocacional-rag:5432/rag` (base del RAG, sección 10) |

`VECTOR_STORE_URL` es la única variable nueva que exige el RAG; las demás `RAG_*`
tienen default en el código. Si queda vacía, el servicio arranca y responde igual
pero **sin** la herramienta de búsqueda en los documentos.

Cambiar de proveedor de modelo es cambiar variables de este servicio. Backend y
frontend no se enteran.

---

## 8. Redeploy

Push a `main` redespliega las tres apps solo, por webhook. Coolify construye la
imagen y la etiqueta con el SHA del commit, así que se puede verificar qué
versión está corriendo:

```bash
docker inspect <contenedor> --format '{{.Config.Image}}'
# u14emf8b2wi99h70cn1044a6:7a3e10066b32f2bfc00fb75a8f009fd56d77236e
```

Cada app tiene su `base_directory` (`/frontend`, `/backend`, `/ia`), pero Coolify
reconstruye las tres ante cualquier push. Que una app corra un SHA anterior no
es un problema si su carpeta no cambió desde entonces; se confirma con
`git diff --stat <sha-desplegado>..main -- <carpeta>`.

### Cómo está armado el auto-deploy (y por qué así)

El repo es privado y Coolify entra por **deploy key**, no por GitHub App. En ese
modo el webhook es el endpoint "manual":

```
https://coolify.agustinynatalia.site/webhooks/source/github/events/manual
```

Ese endpoint busca **todas** las apps con el mismo repositorio y la misma rama, y
después valida la firma `X-Hub-Signature-256` **contra el secret de cada app**
(`manual_webhook_secret_github`, distinto en cada una). Consecuencia que no es
obvia: un solo webhook de GitHub **no puede desplegar las tres apps**, porque su
secret solo cuadra con una y las otras dos se descartan con
`{"status":"failed","message":"Invalid signature."}`.

Por eso hay **tres webhooks en GitHub**, todos a la misma URL y con el mismo
evento `push`, cada uno cargando el secret de una app. Cada entrega despliega su
app y falla la firma en las otras dos: eso es lo esperado, no un error.

Además cada app necesita el flag **`is_auto_deploy_enabled`** en verdadero
(en la UI, *Settings → Auto Deploy*). Si está apagado, Coolify recibe el webhook,
valida la firma y **no hace nada, sin avisar**. Es el modo de falla más
traicionero que tiene esto.

Verificar una entrega sin tener que hacer un commit de mentira:

```bash
# Dispara una entrega de prueba (GitHub reenvía el último push real)
gh api -X POST repos/Agustin1231/test-vocacional/hooks/<HOOK_ID>/tests

# Leer qué contestó Coolify
id=$(gh api repos/Agustin1231/test-vocacional/hooks/<HOOK_ID>/deliveries --jq '.[0].id')
gh api repos/Agustin1231/test-vocacional/hooks/<HOOK_ID>/deliveries/$id --jq '.response.payload'
# Esperado: un {"status":"success","message":"Deployment queued."} y dos "Invalid signature."
```

`watch_paths` se dejó **vacío a propósito** en las tres apps. Limitarlo a
`frontend/**`, `backend/**` e `ia/**` ahorraría builds, pero reintroduce el mismo
modo de falla silenciosa: un patrón mal puesto y los pushes dejan de desplegar
sin que nadie se entere. Se prefiere reconstruir de más.

**Mejora pendiente, opcional.** El backend llama a la IA por su URL pública, o
sea que el tráfico sale al proxy y vuelve a entrar. Se puede acortar poniendo
`IA_BASE_URL=https://coolify-proxy` y agregando el header `Host:
ia-testvocacional.72.60.26.136.sslip.io`, igual que hace el frontend. Ya está
comprobado que ese camino responde. Requiere tocar el `HttpClient` del backend
para que mande el Host header, así que no se hizo todavía.

---

## 9. Reproducir producción en local (espejo)

Para depurar algo que solo se ve en el despliegue, conviene levantar el stack
local con los **valores reales** de las apps de Coolify en lugar de valores de
juguete. Verificado el 2026-07-31 contra el commit `5b5409a`.

Qué se copia tal cual y qué **no puede** copiarse:

| Variable | Local | Por qué difiere |
|---|---|---|
| `DB_HOST` (backend e IA) | `mysql` | En producción es el nombre del contenedor de la base; acá es el nombre del servicio del compose. |
| `IA_BASE_URL` (backend) | `http://ia:8000` | En producción sale al proxy y vuelve; local se alcanza por la red del compose. |
| `CORS_ORIGINS` (backend) | `http://localhost:8080` | El origen del frontend cambia de dominio. |
| `BACKEND_URL` / `BACKEND_HOST` (frontend) | `http://backend:5000` / `backend` | Local no tiene Traefik: se le pega directo al backend en vez de rutear por Host header. |
| `VECTOR_STORE_URL` (IA) | `postgresql+psycopg://rag:...@ragdb:5432/rag` | En producción el host es `test-vocacional-rag`; local es el servicio `ragdb` del compose. La inyecta el compose desde `RAG_DB_PASSWORD` de `infra/.env`. |

Todo lo demás se copia sin tocar: `JWT_*`, `IA_API_KEY`/`SERVICE_API_KEY`,
`GOOGLE_API_KEY`, `GOOGLE_MODEL`, `IA_TIMEOUT_SEGUNDOS`, `RATE_LIMIT`,
`ADMIN_SEED_*` y las credenciales de base. Así el panel local se abre con las
mismas credenciales de administrador y el chat usa el mismo modelo.

Leer las variables reales de una app sin pasar por la UI:

```bash
docker inspect <contenedor> --format '{{range .Config.Env}}{{println .}}{{end}}'
```

Copiar la base (deja el espejo con los mismos datos que producción):

```bash
# En el servidor: volcar
docker exec ccjq4iloe2o90pq1p3ogkcac sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot \
   --single-transaction --no-tablespaces --routines --triggers test_vocacional' > dump.sql

# En local: restaurar ANTES de levantar el backend
docker compose -f infra/docker-compose.yml up -d mysql
docker exec -i infra-mysql-1 sh -c \
  'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot test_vocacional' < dump.sql
docker compose -f infra/docker-compose.yml up --build -d
```

El orden importa: con `__EFMigrationsHistory` ya restaurado, el backend arranca y
loguea `No migrations were applied` y `DbSeeder` no vuelve a sembrar nada — ni un
segundo administrador. Si se levanta el backend primero, siembra los catálogos y
después el `dump.sql` choca con esas filas.

**El dump lleva datos personales de estudiantes reales** (nombre, correo,
celular, documento). Es una copia de producción en un disco de trabajo: borrarla
al terminar y no dejarla en el repo (ningún patrón del `.gitignore` cubre un
`.sql`).

Cómo comprobar que el espejo quedó fiel:

```bash
# Los catálogos tienen que salir byte a byte iguales
diff <(curl -s http://localhost:8080/api/ciudades) \
     <(curl -s https://test-vocacional.agustinynatalia.site/api/ciudades)

# El bundle de Angular tiene que tener el mismo hash si es el mismo commit
curl -s http://localhost:8080/ | grep -oE 'main-[A-Z0-9]+\.js'

# El nginx efectivo solo debe diferir en BACKEND_URL y BACKEND_HOST
docker exec infra-frontend-1 cat /etc/nginx/conf.d/default.conf
```

---

## 10. La base pgvector del RAG (creada a mano, NO la administra Coolify)

La base de documentos del agente (ver [ADR 0004](adr/0004-rag-en-pgvector.md)) es el
único componente del sistema que **no es un recurso de Coolify**. Se creó por SSH
como contenedor docker suelto, el 2026-07-31.

| Dato | Valor |
|---|---|
| Contenedor / hostname interno | `test-vocacional-rag` |
| Imagen | `pgvector/pgvector:pg17` (Postgres 17.10, pgvector 0.8.3) |
| Red | `coolify` (la misma que las tres apps) |
| Base / usuario | `rag` / `rag` |
| Volumen | `test-vocacional-rag-data` |
| Puertos publicados | **ninguno** |
| Política de reinicio | `unless-stopped` |

A diferencia de las apps, acá el **nombre del contenedor es el hostname** y no
cambia nunca (no hay sufijo de timestamp, porque no hay redeploy que lo recree). Es
el mismo caso que el MySQL: sirve directo como `host` en la URL de conexión.

**Lo que se pierde por no estar en Coolify, y hay que tener presente:**

- No aparece en el panel de Coolify: quien mire ahí no se entera de que existe.
- **Coolify no le hace backup.** Hace backups programados de las bases que
  administra; esta no. Como el PDF original solo vive acá dentro, se le puso un
  backup propio por cron: ver *Backup* más abajo.
- La limpieza de docker de Coolify poda volúmenes sin usar. El volumen está
  montado en un contenedor con `restart: unless-stopped`, así que en condiciones
  normales no corre riesgo; pero si el contenedor queda detenido un rato largo, sí.
- Actualizar la imagen es manual.

Migrarla a un recurso de Coolify más adelante es posible sin tocar código: se crea
la base en la UI, se hace `pg_dump | psql` de una a la otra y se cambia
`VECTOR_STORE_URL`.

### Cómo se creó (para poder rehacerla)

```bash
docker volume create test-vocacional-rag-data
docker run -d \
  --name test-vocacional-rag \
  --network coolify \
  --restart unless-stopped \
  --label "proyecto=test-vocacional" \
  --label "gestionado-por=manual-ssh-no-coolify" \
  -e POSTGRES_DB=rag -e POSTGRES_USER=rag -e POSTGRES_PASSWORD='<password>' \
  -v test-vocacional-rag-data:/var/lib/postgresql/data \
  --health-cmd 'pg_isready -U rag -d rag' \
  --health-interval 10s --health-timeout 5s --health-retries 10 --health-start-period 30s \
  pgvector/pgvector:pg17
```

El esquema (`CREATE EXTENSION vector`, las dos tablas y el índice `hnsw`) **no se
crea a mano**: lo hace `ia/app/rag/store.py` al arrancar el servicio, y lo reintenta
en la primera operación si la base todavía no estaba lista.

### Variable que hay que agregarle a la app de IA

En Coolify, app `test-vocacional-ia` → *Environment Variables*:

```
VECTOR_STORE_URL=postgresql+psycopg://rag:<password>@test-vocacional-rag:5432/rag
```

Es la única obligatoria; el resto de las `RAG_*` tienen default en el código (ver
`ia/.env.example`). Mientras esa variable esté vacía, el servicio arranca igual y el
asesor responde igual, solo que sin la herramienta de búsqueda: es la degradación
buscada, no una falla.

### Backup

Cron diario en el servidor (03:15 hora de Colombia), fuera de este repo:
`pg_dump -Fc` a `~/.rocky/backups/test-vocacional-rag/`, 14 días de retención y
aviso por Telegram solo si falla. El dump incluye los PDF originales (`bytea`),
así que restaurarlo devuelve los documentos sin tener que volver a subirlos.

```bash
# Restaurar sobre la base vacía
sudo docker exec -i test-vocacional-rag pg_restore -U rag -d rag < rag.<fecha>.dump

# Restaurar encima de datos existentes
sudo docker exec -i test-vocacional-rag pg_restore -U rag -d rag --clean < rag.<fecha>.dump
```

**Ojo con la versión de `pg_restore`.** El contenedor corre Postgres 17 y el
servidor tiene los clientes 16, que **no abren** los dumps que escribe el
`pg_dump` 17 (`unsupported version in file header`). Tanto para verificar como
para restaurar hay que usar el binario de adentro del contenedor, como en los
comandos de arriba.

Probado el 2026-07-31 borrando las dos tablas y restaurando: vuelven los
documentos, los fragmentos, el PDF en `bytea` y el índice `hnsw`, y la búsqueda
del agente sigue respondiendo con la cita correcta.

### Comprobar que quedó bien

```bash
# La base responde y tiene la extensión
docker exec test-vocacional-rag psql -U rag -d rag -tAc "SELECT extversion FROM pg_extension WHERE extname='vector';"

# El servicio de IA la resuelve por nombre (el DNS de la red coolify)
docker exec <contenedor-de-ia> python -c "import socket; print(socket.gethostbyname('test-vocacional-rag'))"

# Estado del RAG visto por el servicio de IA
docker exec <contenedor-de-ia> python -c "
from app.rag import store; print(store.estado())"
```

---

## 11. Errores típicos y qué significan

| Síntoma | Causa probable |
|---|---|
| `502` en `/api/...` desde el navegador | El backend está caído o `BACKEND_URL` / `BACKEND_HOST` quedaron mal. La SPA sigue cargando, solo muere la API. |
| `404` en `/api/...` pero el backend responde en su dominio | El `Host` header que manda nginx no coincide con el FQDN que Traefik conoce. |
| El contenedor del frontend no arranca | Se puso un hostname literal en `proxy_pass` en lugar de la variable. |
| `503` en el chat, `{"mensaje":"El asesor IA no está disponible..."}` | Falla el salto backend a IA: `IA_BASE_URL` mal, claves desalineadas, o timeout. El detalle está en el log del backend, nunca se le devuelve al cliente. |
| `401` pegándole directo a la IA | Falta o no coincide `X-API-Key`. |
| `422` pegándole directo a la IA | Se mandó `sesionId` en lugar de `sesion_id`. |
| `429` | Rate limit. Backend: global 120/min por IP, login 10/min, público 30/min. IA: 20/min por `X-Cliente-IP`. |
| "Public Key Retrieval is not allowed" en DBeaver | Falta `allowPublicKeyRetrieval=true` en el driver. |
| Un hostname interno dejó de resolver tras un deploy | Se usó el nombre del contenedor con timestamp. Usar `coolify-proxy` con Host header. |
| El asesor dice que no tiene un dato que **sí** está en el PDF subido | Puede ser que la similitud no llegue a `RAG_MIN_SIMILITUD` (subir el PDF con mejor texto, o bajar el umbral), o que el documento tenga `fragmentos: 0` en el panel (PDF escaneado). |
| El panel muestra 0 documentos y un error al listar | El servicio de IA no alcanza la base pgvector: revisar `VECTOR_STORE_URL` y que `test-vocacional-rag` esté corriendo (sección 10). |
| La subida de un PDF falla con `413` sin llegar al backend | Es nginx: `client_max_body_size` en `frontend/nginx.conf`. Los tres límites en cadena están en `api-contract.md`. |
| El asesor responde de memoria en vez de citar el documento | Falta la política de herramientas o el RAG está apagado. Con `VECTOR_STORE_URL` vacía la herramienta no se le ofrece al modelo y no hay ningún error visible: se ve en el log de arranque (`RAG: desactivado`). |
| Se mergeó a `main` y la app sigue con el código viejo, sin ningún error | El auto-deploy no se disparó: webhook inactivo, secret que no cuadra con esa app, o `is_auto_deploy_enabled` apagado. Ver sección 8. |
| `POST /api/resultados` da `200` pero las FKs quedan en `null` | El texto enviado no existe tal cual en el catálogo. El acople es por texto exacto; ver `api-contract.md`. |
