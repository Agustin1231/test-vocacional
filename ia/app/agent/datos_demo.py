"""Datos que HOY están hardcodeados y en el futuro vendrán de la base de datos.

TODO: reemplazar CONTEXTO por datos reales que provee el backend (.NET) desde
MySQL: el perfil del estudiante calculado por el test (RIASEC), su nombre, el
programa sugerido, etc.

La memoria de la conversación YA NO está acá: se persiste en MySQL por
`sesion_id` (ver app/memory.py).
"""

# Contexto del estudiante (vendrá del resultado del test en la DB).
CONTEXTO_DEMO: dict = {
    "nombre": "Camila",
    "perfil": "Investigador",
    "area": "Ciencias de la vida",
    "carrera": "Medicina Veterinaria",
}
