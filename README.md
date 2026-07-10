# Test Vocacional

Aplicacion web que aplica un test vocacional y direcciona a los estudiantes hacia programas academicos segun su perfil.

## Arquitectura

Capas desacopladas / microservicios. La capa de inteligencia artificial esta desacoplada del resto: se puede alternar entre modelo local y en la nube cambiando unicamente la API key, sin afectar backend ni frontend.

## Stack

- Frontend: Angular
- Backend: .NET
- Base de datos: MySQL
- IA: servicio independiente (local o nube)

## Equipo

- Backend: Juan, Santiago
- Frontend: Natalia
- IA e integracion: Agustin

## Estado

Repositorio inicial. Ver los archivos de referencia (arquitectura propuesta y HTML del test) adjuntos.
