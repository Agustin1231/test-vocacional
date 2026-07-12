# Brújula Vocacional UNIAGRARIA — Frontend (Angular)

Frontend del **Test Vocacional UNIAGRARIA**: una aplicación web que aplica un
test de 22 preguntas, calcula el perfil del estudiante y lo direcciona hacia los
programas de pregrado reales de UNIAGRARIA, con un asesor académico basado en IA.

> Parte del proyecto `Agustin1231/test-vocacional`. Este repo corresponde a la
> capa **Frontend** (Angular). Backend en .NET, base de datos MySQL y el servicio
> de IA son capas independientes.

---

## 🚀 Cómo ejecutarlo

Requiere **Node.js 18+** y npm. Si no tienes Node, instálalo desde
<https://nodejs.org> (versión LTS).

```bash
npm install        # instala dependencias (Angular 18)
npm start          # levanta el servidor de desarrollo en http://localhost:4200
```

Otros comandos:

```bash
npm run build      # compilación de producción → dist/
npm run watch      # build en modo desarrollo con recompilación automática
```

---

## 🧭 Flujo de la aplicación

El test es un recorrido de pantallas, cada una es una **ruta**:

| Ruta | Pantalla | Qué hace |
|------|----------|----------|
| `/avatar` | Avatar | El estudiante arma su avatar (personaje, color, apodo) con vista previa en vivo. |
| `/datos` | Datos | Formulario de registro con validaciones (Reactive Forms) y consentimiento de datos. |
| `/inicio` | Bienvenida | Saludo personalizado + brújula animada antes de empezar. |
| `/quiz` | Test | 22 preguntas de opción; barra de progreso; desempates automáticos. |
| `/resultado` | Informe | Carrera resultante, perfil, mapa de afinidades, brújula y programas UNIAGRARIA. |
| `/asesor` | Asesor IA | Chat con el asesor académico (vía servicio de IA desacoplado). |
| `/admin` | Panel del equipo | Tabla de informes generados + exportación a CSV. |

Un `flowGuard` impide saltar a pantallas para las que faltan pasos previos.

---

## 🏗️ Arquitectura (capas desacopladas)

```
src/app/
├── core/
│   ├── models/       → tipos de dominio (Question, Profile, Program, …)
│   ├── data/         → contenido del test (22 preguntas, 11 perfiles,
│   │                    55 desempates, programas, avatares, opciones de forma)
│   ├── services/     → lógica desacoplada:
│   │     • test-state.service.ts   estado global con signals (fuente de verdad)
│   │     • scoring.service.ts      conteo, ganador y desempates
│   │     • avatar.service.ts       generación de avatares y brújula en SVG
│   │     • storage.service.ts      respaldo local de informes + CSV
│   │     • ai-chat.service.ts      cliente del asesor IA (endpoint configurable)
│   └── guards/       → flow.guard.ts (control del flujo entre pantallas)
├── pages/            → un componente standalone por pantalla
├── app.component.ts  → shell (topbar, stepper de progreso, footer)
├── app.routes.ts     → rutas con lazy-loading por pantalla
└── app.config.ts     → providers (router, http, animaciones)
```

### La capa de IA está desacoplada

Siguiendo la arquitectura del proyecto, **el frontend nunca llama directamente a
un proveedor de IA ni contiene API keys**. `AiChatService` solo hace `POST` al
endpoint configurado en `src/environments/environment*.ts`:

```ts
aiChatUrl: '/api/ia/chat'   // lo expone el servicio de IA independiente
```

Ese servicio decide el proveedor/modelo (local o nube) cambiando únicamente su
propia API key, sin tocar el frontend. Así la clave nunca queda expuesta en el
navegador.

> ⚠️ Los HTML de referencia del repo llamaban a `api.anthropic.com` directamente
> desde el navegador. Aquí eso se corrigió: la llamada va al backend/servicio de
> IA. Ajusta `apiUrl` y `aiChatUrl` en los archivos de `environments/` según los
> puertos de .NET y del servicio de IA.

---

## 🎨 Diseño

Tema oscuro premium sobre la **paleta oficial UNIAGRARIA** (Manual de Identidad
Visual 2023). Los tokens de color, tipografía y radios viven en `src/styles.scss`
(`:root`). Tipografías: *Plus Jakarta Sans* + *JetBrains Mono*. Elementos
distintivos: la brújula SVG animada de 11 sectores cuya aguja gira hacia el área
ganadora, y el avatar que "se viste" con el atuendo de la carrera resultante.

---

## 👥 Equipo

- **Frontend (este repo):** Natalia
- **Backend (.NET):** Juan, Santiago
- **IA e integración:** Agustín
