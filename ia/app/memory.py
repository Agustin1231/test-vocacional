"""Memoria de conversación persistida en MySQL.

El servicio de IA administra su propia tabla `conversacion_memoria` (decisión de
arquitectura: la IA conecta directo a MySQL para el historial). La tabla se crea
en `db.init_db()`.

Las operaciones son *best-effort*: si la base no está disponible, se registra el
error y el agente sigue respondiendo (sin memoria) en vez de caerse.
"""
import logging

from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    Index,
    String,
    Table,
    Text,
    func,
    insert,
    select,
)

from .db import get_engine, metadata

logger = logging.getLogger("uvicorn.error")

conversacion_memoria = Table(
    "conversacion_memoria",
    metadata,
    Column("id", BigInteger, primary_key=True, autoincrement=True),
    Column("sesion_id", String(255), nullable=False),
    Column("rol", String(20), nullable=False),  # "user" | "assistant"
    Column("texto", Text, nullable=False),
    Column("creado_en", DateTime, nullable=False, server_default=func.now()),
    Index("idx_sesion", "sesion_id", "id"),
)


def cargar_memoria(sesion_id: str, limite: int = 20) -> list[dict]:
    """Devuelve los últimos `limite` turnos de la sesión, en orden cronológico."""
    try:
        stmt = (
            select(conversacion_memoria.c.rol, conversacion_memoria.c.texto)
            .where(conversacion_memoria.c.sesion_id == sesion_id)
            .order_by(conversacion_memoria.c.id.desc())
            .limit(limite)
        )
        with get_engine().connect() as conn:
            filas = conn.execute(stmt).all()
        return [{"rol": f.rol, "texto": f.texto} for f in reversed(filas)]
    except Exception:
        logger.exception("Memoria: no se pudo leer; se continúa sin historial.")
        return []


def guardar_turno(sesion_id: str, rol: str, texto: str) -> None:
    """Guarda un turno (best-effort)."""
    try:
        stmt = insert(conversacion_memoria).values(
            sesion_id=sesion_id, rol=rol, texto=texto
        )
        with get_engine().begin() as conn:
            conn.execute(stmt)
    except Exception:
        logger.exception("Memoria: no se pudo guardar el turno.")
