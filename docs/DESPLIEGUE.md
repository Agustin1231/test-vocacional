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

**Acceso externo (temporal).** Para conectar DBeaver u otro cliente, la base se
expuso en `72.60.26.136:5436`. Se usó 5436 y no el 5432 habitual porque ese
puerto ya lo ocupa el Postgres interno de Coolify. En el cliente hay que poner
`allowPublicKeyRetrieval=true` y `useSSL=false`, si no MySQL 8 rechaza la
conexión con "Public Key Retrieval is not allowed".

Este acceso público debería quedar apagado cuando no se esté usando.

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

## 9. Errores típicos y qué significan

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
| Se mergeó a `main` y la app sigue con el código viejo, sin ningún error | El auto-deploy no se disparó: webhook inactivo, secret que no cuadra con esa app, o `is_auto_deploy_enabled` apagado. Ver sección 8. |
| `POST /api/resultados` da `200` pero las FKs quedan en `null` | El texto enviado no existe tal cual en el catálogo. El acople es por texto exacto; ver `api-contract.md`. |
