# ADR 0001 — Tipo de test: estructurado vs. conversacional

- **Estado:** propuesto
- **Fecha:** _(por definir)_

## Contexto

El test puede aplicarse de dos formas (ver `arquitectura.pdf`, sección 7):

- **Estructurado:** banco de preguntas fijo y administrable.
- **Conversacional:** las preguntas las conduce el asistente de IA.

La decisión impacta el diseño del flujo del frontend, del backend y de la capa de
IA, por lo que conviene definirla temprano.

## Decisión

_(por definir — recomendación inicial: **estructurado** para la primera versión.)_

## Consecuencias

- **Si estructurado:** el banco de preguntas ya existe en el frontend
  (`frontend/src/app/core/data/questions.data.ts`); es determinístico y auditable,
  encaja con el requisito institucional. La IA queda para explicar/acompañar el
  resultado, no para conducir el test.
- **Si conversacional:** mayor peso en la capa de IA (LangGraph conduce el flujo),
  menos control/auditabilidad, más consumo de tokens.

---

> Plantilla para nuevos ADR: copiar este archivo, numerarlo (`0002-...`) y
> completar Contexto → Decisión → Consecuencias.
