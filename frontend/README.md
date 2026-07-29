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

- `apiUrl` — backend .NET (prod `/api`, dev `http://localhost:5000/api`).
- `aiChatUrl` — chat del asesor, **expuesto por el mismo backend** (prod
  `/api/ia/chat`, dev `http://localhost:5000/api/ia/chat`). El navegador no habla
  con el servicio de IA ni conoce su API key.
- `inscripcionUrl` — enlace oficial de inscripción.

En desarrollo las dos apuntan al backend local (puerto 5000): no hay que apuntar
al servicio de IA. El dev server queda en 4200, que es el origen que el backend
permite por CORS por defecto.

## Pantallas

`'' (bienvenida) → avatar → datos → inicio → quiz → resultado → asesor` + `admin`.
Un `flowGuard` impide saltar pasos. Detalle en [`DOCUMENTACION.md`](DOCUMENTACION.md).

## Stack

Angular 18 (standalone + signals), SCSS, DiceBear (avatares reales), `HttpClient`.
Build con Angular CLI (esbuild). Se sirve con nginx (ver `Dockerfile` / `nginx.conf`).

## Responsable

Frontend: **Natalia**.
