# Arquitectura y organización del repositorio

Este documento explica **cómo está organizado el repositorio y por qué**. Es la
referencia para cualquier persona que se suma al proyecto y necesita entender
dónde va su código y cómo se comunica con el resto.

> **Sobre el documento de arquitectura del equipo:** el detalle técnico del
> producto (capas, decisiones de stack, seguridad, despliegue) está en un
> documento de arquitectura **externo y no versionado** en este repo (el
> `arquitectura.pdf` que circula por el equipo; en `docs/` no existe ningún PDF).
> Si necesitás algo de ahí, pedíselo al equipo. Todo lo que hace falta para
> trabajar en el repo está en este `.md` y en `docs/api-contract.md`; cuando este
> documento y el PDF no coincidan, acá se aclara explícitamente cuál es el desvío
> y por qué (ver [ADR 0003](adr/0003-calculo-riasec-en-el-frontend.md)).

---

## El patrón: monorepo por servicios, *contract-first*

Un solo repositorio, con **una carpeta autocontenida por servicio**. Las piezas
se comunican **exclusivamente por un contrato REST** (`docs/api-contract.md`),
nunca por dentro del código de la otra.

```
test-vocacional/
├── docs/          # documentación compartida + contrato de API + decisiones (ADR)
├── frontend/      # Angular (SPA)              — Natalia
├── backend/       # .NET 8 Clean Architecture  — Juan, Santiago
├── ia/            # servicio Python LangGraph  — Agustín
├── infra/         # orquestación (docker-compose) para levantar todo junto
└── referencia/    # HTML de referencia del test
```

Cada carpeta de servicio es "dueña" de sí misma: su propio `Dockerfile`, su
`README.md`, su `.env.example` y sus tests. **Nadie mete mano en la carpeta de
otro.** El único punto de acuerdo compartido es el contrato de API.

---

## Por qué este patrón (y no otro)

| Alternativa | Por qué **no** |
|---|---|
| **Repos separados (microservicios "de verdad")** | Overhead que un equipo de 4 no necesita: 4 pipelines, 4 controles de acceso, versionado cruzado. La separación se logra con carpetas, sin ese costo. |
| **Monolito con la IA adentro del backend** | Rompe el desacople que el frontend ya tiene, ata todo a un solo lenguaje y hace que un cambio de modelo obligue a tocar el backend. La IA en Python vive aparte. |
| **Todo en una carpeta sin límites claros** | Nadie sabe dónde empieza y termina su responsabilidad; los merges chocan constantemente. |

**Ventajas del patrón elegido:**

- **Trabajo en paralelo real.** Mientras el contrato no cambie, cada quien avanza
  en su carpeta sin bloquear a los demás. Los merges casi no chocan porque cada
  uno toca archivos distintos.
- **Desacople por contrato.** Tras la integración, el navegador habla **solo con
  el backend**: `apiUrl = /api` y `aiChatUrl = /api/ia/chat`, que también es del
  backend (hace de proxy hacia la IA). En desarrollo las dos apuntan a
  `http://localhost:5000`. El frontend no conoce la URL ni la API key del
  servicio de IA.
- **Encaja 1:1 con el despliegue en Coolify:** cada carpeta = un recurso/app en
  Coolify, cada una con su `Dockerfile`.
- **Onboarding simple:** clonás, entrás a tu carpeta, leés su `README` y arrancás.

---

## Las 5 reglas que hacen que funcione

1. **`docs/api-contract.md` es la fuente de verdad.** Define cada endpoint, su
   request/response y ejemplos. Cambiar el contrato es un PR que se discute entre
   los servicios afectados; cambiar el código interno de tu servicio es tu
   problema y no molesta a nadie.

2. **Cada carpeta de servicio se levanta sola:** `Dockerfile` + `README` con
   "cómo correr en local" + `.env.example` con las variables necesarias (sin
   valores reales). El `.env` real **nunca** se commitea.

3. **`infra/docker-compose.yml` es la ÚNICA orquestación del repo.** Levanta los
   4 servicios juntos (frontend, backend, ia, mysql) para probar la integración
   real en una sola máquina. Por eso se **eliminó** el `backend/docker-compose.yml`
   que existía: dos composes describiendo el mismo servicio se desincronizan al
   primer cambio (puertos, variables, red, healthcheck) y nadie sabe cuál refleja
   la verdad. Una carpeta de servicio aporta su `Dockerfile`; **cómo se conectan
   los servicios entre sí se define en un solo lugar.** Si necesitás correr un
   servicio suelto, usá su `README` (`dotnet run`, `uvicorn`, `npm start`) o su
   `Dockerfile` a mano, no un compose paralelo.

4. **Ramas por servicio/feature.** `main` siempre desplegable. Se trabaja en
   ramas tipo `feature/backend-auth`, `feature/ia-rag`, `frontend-natalia`, y se
   integra por PR.

5. **`docs/adr/` para las decisiones abiertas.** Un archivo corto por decisión
   (contexto → decisión → consecuencias). Evita re-discutir lo mismo en tres
   lugares distintos.

---

## Flujo de comunicación

```
Estudiante ──HTTPS──> frontend (Angular servido por nginx)
                          │
                          │  nginx proxea /api/*  ──►  backend
                          ▼
                       backend (.NET 8)  ──────────────►  MySQL
                          │   REST interno + X-API-Key
                          ▼
                       ia (Python / FastAPI + LangGraph) ──► MySQL
                          │                                  (memoria e
                          │  API key del LLM                  instrucciones)
                          ▼
                       proveedor del modelo (Google Gemini u OpenRouter)
```

- **frontend → backend:** REST. JWT (`Authorization: Bearer`) solo en los
  endpoints protegidos (`GET /api/resultados`); el flujo del estudiante
  (catálogos, `POST /api/resultados`, `POST /api/ia/chat`) es público y está
  limitado por IP.
- **backend → ia:** REST por la red privada de Docker, con `X-API-Key`. El
  backend traduce `sesionId` → `sesion_id`. La IA **nunca** se expone al
  navegador (en el compose no tiene `ports` publicados).
- **backend → MySQL** y **ia → MySQL:** la misma base. El backend administra el
  esquema del test (migraciones de EF Core); el servicio de IA crea y usa sus
  propias tablas (`conversacion_memoria`, `agente_instrucciones`).
- **ia → proveedor del modelo:** la API key del LLM vive solo en el servicio de
  IA. El frontend no guarda ninguna clave.
- **Fuera de este flujo:** los endpoints de instrucciones del agente
  (`GET`/`PUT /api/ia/instrucciones`) se administran directo contra el servicio de
  IA con la clave compartida. El backend no los expone.
