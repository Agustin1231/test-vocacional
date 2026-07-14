# Backend — .NET 8 Web API (Clean Architecture)

Servicio institucional y orquestador. Responsable de: autenticación, roles y
permisos, banco de preguntas, aplicación del test, cálculo/persistencia de
resultados, reportes (PDF/Excel) y auditoría. Es el **punto único de acceso a los
datos** (MySQL) y quien consume el servicio de IA por REST interno.

> Carpeta a llenar por el equipo de backend (Juan, Santiago). La estructura
> interna de capas (Domain / Application / Infrastructure / API) queda a criterio
> del equipo, respetando Clean Architecture.

## Contrato

Los endpoints que este servicio expone están definidos en
[`../docs/api-contract.md`](../docs/api-contract.md). **Cambiar el contrato = PR
que se discute** con los servicios afectados (frontend, IA).

## Cómo correr en local

_(completar cuando exista el proyecto — típicamente:)_

```bash
cp .env.example .env      # completar con valores locales
dotnet restore
dotnet run
```

Debe quedar escuchando en el puerto que espera el frontend en desarrollo
(`http://localhost:5000/api`, ver `frontend/src/environments/environment.development.ts`).

## Variables de entorno

Ver [`.env.example`](.env.example). El `.env` real **no** se commitea.

## Despliegue

Un `Dockerfile` en esta carpeta = un recurso/app en Coolify.
