# Frontend — Brújula Vocacional UNIAGRARIA

SPA en **Angular 18** del Test Vocacional: aplica un test de 22 preguntas,
calcula el perfil del estudiante de forma determinística y lo direcciona hacia
los programas de UNIAGRARIA, con un asesor académico por IA.

Servicio `frontend/` del monorepo *contract-first* (ver
[`../docs/ARQUITECTURA.md`](../docs/ARQUITECTURA.md)). Se comunica con el resto
**solo por REST** ([contrato](../docs/api-contract.md)) y **no guarda API keys**.

📖 **Documentación completa del frontend:** [`DOCUMENTACION.md`](DOCUMENTACION.md)

---

## Cómo correr en local

Requiere **Node.js 18+**.

```bash
npm install
npm start        # http://localhost:4200
```

Build de producción / Docker:

```bash
npm run build                       # → dist/test-vocacional-front/browser
docker build -t tv-frontend . && docker run -p 8080:80 tv-frontend
```

## Configuración

En `src/environments/environment*.ts`:

- `apiUrl` — backend .NET (por defecto `/api`).
- `aiChatUrl` — asesor IA (por defecto `/api/ia/chat`).
- `inscripcionUrl` — enlace oficial de inscripción.

Ajustar los puertos en `environment.development.ts` según el backend / IA locales.

## Pantallas

`'' (bienvenida) → avatar → datos → inicio → quiz → resultado → asesor` + `admin`.
Un `flowGuard` impide saltar pasos. Detalle en [`DOCUMENTACION.md`](DOCUMENTACION.md).

## Stack

Angular 18 (standalone + signals), SCSS, DiceBear (avatares reales), `HttpClient`.
Build con Angular CLI (esbuild). Se sirve con nginx (ver `Dockerfile` / `nginx.conf`).

## Responsable

Frontend: **Natalia**.
