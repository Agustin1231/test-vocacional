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
| HTTP | `HttpClient` con `withFetch()` | Llamadas REST al backend / IA. |
| Avatares | **DiceBear** (`@dicebear/core` + `collection`) | Avatares ilustrados reales generados offline por *seed*. |
| Build/serve | Angular CLI (`@angular-devkit/build-angular`, esbuild) | — |

**Principio rector:** el frontend **no guarda API keys ni llama a proveedores de
IA**. Todo pasa por el backend / servicio de IA a través de endpoints
configurables. La clave nunca queda expuesta en el navegador.

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
├── nginx.conf              # fallback SPA (toda ruta → index.html) + cache de assets
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
        │   │   ├── test-state.service.ts  # ⭐ estado global con signals (fuente de verdad)
        │   │   ├── scoring.service.ts     # conteo, ganador y desempates
        │   │   ├── avatar.service.ts      # genera avatar (DiceBear) y brújula (SVG)
        │   │   ├── storage.service.ts     # respaldo local de informes + export CSV
        │   │   └── ai-chat.service.ts     # cliente del asesor IA (endpoint configurable)
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
| `admin` | `AdminComponent` | Tabla de informes generados + exportación a CSV (respaldo local). |

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
`commitResult(winner, counts)` (guarda + persiste el informe), `reset`,
`hasRegistro()`, `hasResult()`.

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
- **`storage.service.ts`** — respaldo local (`localStorage`) de los informes y
  `toCsv()` para el panel del equipo. **Es solo un respaldo del lado del cliente**;
  la fuente de verdad real será el backend (`POST /api/resultados`).
- **`ai-chat.service.ts`** — cliente del asesor IA. Hace `POST` a
  `environment.aiChatUrl` con `{ mensajes, contexto }`. **No contiene API keys ni
  llama a Anthropic/OpenRouter directo** (§10).

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

El cálculo es **100 % determinístico** — coherente con el contrato: *"el cálculo
del perfil es determinístico y vive en el backend (o hoy en el frontend); la IA
explica y enriquece, no decide la recomendación"*.

---

## 10. Integración con backend / IA (contrato)

El frontend se comunica solo por REST, según [`docs/api-contract.md`](../docs/api-contract.md).
Los endpoints se configuran en `src/environments/`:

```ts
// environment.ts (prod)
apiUrl: '/api',                 // backend .NET
aiChatUrl: '/api/ia/chat',      // asesor IA (detrás del backend/proxy)
inscripcionUrl: 'https://www.uniagraria.edu.co/inscripcion/',
```

En desarrollo (`environment.development.ts`) apuntan a `http://localhost:5000/...`.
Ajustar según los puertos reales del backend / IA.

**Puntos de integración actuales y pendientes:**

| Necesidad del frontend | Endpoint del contrato | Estado |
|---|---|---|
| Chat con asesor IA | `POST /api/ia/chat` | ✅ Ya consumido (`ai-chat.service.ts`). |
| Persistir el informe | `POST /api/resultados` | ⏳ Hoy se guarda en `localStorage`; migrar a este endpoint. |
| Listado para el panel | `GET /api/resultados` | ⏳ Hoy lee `localStorage`; migrar. |
| Banco de preguntas | `GET /api/preguntas` | ⏳ Hoy las preguntas viven en `data/`; opcional moverlas al backend. |
| Login (docente/orientador) | `POST /api/auth/login` | ⏳ Pendiente si el panel admin se protege con JWT. |

> ⚠️ **A alinear con Agustín (IA):** hoy `ai-chat.service.ts` envía cada mensaje
> como `{ role, content }`, mientras el contrato define `{ rol, texto }`. Hay que
> unificar el nombre de los campos (frontend o servicio de IA) antes de conectar.

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
`nginx.conf` hace *fallback* de cualquier ruta a `index.html` (SPA) y cachea los
assets con hash. Encaja 1:1 con Coolify (una carpeta = un recurso con su
`Dockerfile`), como el resto de servicios del monorepo.

`main` siempre desplegable: al hacer merge a `main`, el despliegue reconstruye
desde el nuevo commit.

---

## 13. Cómo extender

- **Nueva pantalla:** crear `pages/<nombre>/<nombre>.component.ts` (standalone) y
  registrarla en `app.routes.ts` con `loadComponent`.
- **Cambiar el estilo de avatar:** en `avatar.service.ts`, cambiar el import del
  estilo DiceBear (`adventurer` → `personas`, `notionists`, `micah`, …).
- **Mover preguntas/perfiles al backend:** reemplazar los imports de `data/` por
  llamadas a `GET /api/preguntas` desde un servicio; el resto de la lógica no
  cambia.
- **Conectar persistencia real:** en `commitResult`, además de `StorageService`,
  hacer `POST /api/resultados` con el `Informe`.

---

**Responsable del frontend:** Natalia · Ver también el
[`README.md`](README.md) de esta carpeta y la
[arquitectura del repo](../docs/ARQUITECTURA.md).
