# ADR 0001 — Tipo de test: estructurado vs. conversacional

- **Estado:** aceptado
- **Fecha:** 2026-07-29

## Contexto

El test puede aplicarse de dos formas:

- **Estructurado:** banco de preguntas fijo y administrable.
- **Conversacional:** las preguntas las conduce el asistente de IA.

El documento de arquitectura del equipo (externo y **no versionado** en este
repo; no hay ningún PDF en `docs/`) plantea las dos opciones en su sección de
aplicación del test y pide que la recomendación sea determinística y auditable.
Lo relevante de ahí para esta decisión es exactamente eso, y queda resumido acá
para no depender de un archivo que el repo no tiene.

La decisión impactaba el diseño del frontend, del backend y de la capa de IA, por
lo que había que definirla temprano.

## Decisión

**Test estructurado.** No es una decisión pendiente: el código ya la tomó de los
dos lados y esta ADR la deja registrada.

- **Frontend:** banco fijo de **22 preguntas** (`core/data/questions.data.ts`),
  **11 perfiles A–K** (`profiles.data.ts`) y **55 preguntas de desempate**
  (`tiebreaks.data.ts`, una por cada pareja de letras). El resultado lo calcula
  `ScoringService`, sin IA.
- **Backend:** el esquema tiene `Preguntas` + `OpcionesRespuesta`, el seeder carga
  las mismas 22 preguntas y `GET /api/preguntas` las expone.
- **IA:** el servicio **no conduce** el test. Solo atiende
  `POST /api/ia/chat`, que en el flujo se usa **después** del resultado (la ruta
  `asesor` del frontend requiere un resultado calculado).

## Consecuencias

- El resultado es determinístico, repetible y explicable sin consultar al modelo:
  es lo que pide el requisito institucional.
- El banco de preguntas queda **duplicado**: vive en el frontend (que es quien
  calcula) y en la base (sembrado por `DbSeeder`, con los mismos textos para que
  `POST /api/resultados` pueda resolver las opciones por texto). Mientras el
  cálculo siga en el frontend hay que mantener los dos en sincronía; ver
  [ADR 0003](0003-calculo-riasec-en-el-frontend.md).
- La IA queda acotada a explicar y acompañar el resultado, con consumo de tokens
  bajo y predecible (un turno por mensaje del estudiante).
- Administrar el test "en vivo" (agregar/editar preguntas desde el panel) **no**
  está implementado: hoy cambiar una pregunta es un cambio de código en el
  frontend y en el seeder.

---

> Plantilla para nuevos ADR: copiar este archivo, numerarlo (`0004-...`) y
> completar Contexto → Decisión → Consecuencias.
