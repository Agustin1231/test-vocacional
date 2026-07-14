# Test Vocacional

Aplicacion web que aplica un test vocacional y direcciona a los estudiantes hacia programas academicos segun su perfil.

## Arquitectura

Capas desacopladas / microservicios. La capa de inteligencia artificial esta desacoplada del resto: se puede alternar entre modelo local y en la nube cambiando unicamente la API key, sin afectar backend ni frontend.

El repositorio sigue un patron **monorepo por servicios, contract-first**: una carpeta autocontenida por servicio, que se comunican solo por el contrato REST. El detalle de por que este patron y como esta organizado el repo esta en **[docs/ARQUITECTURA.md](docs/ARQUITECTURA.md)**.

## Estructura del repositorio

```
test-vocacional/
├── docs/          # documentacion compartida + contrato de API + decisiones (ADR)
├── frontend/      # Angular (SPA)              — Natalia
├── backend/       # .NET 8 Clean Architecture  — Juan, Santiago
├── ia/            # servicio Python LangGraph  — Agustin
├── infra/         # orquestacion (docker-compose) para levantar todo junto
└── referencia/    # HTML de referencia del test
```

Cada carpeta de servicio tiene su propio `Dockerfile`, `README.md` y `.env.example`. El contrato entre servicios vive en [docs/api-contract.md](docs/api-contract.md).

## Stack

- Frontend: Angular
- Backend: .NET
- Base de datos: MySQL
- IA: servicio independiente (local o nube)

## Levantar todo junto (local)

```bash
docker compose -f infra/docker-compose.yml up --build
```

Cada servicio tambien se puede levantar solo desde su carpeta (ver su `README.md`).

## Equipo

- Backend: Juan, Santiago
- Frontend: Natalia
- IA e integracion: Agustin

## Estado

Frontend Angular funcional. Backend, IA e infraestructura: esqueleto creado, pendientes de implementacion por cada equipo. Ver [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).
