# Documentación del Frontend — Brújula Vocacional UNIAGRARIA

Frontend Angular (SPA) del Test Vocacional. Aplica un test de 22 preguntas,
calcula el perfil del estudiante de forma **determinística** y lo direcciona
hacia los programas de pregrado reales de UNIAGRARIA, con un asesor académico
basado en IA.

Es el servicio `frontend/` dentro del monorepo por servicios *contract-first*
del proyecto (ver [`../docs/ARQUITECTURA.md`](../docs/ARQUITECTURA.md) y el
[contrato de API](../docs/api-contract.md)). Se comunica con el resto **solo por
REST**, sin conocer su implementación.

---

## 1. Tabla de contenido

1. [Stack y decisiones](#2-stack-y-decisiones)
2. [Cómo ejecutarlo](#3-cómo-ejecutarlo)
3. [Arquitectura de carpetas](#4-arquitectura-de-carpetas)
4. [Flujo de pantallas (rutas)](#5-flujo-de-pantallas-rutas)
5. [Estado global (signals)](#6-estado-global-signals)
6. [Servicios (capa `core`)](#7-servicios-capa-core)
7. [Datos del test](#8-datos-del-test)
8. [Lógica de puntaje y desempates](#9-lógica-de-puntaje-y-desempates)
9. [Integración con backend / IA (contrato)](#10-integración-con-backend--ia-contrato)
10. [Sistema de diseño](#11-sistema-de-diseño)
11. [Despliegue](#12-despliegue)
12. [Cómo extender](#13-cómo-extender)

---

## 2. Stack y decisiones

| Pieza | Elección | Por qué |
|---|---|---|
| Framework | **Angular 18** (standalone components) | Sin NgModules; cada componente declara sus propios `imports`. |
| Estado | **Signals** (`@angular/core`) | Estado reactivo simple, sin librerías externas (NgRx sería overkill). |
| Ruteo | Router con **lazy-loading** (`loadComponent`) | Cada pantalla es un chunk que se carga bajo demanda. |
| Estilos | **SCSS** + tokens en `:root` | Sistema de diseño centralizado (ver §11). |
| HTTP | `HttpClient` con `withFetch()` | Llamadas REST al backend (único destino, ver §10). |
| Avatares | **DiceBear** (`@dicebear/core` + `collection`) | Avatares ilustrados reales generados offline por *seed*. |
| Build/serve | Angular CLI (`@angular-devkit/build-angular`, esbuild) | — |

**Principio rector:** el frontend **no guarda API keys ni llama a proveedores de
IA**. Todo pasa por el backend, incluido el chat: el backend hace de proxy hacia
el servicio de IA y agrega la clave compartida. Ninguna clave queda expuesta en el
navegador.

---

## 3. Cómo ejecutarlo

Requiere **Node.js 18+** y npm.

```bash
cd frontend
npm install
npm start          # servidor de desarrollo en http://localhost:4200
```

Otros comandos:

```bash
npm run build      # compilación de producción → dist/test-vocacional-front/browser
npm run watch      # build en modo desarrollo con recompilación automática
```

Con Docker (como en el despliegue):

```bash
docker build -t tv-frontend .
docker run -p 8080:80 tv-frontend
```

---

## 4. Arquitectura de carpetas

```
frontend/
├── Dockerfile              # build Angular (Node) + nginx que sirve el estático
├── nginx.conf              # PLANTILLA de nginx: proxy de /api al backend + fallback SPA + cache de assets
├── angular.json            # config de build/serve (application builder, esbuild)
└── src/
    ├── index.html          # shell HTML; carga fuentes Google (Plus Jakarta Sans + JetBrains Mono)
    ├── main.ts             # bootstrap de la app
    ├── styles.scss         # sistema de diseño global (tokens :root, botones, tarjetas, brújula…)
    ├── environments/
    │   ├── environment.ts              # PROD: apiUrl, aiChatUrl, inscripcionUrl
    │   └── environment.development.ts  # DEV: mismos campos apuntando a localhost
    └── app/
        ├── app.component.ts    # shell: topbar, stepper de progreso, footer, <router-outlet>
        ├── app.config.ts       # providers (router, HttpClient)
        ├── app.routes.ts       # rutas con lazy-loading + flowGuard
        │
        ├── core/               # lógica desacoplada (sin UI)
        │   ├── models/
        │   │   └── test.models.ts      # tipos de dominio (Letter, Profile, Question, …)
        │   ├── data/                   # contenido del test como TypeScript tipado
        │   │   ├── profiles.data.ts    # 11 perfiles A–K + ORDER + EMOJI
        │   │   ├── programs.data.ts    # programas UNIAGRARIA + mapa resultado→programas
        │   │   ├── questions.data.ts   # 22 preguntas
        │   │   ├── tiebreaks.data.ts   # 55 preguntas de desempate (todas las parejas)
        │   │   ├── avatar.data.ts      # personas (seeds) + colores de marca
        │   │   └── form-options.data.ts# opciones de los selects del formulario
        │   ├── services/
        │   │   ├── test-state.service.ts  # ⭐ estado global con signals (fuente de verdad en el cliente)
        │   │   ├── scoring.service.ts     # conteo, ganador y desempates
        │   │   ├── avatar.service.ts      # genera avatar (DiceBear) y brújula (SVG)
        │   │   ├── storage.service.ts     # copia local de informes + export CSV
        │   │   ├── records.service.ts     # cliente del backend: POST/GET /api/resultados
        │   │   ├── session.service.ts     # sesionId estable del navegador (memoria del chat)
        │   │   └── ai-chat.service.ts     # cliente del chat del asesor (vía backend)
        │   └── guards/
        │       └── flow.guard.ts          # impide saltar pasos del flujo
        │
        ├── pages/              # una carpeta/componente standalone por pantalla
        │   ├── landing/        # bienvenida (ruta '')
        │   ├── avatar/         # creación de avatar
        │   ├── datos/          # formulario de registro (Reactive Forms)
        │   ├── hero/           # arranque del test (ruta 'inicio')
        │   ├── quiz/           # el test pregunta por pregunta
        │   ├── report/         # informe de resultado
        │   ├── chat/           # asesor IA (ruta 'asesor')
        │   └── admin/          # panel del equipo (tabla de informes + CSV)
        │
        └── shared/
            └── tilt.directive.ts   # efecto de inclinación 3D al pasar el cursor
```

**Idea clave:** `core/` no tiene UI (datos + servicios + modelos), `pages/` no
tiene lógica de negocio (solo presenta y llama a servicios). El estado vive en un
único servicio con signals que todas las pantallas comparten.

---

## 5. Flujo de pantallas (rutas)

Definidas en `app.routes.ts`. Cada pantalla es un componente standalone con
lazy-loading. Un `flowGuard` evita saltar a una pantalla sin completar los pasos
previos.

| Ruta | Componente | Qué hace |
|---|---|---|
| `''` | `LandingComponent` | Bienvenida con titular gigante y brújula. Punto de entrada. |
| `avatar` | `AvatarComponent` | Arma el avatar (personaje DiceBear, color, apodo) con vista previa en vivo y botón de aleatorio. |
| `datos` | `DatosComponent` | Formulario de registro con **Reactive Forms** y validaciones + consentimiento (Decreto 1377/2013). |
| `inicio` | `HeroComponent` | Saludo personalizado + brújula antes de empezar. *(requiere registro)* |
| `quiz` | `QuizComponent` | 22 preguntas de opción; barra de progreso; desempates automáticos. *(requiere registro)* |
| `resultado` | `ReportComponent` | Carrera resultante, perfil, mapa de afinidades, brújula girando y programas UNIAGRARIA. *(requiere resultado)* |
| `asesor` | `ChatComponent` | Chat con el asesor IA. *(requiere resultado)* |
| `admin` | `AdminComponent` | Tabla de informes: los trae de `GET /api/resultados` si hay JWT guardado, y si no cae a la copia local. Exportación a CSV y "Vaciar" operan siempre sobre la copia local. |

Flujo normal: `'' → avatar → datos → inicio → quiz → resultado → (asesor)`.

`flowGuard` (`core/guards/flow.guard.ts`):
- `inicio` / `quiz` requieren que exista **registro**.
- `resultado` / `asesor` requieren que exista un **resultado calculado**.
- Si falta un paso, redirige a la pantalla adecuada.

---

## 6. Estado global (signals)

`TestStateService` (`core/services/test-state.service.ts`) es la **única fuente
de verdad**. Todas las pantallas leen sus signals y llaman a sus métodos; nadie
muta el estado directamente.

Signals principales:

| Signal | Tipo | Contenido |
|---|---|---|
| `avatar` | `AvatarConfig` | `{ personaId, color, apodo }` |
| `registro` | `Registro \| null` | Datos del formulario |
| `studentId` | `string \| null` | Id determinístico del estudiante |
| `answers` | `Record<number, Letter>` | Respuesta elegida por pregunta |
| `winner` | `Letter \| null` | Área ganadora |
| `counts` | `Counts \| null` | Conteo final por letra |

Computados: `primerNombre`, `respondidas`, `totalPreguntas`.

Métodos: `setPersona/​setColor/​setApodo`, `setRegistro`, `answer/​clearAnswer`,
`commitResult(winner, counts)`, `reset`, `hasRegistro()`, `hasResult()`.

`commitResult` hace **las dos cosas**: guarda la copia local con
`StorageService` y envía el informe al backend con
`RecordsService.enviarResultado()` (`POST /api/resultados`). Si el envío falla no
se interrumpe al estudiante: se loguea un warning y sigue.

---

## 7. Servicios (capa `core`)

- **`test-state.service.ts`** — estado global (§6).
- **`scoring.service.ts`** — cuenta respuestas, determina ganador y resuelve
  desempates (§9). Pura lógica, sin estado propio.
- **`avatar.service.ts`** — dos generadores SVG:
  - `buildAvatar(seed)` / `buildBustSVG(persona)`: avatar ilustrado con **DiceBear**
    (estilo *adventurer*), fondo transparente. Cambiar el estilo = una línea
    (`import { adventurer } from '@dicebear/collection'`).
  - `buildCompassSVG(activeLetter, size)`: la brújula de 11 sectores; `needleAngle(letter)`
    da el ángulo al que gira la aguja hacia el área ganadora.
- **`storage.service.ts`** — copia local (`localStorage`) de los informes y
  `toCsv()` para el panel del equipo. **La fuente de verdad es el backend**; esta
  copia queda como respaldo para que el panel de demostración funcione sin
  conexión y para el CSV.
- **`records.service.ts`** — cliente del backend para los informes:
  `enviarResultado()` (`POST /api/resultados`, público) y `listarResultados()`
  (`GET /api/resultados`, con `Authorization: Bearer` leído de `localStorage`).
  **Ningún método lanza:** ante error loguea un warning y devuelve `null`, para que
  la app siga funcionando sin backend.
- **`session.service.ts`** — genera y persiste el `sesionId` del navegador
  (UUID v4, con *fallback* si no hay `crypto.randomUUID`). Lo necesita el chat:
  la memoria de la conversación la agrupa el servicio de IA por ese id, así que
  tiene que sobrevivir a las recargas.
- **`ai-chat.service.ts`** — cliente del chat. Hace `POST` a
  `environment.aiChatUrl` (**el backend**, no la IA) con `{ texto, sesionId }` y
  devuelve `reply`. **No contiene API keys ni llama a ningún proveedor de IA
  directo** (§10).

---

## 8. Datos del test

Todo el contenido vive tipado en `core/data/` (fácil de mover al backend después
vía `GET /api/preguntas`):

- **11 áreas / perfiles** (`profiles.data.ts`), identificadas por una letra `A–K`.
  Cada perfil: `carrera`, `area`, `perfil`, `fortalezas`, `debilidades`, `cualidades`.
- **Programas UNIAGRARIA** (`programs.data.ts`): catálogo real + `RESULT_PROGRAMS`
  que mapea cada letra ganadora a programa(s) principal(es) y relacionado(s).
- **22 preguntas** (`questions.data.ts`), 6 opciones cada una; cada opción suma un
  punto a su letra.
- **55 desempates** (`tiebreaks.data.ts`): una pregunta por cada pareja posible de
  las 11 letras, para resolver cualquier empate a dos.
- **Avatares** (`avatar.data.ts`): *seeds* de personaje + paleta de colores de marca.
- **Opciones de formulario** (`form-options.data.ts`): tipo de documento, grado,
  ciudad, edad.

---

## 9. Lógica de puntaje y desempates

En `ScoringService`:

1. `tally(answers)` cuenta cuántas respuestas cayeron en cada letra.
2. `evaluate(answers)`:
   - Si hay **un** máximo → esa es la ganadora.
   - Si hay **empate a dos** → devuelve la pregunta de desempate de esa pareja
     (`TIEBREAKS['AB']`, etc.). La respuesta suma un punto y define la ganadora.
   - Si hay **empate múltiple** sin pregunta → resuelve por orden alfabético
     (*fallback*).
3. `secondaryLetter(counts, winner)` da la segunda área más afín (para el informe).

El cálculo es **100 % determinístico** y hoy vive **acá, en el frontend**: el
backend solo persiste el resultado que recibe y deriva puntaje/porcentaje de los
contadores. Es un desvío consciente y temporal del documento de arquitectura del
equipo (que pide el cálculo en el backend), documentado en
[ADR 0003](../docs/adr/0003-calculo-riasec-en-el-frontend.md). La IA explica y
enriquece, no decide la recomendación.

Nota: son **11 áreas identificadas por letra (A–K)**, no los 6 códigos RIASEC de
Holland.

---

## 10. Integración con backend / IA (contrato)

El frontend se comunica solo por REST, según [`docs/api-contract.md`](../docs/api-contract.md).
**El navegador habla únicamente con el backend .NET**, incluido el chat: el
servicio de IA queda detrás del backend, que hace de proxy y agrega la API key
(ver [ADR 0002](../docs/adr/0002-backend-como-proxy-de-la-ia.md)). El frontend no
conoce la URL ni la clave del servicio de IA.

Los endpoints se configuran en `src/environments/`:

```ts
// environment.ts (prod) — relativos: nginx sirve la SPA y proxea /api al backend
apiUrl: '/api',                 // backend .NET
aiChatUrl: '/api/ia/chat',      // mismo backend (proxy hacia la IA)
inscripcionUrl: 'https://www.uniagraria.edu.co/inscripcion/',
```

En desarrollo (`environment.development.ts`) **las dos apuntan al mismo puerto**,
el del backend local: `http://localhost:5000/api` y
`http://localhost:5000/api/ia/chat`. No hay que apuntar al servicio de IA. El dev
server de Angular queda en **4200** (`npm start`), que es además el origen que el
backend permite por CORS por defecto (`CORS_ORIGINS`); si lo cambiás, actualizá
esa variable en el `.env` del backend o el navegador va a bloquear las respuestas.

**Puntos de integración:**

| Necesidad del frontend | Endpoint | Estado |
|---|---|---|
| Chat con asesor IA | `POST /api/ia/chat` | ✅ Consumido (`ai-chat.service.ts`). Envía `{ texto, sesionId }`, recibe `{ reply }`. |
| Persistir el informe | `POST /api/resultados` | ✅ Consumido (`records.service.ts`, desde `commitResult`). Además se guarda la copia local. |
| Listado para el panel | `GET /api/resultados` | ✅ Consumido (`records.service.ts`, paginado con `pagina`/`tamano`). Requiere un JWT con rol **Administrador**; cae a `localStorage` si no hay token, si el token no tiene el rol (`403`) o si falla. |
| Login del panel | `POST /api/auth/login` | ⏳ **No consumido**: no hay pantalla de login. El JWT se lee de `localStorage` (clave `uniagraria_admin_token`) y hay que ponerlo a mano. |
| Banco de preguntas | `GET /api/preguntas` | ⏳ **No consumido**: el endpoint no publica la letra/peso de cada opción, así que no sirve para calcular. Las preguntas siguen en `data/`. |
| Catálogos del formulario | `GET /api/ciudades`, `GET /api/grados`, `GET /api/tipos-documento` | ⏳ **No consumidos**: el formulario usa `form-options.data.ts`. El backend siembra los mismos valores, así que `POST /api/resultados` resuelve los nombres que manda el formulario. |

**Chat — contrato real:** `ai-chat.service.ts` hace `POST` a
`environment.aiChatUrl` con `{ texto, sesionId, contexto? }` y espera `{ reply }`.
Ya **no** manda el historial (`{ mensajes }` quedó atrás): la memoria de la
conversación la guarda el servicio de IA por `sesion_id`, y lo que el componente
muestra en pantalla es solo el historial local de esa pestaña. El `contexto`
(`{ nombre, perfil, area, carrera }`, que `chat.component.ts` toma del informe)
**sí viaja en cada turno**: la IA no puede deducir de quién es la sesión, y sin
esos datos respondería en modo genérico (antes usaba un contexto de ejemplo
hardcodeado, con lo que le hablaba a todos los estudiantes como si fueran
"Camila" con carrera "Medicina Veterinaria"). Si el estudiante todavía no tiene
resultado, el objeto no se envía. Ante error, el servicio devuelve un mensaje de *fallback* en vez
de romper la pantalla.

**Informe — contrato real:** `POST /api/resultados` recibe
`{ registro, respuestas, resultado }`. `respuestas` lleva
`{ preguntaId, letra, texto }` por cada una de las 22 preguntas respondidas (la
pregunta de desempate no está en `QUESTIONS`, así que no se envía como respuesta;
su punto sí queda reflejado en `contadores`). `resultado` lleva
`{ letra, perfil, carrera, area, contadores }` ya calculados por el frontend: el
backend **no recalcula el perfil**, solo persiste y deriva puntaje/porcentaje
(ver [ADR 0003](../docs/adr/0003-calculo-riasec-en-el-frontend.md)).

**Panel `admin` — lo que se ve:** si hay JWT en `localStorage`, la tabla se llena
con `GET /api/resultados` y el contador indica `backend`; si no, cae a la copia
local y dice `copia local`. Las filas del backend traen menos datos (no incluyen
celular, colegio, ciudad ni grado), así que esas columnas se muestran como `—`.
"Descargar CSV" y "Vaciar" operan **siempre sobre la copia local**, nunca sobre el
backend.

> ⚠️ Pendiente real: la pantalla de login del panel. Hasta que exista, el listado
> del backend solo se ve si alguien deja el token en `localStorage` a mano.

---

## 11. Sistema de diseño

Concepto **"Aurora Luminosa"**: base oscura premium con acentos vibrantes y
degradados. Todos los tokens viven en `src/styles.scss` (`:root`).

- **Colores:** paleta oficial UNIAGRARIA llevada a tonos vivos (verde `#86e05a`,
  teal `#0bc2b0`, azul `#22a6e8`, dorado `#ffe14d`) + un acento por facultad
  (`--a … --k`) y degradados de marca (`--grad-brand`, `--grad-warm`, `--grad-head`).
- **Tipografía:** *Plus Jakarta Sans* (texto/títulos) + *JetBrains Mono* (datos).
- **Utilidades:** `.grad-text` (texto en degradado), `.card` (vidrio con blur),
  `.grad-border` (borde degradado animado), `.orb` (esfera con luz), `.glare`
  (brillo que sigue el cursor, junto a `appTilt`), `.btn-primary` / `.btn-ghost`.
- **Elementos distintivos:** la **brújula SVG** de 11 sectores cuya aguja gira
  hacia el área ganadora, avatares reales sobre orbes 3D, fondo aurora animado y
  el directiva de **tilt 3D** (`shared/tilt.directive.ts`).

> Nota: en modo **desarrollo** aparece un aviso `NG0203` en la consola que
> proviene del *injector profiler* interno de Angular; **no ocurre en el build de
> producción** ni afecta el funcionamiento.

---

## 12. Despliegue

`Dockerfile` multi-stage: compila Angular con Node y sirve el estático con nginx.
Encaja 1:1 con Coolify (una carpeta = un recurso con su `Dockerfile`), como el
resto de servicios del monorepo.

`nginx.conf` es una **plantilla**: el Dockerfile la copia a
`/etc/nginx/templates/default.conf.template` y el entrypoint de la imagen oficial
la procesa con `envsubst` al arrancar. Hace tres cosas:

- **Proxy de `/api/`** hacia `${BACKEND_URL}` (default `http://backend:5000`, se
  sobreescribe por environment en `infra/docker-compose.yml` o en Coolify).
  Incluye `/api/ia/chat`, que el backend reenvía al servicio de IA. El
  `proxy_read_timeout` es de 120 s porque el chat puede tardar más que el default.
- **Fallback SPA:** cualquier otra ruta cae en `index.html`.
- **Cache** de los assets con hash.

La URL del backend va en una variable de nginx (con `resolver 127.0.0.11`) a
propósito: si fuera literal, nginx la resolvería al arrancar y el contenedor **no
arrancaría** cuando no existe un servicio `backend` en su red (en Coolify el
frontend se despliega solo). Así, sin backend, `/api` devuelve 502 pero la SPA se
sigue sirviendo.

`main` siempre desplegable: al hacer merge a `main`, el despliegue reconstruye
desde el nuevo commit.

---

## 13. Cómo extender

- **Nueva pantalla:** crear `pages/<nombre>/<nombre>.component.ts` (standalone) y
  registrarla en `app.routes.ts` con `loadComponent`.
- **Cambiar el estilo de avatar:** en `avatar.service.ts`, cambiar el import del
  estilo DiceBear (`adventurer` → `personas`, `notionists`, `micah`, …).
- **Mover preguntas/perfiles al backend:** reemplazar los imports de `data/` por
  llamadas a `GET /api/preguntas`. **Bloqueado hoy:** ese endpoint no devuelve la
  letra de cada opción, así que no alcanza para calcular (ver
  [ADR 0003](../docs/adr/0003-calculo-riasec-en-el-frontend.md)).
- **Login del panel:** una pantalla que haga `POST /api/auth/login` y guarde el
  token en `localStorage` con la clave `TOKEN_KEY` de `records.service.ts`. Con
  eso el panel deja de depender de pegar el JWT a mano.
- **Catálogos desde el backend:** reemplazar `form-options.data.ts` por
  `GET /api/ciudades`, `/api/grados` y `/api/tipos-documento`. Los nombres ya
  coinciden con lo que el backend siembra.

---

**Responsable del frontend:** Natalia · Ver también el
[`README.md`](README.md) de esta carpeta y la
[arquitectura del repo](../docs/ARQUITECTURA.md).
