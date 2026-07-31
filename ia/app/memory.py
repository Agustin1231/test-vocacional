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

from .config import settings
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


# Cada intercambio con el asesor escribe DOS filas: la pregunta del estudiante y
# la respuesta del agente. La ventana se expresa en intercambios y no en filas
# justamente porque contarla en filas ya confundió una vez: el parámetro se
# llamaba `limite=20` y el docstring prometía "20 turnos", cuando en realidad
# daban 10.
FILAS_POR_INTERCAMBIO = 2

# Cuánto historial se le pasa al modelo, configurable con MEMORIA_INTERCAMBIOS.
INTERCAMBIOS_POR_DEFECTO = settings.memoria_intercambios


def _descartar_respuestas_huerfanas(mensajes: list[dict]) -> list[dict]:
    """Recorta el historial hasta la primera pregunta del estudiante.

    Puede arrancar con el asistente por dos motivos: el corte de la ventana cayó
    en medio de un intercambio, o un `guardar_turno` falló (son best-effort) y
    dejó una fila sin su par. En los dos casos el modelo vería su propia respuesta
    a una pregunta que no está, y sobre eso construye el resto de la conversación.

    Esto es por coherencia del contexto, NO para evitar un error del proveedor:
    se comprobó contra `gemini-flash-lite-latest` que una conversación que
    **empieza** con un mensaje del modelo se acepta sin problema. Lo que la API sí
    rechaza es que el pedido **termine** en turno del modelo
    (`400 INVALID_ARGUMENT: Requests ending with a model turn are not supported`),
    y eso acá no puede pasar: `main.chat` agrega siempre el mensaje nuevo del
    estudiante al final del historial.

    Se descartan TODAS las respuestas iniciales y no solo la primera: con dos
    respuestas seguidas sin pregunta en medio, quitar una dejaba el historial
    igual de incoherente (lo encontró la prueba de `verificar_memoria.py`).
    """
    primera_pregunta = next(
        (i for i, m in enumerate(mensajes) if m.get("rol") != "assistant"), None
    )

    if primera_pregunta is None:
        # Todo el historial son respuestas: no hay ni una pregunta a la que
        # correspondan, así que como contexto no aportan nada y confunden. Mejor
        # arrancar sin memoria.
        if mensajes:
            logger.warning(
                "Memoria: la ventana son %s respuestas sin ninguna pregunta; se "
                "descarta el historial.", len(mensajes)
            )
        return []

    if primera_pregunta > 0:
        logger.info(
            "Memoria: se descartan %s respuesta(s) sin su pregunta al inicio de la ventana.",
            primera_pregunta,
        )
        return mensajes[primera_pregunta:]

    return mensajes


def cargar_memoria(
    sesion_id: str, intercambios: int = INTERCAMBIOS_POR_DEFECTO
) -> list[dict]:
    """Últimos `intercambios` pares pregunta-respuesta, en orden cronológico.

    Se piden los más nuevos (`ORDER BY id DESC` + `LIMIT`) y después se invierten:
    ordenar ascendente y recortar daría los más VIEJOS, o sea justo el historial
    que no importa.
    """
    filas_maximas = max(intercambios, 1) * FILAS_POR_INTERCAMBIO
    try:
        stmt = (
            select(conversacion_memoria.c.rol, conversacion_memoria.c.texto)
            .where(conversacion_memoria.c.sesion_id == sesion_id)
            .order_by(conversacion_memoria.c.id.desc())
            .limit(filas_maximas)
        )
        with get_engine().connect() as conn:
            filas = conn.execute(stmt).all()
        mensajes = [{"rol": f.rol, "texto": f.texto} for f in reversed(filas)]
        return _descartar_respuestas_huerfanas(mensajes)
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
