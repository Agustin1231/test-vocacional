"""Acceso compartido a MySQL (engine + metadata).

Tanto la memoria de conversación como las instrucciones del agente usan este
mismo engine y metadata, y sus tablas se crean juntas en `init_db()`.
"""
import logging

from sqlalchemy import MetaData, create_engine

from .config import settings

logger = logging.getLogger("uvicorn.error")

metadata = MetaData()

_engine = None


def get_engine():
    """Engine SQLAlchemy (perezoso). Lanza si falta configurar la DB."""
    global _engine
    if _engine is None:
        url = settings.database_url()
        if not url:
            raise RuntimeError("Base de datos no configurada (falta DB_HOST).")
        # pool_pre_ping revive conexiones muertas; pool_recycle evita timeouts de MySQL.
        _engine = create_engine(url, pool_pre_ping=True, pool_recycle=3600)
    return _engine


def init_db() -> None:
    """Crea todas las tablas registradas en `metadata` si no existen."""
    metadata.create_all(get_engine())
    logger.info("DB: tablas creadas/verificadas.")
