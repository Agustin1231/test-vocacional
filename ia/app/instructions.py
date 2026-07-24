"""Instrucciones del agente, persistidas en MySQL y editables por API.

El "system prompt" base del asesor deja de estar hardcodeado: vive en la tabla
`agente_instrucciones` y se puede consultar/editar por los endpoints protegidos
(ver main.py). El agente lo lee en cada request, así los cambios aplican en vivo.

Se identifican por `clave` para poder tener varias instrucciones en el futuro;
hoy usamos una sola: `system_prompt`.
"""
import logging

from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    String,
    Table,
    Text,
    func,
    insert,
    select,
    update,
)

from .db import get_engine, metadata

logger = logging.getLogger("uvicorn.error")

CLAVE_SYSTEM_PROMPT = "system_prompt"

# Valor por defecto: se siembra en la DB al arrancar si no existe, y sirve de
# fallback si la DB no está disponible.
PROMPT_BASE_DEFECTO = (
    "Sos un asesor vocacional de UNIAGRARIA. Acompañás a estudiantes de "
    "secundaria a entender su resultado del test vocacional y a explorar "
    "programas académicos. Respondés en español, claro y cálido, sin inventar "
    "datos de la institución."
)

agente_instrucciones = Table(
    "agente_instrucciones",
    metadata,
    Column("id", BigInteger, primary_key=True, autoincrement=True),
    Column("clave", String(100), nullable=False, unique=True),
    Column("contenido", Text, nullable=False),
    Column(
        "actualizado_en",
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    ),
)


def sembrar_por_defecto() -> None:
    """Inserta la instrucción por defecto si la clave aún no existe."""
    try:
        with get_engine().begin() as conn:
            existe = conn.execute(
                select(agente_instrucciones.c.id).where(
                    agente_instrucciones.c.clave == CLAVE_SYSTEM_PROMPT
                )
            ).first()
            if not existe:
                conn.execute(
                    insert(agente_instrucciones).values(
                        clave=CLAVE_SYSTEM_PROMPT, contenido=PROMPT_BASE_DEFECTO
                    )
                )
                logger.info("Instrucciones: sembrado el system_prompt por defecto.")
    except Exception:
        logger.exception("Instrucciones: no se pudo sembrar el valor por defecto.")


def obtener_instruccion(clave: str = CLAVE_SYSTEM_PROMPT) -> dict | None:
    """Devuelve {clave, contenido, actualizado_en} o None. Lanza si la DB falla."""
    stmt = select(
        agente_instrucciones.c.clave,
        agente_instrucciones.c.contenido,
        agente_instrucciones.c.actualizado_en,
    ).where(agente_instrucciones.c.clave == clave)
    with get_engine().connect() as conn:
        fila = conn.execute(stmt).first()
    if not fila:
        return None
    return {
        "clave": fila.clave,
        "contenido": fila.contenido,
        "actualizado_en": fila.actualizado_en.isoformat() if fila.actualizado_en else None,
    }


def guardar_instruccion(contenido: str, clave: str = CLAVE_SYSTEM_PROMPT) -> dict:
    """Crea o actualiza (upsert) una instrucción y la devuelve. Lanza si la DB falla."""
    with get_engine().begin() as conn:
        existe = conn.execute(
            select(agente_instrucciones.c.id).where(
                agente_instrucciones.c.clave == clave
            )
        ).first()
        if existe:
            conn.execute(
                update(agente_instrucciones)
                .where(agente_instrucciones.c.clave == clave)
                .values(contenido=contenido)
            )
        else:
            conn.execute(
                insert(agente_instrucciones).values(clave=clave, contenido=contenido)
            )
    return obtener_instruccion(clave)


def obtener_base_segura() -> str:
    """Texto base del system prompt para el agente. Nunca lanza: cae al defecto."""
    try:
        inst = obtener_instruccion(CLAVE_SYSTEM_PROMPT)
        if inst and inst.get("contenido"):
            return inst["contenido"]
    except Exception:
        logger.exception("Instrucciones: no se pudo leer; se usa el valor por defecto.")
    return PROMPT_BASE_DEFECTO
