"""Almacén de documentos y fragmentos en pgvector.

Base **aparte** del MySQL de la memoria de conversación, con su propio engine y
su propia `MetaData`. No es un detalle: `db.metadata` lo recorre `db.init_db()`
para crear tablas en MySQL, así que registrar acá las tablas del RAG haría que
intentara crear una columna `vector` en MySQL al arrancar.

Qué se guarda y por qué:

- `rag_documentos` incluye el PDF completo en `bytea`. Ocupa más, pero permite
  re-indexar todo si algún día cambia el modelo de embeddings, sin depender de
  que alguien conserve los archivos originales. Un plan de estudios son unos
  pocos MB: no justifica montar un volumen ni un bucket.
- `rag_fragmentos` guarda el texto y su vector. El texto se guarda además del
  vector porque es lo que se le pasa al modelo: del vector no se vuelve al texto.

Todo el módulo es tolerante a que el RAG no esté configurado: `disponible()`
devuelve False y nadie más se entera.
"""
import hashlib
import logging

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    MetaData,
    String,
    Table,
    Text,
    create_engine,
    delete,
    func,
    insert,
    select,
    text,
)

from ..config import settings
from . import embeddings, pdf

logger = logging.getLogger("uvicorn.error")

metadata_rag = MetaData()

documentos = Table(
    "rag_documentos",
    metadata_rag,
    Column("id", BigInteger, primary_key=True, autoincrement=True),
    # Único: el panel identifica los documentos por nombre, y dos "plan.pdf"
    # distintos serían indistinguibles para quien administra.
    Column("nombre", String(255), nullable=False, unique=True),
    Column("contenido", LargeBinary, nullable=False),
    Column("tamano_bytes", Integer, nullable=False),
    # Único: evita indexar dos veces el mismo archivo con otro nombre, que
    # duplicaría los fragmentos y le daría al modelo el mismo dato dos veces.
    Column("sha256", String(64), nullable=False, unique=True),
    Column("paginas", Integer, nullable=False),
    Column("cantidad_fragmentos", Integer, nullable=False),
    # Se registran para poder detectar más adelante qué documentos quedaron
    # indexados con un modelo viejo.
    Column("modelo_embedding", String(120), nullable=False),
    Column("dimensiones", Integer, nullable=False),
    Column("subido_en", DateTime, nullable=False, server_default=func.now()),
)

fragmentos = Table(
    "rag_fragmentos",
    metadata_rag,
    Column("id", BigInteger, primary_key=True, autoincrement=True),
    # ON DELETE CASCADE: borrar el documento desde el panel tiene que llevarse
    # sus fragmentos, o el agente seguiría citando un PDF que ya no existe.
    Column(
        "documento_id",
        BigInteger,
        ForeignKey("rag_documentos.id", ondelete="CASCADE"),
        nullable=False,
    ),
    Column("orden", Integer, nullable=False),
    Column("pagina", Integer, nullable=False),
    Column("texto", Text, nullable=False),
    Column("embedding", Vector(settings.rag_embedding_dims), nullable=False),
)

# hnsw con distancia coseno: el mismo operador que usa `buscar()`. Un índice con
# otro operador no se usaría y la búsqueda caería a secuencial sin avisar.
Index(
    "ix_rag_fragmentos_embedding",
    fragmentos.c.embedding,
    postgresql_using="hnsw",
    postgresql_ops={"embedding": "vector_cosine_ops"},
)
Index("ix_rag_fragmentos_documento", fragmentos.c.documento_id)


class RagNoConfigurado(Exception):
    """Se pidió una operación de RAG pero falta `VECTOR_STORE_URL`."""


class DocumentoDuplicado(Exception):
    """Ya existe un documento con ese nombre, o con ese mismo contenido."""


_engine = None
_inicializado = False


def disponible() -> bool:
    """True si el RAG está configurado. No comprueba que la base responda."""
    return bool(settings.vector_store_url)


def get_engine():
    global _engine
    if _engine is None:
        if not disponible():
            raise RagNoConfigurado(
                "El RAG no está configurado: falta VECTOR_STORE_URL "
                "(postgresql+psycopg://usuario:password@host:5432/base)."
            )
        _engine = create_engine(
            settings.vector_store_url, pool_pre_ping=True, pool_recycle=3600
        )
    return _engine


def _verificar_dimensiones(conn) -> None:
    """Aborta si la tabla existente usa otra cantidad de dimensiones.

    Pasa cuando alguien cambia `RAG_EMBEDDING_DIMS` (o el modelo) con documentos
    ya indexados. Sin este chequeo, los INSERT fallarían con un error de tipo de
    Postgres en medio de una subida, o peor: la búsqueda compararía vectores de
    espacios distintos y devolvería fragmentos al azar con similitudes creíbles.
    """
    actual = conn.execute(
        text(
            "SELECT a.atttypmod FROM pg_attribute a "
            "JOIN pg_class c ON c.oid = a.attrelid "
            "WHERE c.relname = 'rag_fragmentos' AND a.attname = 'embedding'"
        )
    ).scalar()

    # pgvector guarda la dimensión directamente en atttypmod.
    if actual is not None and actual > 0 and actual != settings.rag_embedding_dims:
        raise RuntimeError(
            f"La tabla rag_fragmentos está creada con vector({actual}) pero la "
            f"configuración pide vector({settings.rag_embedding_dims}). Los vectores "
            "de dos modelos distintos no son comparables: hay que borrar los "
            "documentos y volver a subirlos, o dejar RAG_EMBEDDING_DIMS en el "
            "valor con el que se indexaron."
        )


def init_store() -> bool:
    """Prepara la base (extensión, tablas, índices). Devuelve si quedó lista."""
    global _inicializado

    if not disponible():
        logger.info("RAG: desactivado (VECTOR_STORE_URL vacía).")
        return False

    with get_engine().begin() as conn:
        # La imagen pgvector/pgvector trae la extensión; esto solo la habilita en
        # esta base. El usuario dueño de la base alcanza para crearla.
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))

    with get_engine().begin() as conn:
        _verificar_dimensiones(conn)

    metadata_rag.create_all(get_engine())
    _inicializado = True
    logger.info(
        "RAG: listo (pgvector, %s dims, modelo %s).",
        settings.rag_embedding_dims,
        settings.rag_embedding_model,
    )
    return True


def _asegurar_inicializado() -> None:
    """Inicializa la base si el arranque no pudo.

    El servicio de IA y la base de documentos son contenedores distintos y no hay
    garantía de orden: si la base todavía no aceptaba conexiones cuando arrancó
    el servicio, `init_store()` falló y las tablas no existen. Reintentar acá
    hace que el sistema se arregle solo en cuanto la base aparece, en lugar de
    quedar sin RAG hasta que alguien reinicie el contenedor.
    """
    if _inicializado:
        return
    if not disponible():
        raise RagNoConfigurado(
            "El RAG no está configurado: falta VECTOR_STORE_URL "
            "(postgresql+psycopg://usuario:password@host:5432/base)."
        )
    init_store()


def _fila_a_dict(fila) -> dict:
    return {
        "id": fila.id,
        "nombre": fila.nombre,
        "tamano_bytes": fila.tamano_bytes,
        "paginas": fila.paginas,
        "fragmentos": fila.cantidad_fragmentos,
        "modelo_embedding": fila.modelo_embedding,
        "dimensiones": fila.dimensiones,
        "subido_en": fila.subido_en.isoformat() if fila.subido_en else None,
    }


_COLUMNAS_LISTADO = (
    documentos.c.id,
    documentos.c.nombre,
    documentos.c.tamano_bytes,
    documentos.c.paginas,
    documentos.c.cantidad_fragmentos,
    documentos.c.modelo_embedding,
    documentos.c.dimensiones,
    documentos.c.subido_en,
)


def listar_documentos() -> list[dict]:
    """Documentos indexados, del más nuevo al más viejo. Sin el PDF."""
    _asegurar_inicializado()
    stmt = select(*_COLUMNAS_LISTADO).order_by(documentos.c.subido_en.desc(), documentos.c.id.desc())
    with get_engine().connect() as conn:
        return [_fila_a_dict(f) for f in conn.execute(stmt)]


def guardar_documento(nombre: str, contenido: bytes) -> dict:
    """Indexa un PDF: extrae, trocea, embebe y guarda todo en una transacción.

    Lanza `DocumentoDuplicado` si el nombre o el contenido ya están, y
    `pdf.PdfSinTexto` si el archivo no tiene texto extraíble.
    """
    _asegurar_inicializado()
    nombre = nombre.strip()
    sha = hashlib.sha256(contenido).hexdigest()

    with get_engine().connect() as conn:
        choque = conn.execute(
            select(documentos.c.nombre, documentos.c.sha256).where(
                (documentos.c.nombre == nombre) | (documentos.c.sha256 == sha)
            )
        ).first()

    if choque:
        if choque.sha256 == sha and choque.nombre != nombre:
            raise DocumentoDuplicado(
                f"Ese mismo archivo ya está indexado como '{choque.nombre}'. "
                "Si querés reemplazarlo, borralo primero."
            )
        raise DocumentoDuplicado(
            f"Ya hay un documento llamado '{nombre}'. Para actualizarlo, borralo y subilo de nuevo."
        )

    # Fuera de la transacción a propósito: extraer y embeber es lo lento (una
    # llamada de red por lote). Tener la transacción abierta mientras tanto
    # dejaría un lock inútil sobre la tabla.
    trozos, paginas = pdf.procesar(contenido)
    if not trozos:
        raise pdf.PdfSinTexto("El PDF no produjo ningún fragmento indexable.")

    vectores = embeddings.embeber_documentos([t.texto for t in trozos])

    with get_engine().begin() as conn:
        documento_id = conn.execute(
            insert(documentos)
            .values(
                nombre=nombre,
                contenido=contenido,
                tamano_bytes=len(contenido),
                sha256=sha,
                paginas=paginas,
                cantidad_fragmentos=len(trozos),
                modelo_embedding=settings.rag_embedding_model,
                dimensiones=settings.rag_embedding_dims,
            )
            .returning(documentos.c.id)
        ).scalar_one()

        conn.execute(
            insert(fragmentos),
            [
                {
                    "documento_id": documento_id,
                    "orden": trozo.orden,
                    "pagina": trozo.pagina,
                    "texto": trozo.texto,
                    "embedding": vector,
                }
                for trozo, vector in zip(trozos, vectores)
            ],
        )

    logger.info(
        "RAG: indexado '%s' (%s páginas, %s fragmentos).", nombre, paginas, len(trozos)
    )

    with get_engine().connect() as conn:
        fila = conn.execute(
            select(*_COLUMNAS_LISTADO).where(documentos.c.id == documento_id)
        ).first()
    return _fila_a_dict(fila)


def borrar_documento(documento_id: int) -> str | None:
    """Borra un documento y sus fragmentos. Devuelve su nombre, o None si no existía."""
    _asegurar_inicializado()
    with get_engine().begin() as conn:
        nombre = conn.execute(
            select(documentos.c.nombre).where(documentos.c.id == documento_id)
        ).scalar()
        if nombre is None:
            return None
        # Los fragmentos se van por ON DELETE CASCADE.
        conn.execute(delete(documentos).where(documentos.c.id == documento_id))

    logger.info("RAG: borrado el documento '%s' (id %s).", nombre, documento_id)
    return nombre


def buscar(consulta: str, k: int | None = None) -> list[dict]:
    """Fragmentos más parecidos a la consulta, ya filtrados por similitud.

    Devuelve lista vacía si no hay nada por encima de `RAG_MIN_SIMILITUD`. Que
    devuelva vacío en vez del fragmento menos malo es intencional: así el agente
    dice que no tiene el dato en lugar de improvisar sobre un texto que no viene
    al caso.
    """
    _asegurar_inicializado()
    limite = k or settings.rag_top_k
    vector = embeddings.embeber_consulta(consulta)

    distancia = fragmentos.c.embedding.cosine_distance(vector).label("distancia")
    stmt = (
        select(fragmentos.c.texto, fragmentos.c.pagina, documentos.c.nombre, distancia)
        .join_from(fragmentos, documentos, fragmentos.c.documento_id == documentos.c.id)
        .order_by(distancia)
        .limit(limite)
    )

    with get_engine().connect() as conn:
        filas = conn.execute(stmt).all()

    resultados = []
    for fila in filas:
        similitud = 1.0 - float(fila.distancia)
        if similitud < settings.rag_min_similitud:
            continue
        resultados.append(
            {
                "documento": fila.nombre,
                "pagina": fila.pagina,
                "texto": fila.texto,
                "similitud": round(similitud, 4),
            }
        )
    return resultados


def estado() -> dict:
    """Resumen para diagnóstico: configurado, alcanzable y qué hay indexado."""
    if not disponible():
        return {"configurado": False, "alcanzable": False, "documentos": 0, "fragmentos": 0}

    try:
        with get_engine().connect() as conn:
            total_docs = conn.execute(select(func.count()).select_from(documentos)).scalar_one()
            total_frag = conn.execute(select(func.count()).select_from(fragmentos)).scalar_one()
        return {
            "configurado": True,
            "alcanzable": True,
            "documentos": total_docs,
            "fragmentos": total_frag,
            "modelo_embedding": settings.rag_embedding_model,
            "dimensiones": settings.rag_embedding_dims,
        }
    except Exception as error:
        logger.warning("RAG: la base no responde (%s).", type(error).__name__)
        return {"configurado": True, "alcanzable": False, "documentos": 0, "fragmentos": 0}
