# Arquitectura y organización del repositorio

Este documento explica **cómo está organizado el repositorio y por qué**. Es la
referencia para cualquier persona que se suma al proyecto y necesita entender
dónde va su código y cómo se comunica con el resto.

> Para el detalle técnico del producto (capas, decisiones de stack, seguridad,
> despliegue) ver `arquitectura.pdf` en esta misma carpeta. Acá nos enfocamos en
> el **patrón de organización del repo**.

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
| **Monolito con la IA adentro del backend** | Rompe el desacople que el frontend ya tiene, ata todo a un solo lenguaje y hace que un cambio de modelo obligue a tocar el backend. La IA en Python vive aparte, como define el PDF. |
| **Todo en una carpeta sin límites claros** | Nadie sabe dónde empieza y termina su responsabilidad; los merges chocan constantemente. |

**Ventajas del patrón elegido:**

- **Trabajo en paralelo real.** Mientras el contrato no cambie, cada quien avanza
  en su carpeta sin bloquear a los demás. Los merges casi no chocan porque cada
  uno toca archivos distintos.
- **Desacople por contrato**, tal como pide la arquitectura: el frontend ya
  apunta a `/api` (backend) y `/api/ia/chat` (IA) sin conocer su implementación.
- **Encaja 1:1 con el despliegue en Coolify:** cada carpeta = un recurso/app en
  Coolify, cada una con su `Dockerfile`. Lo que ya se hace con `frontend/` se
  replica para las otras tres.
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

3. **`infra/docker-compose.yml` es el "todo junto".** Permite probar la
   integración real (front → backend → IA → MySQL) en una sola máquina, sin
   levantar cada servicio a mano.

4. **Ramas por servicio/feature.** `main` siempre desplegable. Se trabaja en
   ramas tipo `feature/backend-auth`, `feature/ia-rag`, `frontend-natalia`, y se
   integra por PR.

5. **`docs/adr/` para las decisiones abiertas.** Un archivo corto por decisión
   (contexto → decisión → consecuencias). Evita re-discutir lo mismo en tres
   lugares distintos.

---

## Flujo de comunicación

```
Estudiante ──HTTPS──> frontend (Angular)
                          │  REST + JWT
                          ▼
                       backend (.NET 8)  ──────► MySQL
                          │  REST interno
                          ▼
                       ia (Python / LangGraph) ──► OpenRouter (LLM en la nube)
```

- **frontend ↔ backend:** REST sobre HTTPS con JWT.
- **backend ↔ ia:** REST interno (red privada de Docker). La IA **nunca** se
  expone directo al navegador.
- El frontend no guarda API keys ni llama a proveedores de IA: todo pasa por el
  backend / servicio de IA.
