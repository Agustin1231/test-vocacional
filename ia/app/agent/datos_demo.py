"""Datos que HOY están hardcodeados y en el futuro vendrán de la base de datos.

TODO: reemplazar por datos reales que provee el backend (.NET) desde MySQL:
- CONTEXTO: perfil del estudiante calculado por el test (RIASEC), su nombre, el
  programa sugerido, etc.
- MEMORIA: historial de la conversación persistido por estudiante/sesión.

Mientras eso no exista, estos valores fijos permiten probar el agente.
"""

# Contexto del estudiante (vendrá del resultado del test en la DB).
CONTEXTO_DEMO: dict = {
    "nombre": "Camila",
    "perfil": "Investigador",
    "area": "Ciencias de la vida",
    "carrera": "Medicina Veterinaria",
}

# Memoria: turnos previos de la conversación (vendrá de la DB por estudiante).
# Formato: [{ "rol": "user" | "assistant", "texto": str }, ...]
MEMORIA_DEMO: list[dict] = []
