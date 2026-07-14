"""Memoria de conversación persistida en MySQL.

El servicio de IA administra su propia tabla `conversacion_memoria` (decisión de
arquitectura: la IA conecta directo a MySQL para el historial). La tabla se crea
sola al arrancar si no existe.

Las operaciones son *best-effort*: si la base no está disponible, se registra el
error y el agente sigue respondiendo (sin memoria) en vez de caerse.
"""
import logging

from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    Index,
    MetaData,
    String,
    Table,
    Text,
    create_engine,
    func,
    insert,
    select,
)

from .config import settings

logger = logging.getLogger("uvicorn.error")

_metadata = MetaData()

conversacion_memoria = Table(
    "conversacion_memoria",
    _metadata,
    Column("id", BigInteger, primary_key=True, autoincrement=True),
    Column("sesion_id", String(255), nullable=False),
    Column("rol", String(20), nullable=False),  # "user" | "assistant"
    Column("texto", Text, nullable=False),
    Column("creado_en", DateTime, nullable=False, server_default=func.now()),
    Index("idx_sesion", "sesion_id", "id"),
)

_engine = None


def _get_engine():
    global _engine
    if _engine is None:
        url = settings.database_url()
        if not url:
            raise RuntimeError("Base de datos no configurada (falta DB_HOST).")
        # pool_pre_ping revive conexiones muertas; pool_recycle evita timeouts de MySQL.
        _engine = create_engine(url, pool_pre_ping=True, pool_recycle=3600)
    return _engine


def init_db() -> None:
    """Crea la tabla si no existe. Se llama una vez al arrancar."""
    _metadata.create_all(_get_engine())
    logger.info("Memoria: tabla 'conversacion_memoria' lista.")


def cargar_memoria(sesion_id: str, limite: int = 20) -> list[dict]:
    """Devuelve los últimos `limite` turnos de la sesión, en orden cronológico."""
    try:
        stmt = (
            select(conversacion_memoria.c.rol, conversacion_memoria.c.texto)
            .where(conversacion_memoria.c.sesion_id == sesion_id)
            .order_by(conversacion_memoria.c.id.desc())
            .limit(limite)
        )
        with _get_engine().connect() as conn:
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
        with _get_engine().begin() as conn:
            conn.execute(stmt)
    except Exception:
        logger.exception("Memoria: no se pudo guardar el turno.")
