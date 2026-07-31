"""Extracción de texto de un PDF y troceado en fragmentos indexables.

Por qué trocear y no embeber el documento entero: un embedding es un vector de
tamaño fijo, así que cuanto más texto se le mete, más se promedia y menos
discrimina. Un plan de estudios entero en un solo vector daría la misma similitud
para "materias de Derecho" que para "materias de Veterinaria".

El número de página viaja con cada fragmento para que el agente pueda decir de
dónde salió el dato, que es la diferencia entre citar y sonar convincente.
"""
import io
import logging
import re
from dataclasses import dataclass

from pypdf import PdfReader

from ..config import settings

logger = logging.getLogger("uvicorn.error")


class PdfSinTexto(Exception):
    """El PDF no tiene texto extraíble (típicamente es un escaneo de imágenes)."""


@dataclass(frozen=True)
class Fragmento:
    """Un trozo de documento listo para embeber."""
    orden: int
    pagina: int
    texto: str


def _normalizar(texto: str) -> str:
    """Colapsa espacios y saltos sueltos, conservando los cortes de párrafo.

    Los PDF traen un salto de línea por renglón visual. Si se dejan, el mismo
    párrafo produce fragmentos distintos según dónde cayó el renglón, y el texto
    embebido se llena de ruido que no está en la pregunta del estudiante.
    """
    texto = texto.replace("\r\n", "\n").replace("\r", "\n")
    # Guarda los cortes de párrafo (dos o más saltos) antes de aplanar el resto.
    texto = re.sub(r"\n{2,}", "\x00", texto)
    texto = re.sub(r"[ \t]*\n[ \t]*", " ", texto)
    texto = texto.replace("\x00", "\n\n")
    texto = re.sub(r"[ \t]{2,}", " ", texto)
    return texto.strip()


def extraer_paginas(contenido: bytes) -> list[str]:
    """Texto por página. Lanza `PdfSinTexto` si no hay nada aprovechable.

    Fallar acá es mucho mejor que indexar un documento vacío: si no, el admin
    sube el PDF, ve "1 documento" en el panel y el agente sigue sin saber nada,
    sin un solo error a la vista.
    """
    lector = PdfReader(io.BytesIO(contenido))
    paginas = []
    for numero, pagina in enumerate(lector.pages, start=1):
        try:
            crudo = pagina.extract_text() or ""
        except Exception:
            logger.warning("RAG: no se pudo extraer el texto de la página %s.", numero)
            crudo = ""
        paginas.append(_normalizar(crudo))

    if not any(paginas):
        raise PdfSinTexto(
            "El PDF no tiene texto extraíble: parece un documento escaneado (imágenes). "
            "Hay que pasarlo por OCR o subir la versión digital."
        )
    return paginas


def _cortar(texto: str, largo: int, solape: int) -> list[str]:
    """Parte un texto en trozos de ~`largo`, cortando en un límite natural.

    Se busca el último corte de párrafo, y si no hay, el último punto o espacio
    dentro de la ventana, para no partir una fila de tabla de materias al medio.
    """
    if len(texto) <= largo:
        return [texto]

    trozos: list[str] = []
    inicio = 0
    while inicio < len(texto):
        fin = min(inicio + largo, len(texto))

        if fin < len(texto):
            ventana = texto[inicio:fin]
            # De más natural a menos: párrafo, oración, espacio.
            corte = max(ventana.rfind("\n\n"), ventana.rfind(". "), ventana.rfind(" "))
            # Solo si el corte no deja un trozo ridículamente chico.
            if corte > largo // 2:
                fin = inicio + corte + 1

        trozo = texto[inicio:fin].strip()
        if trozo:
            trozos.append(trozo)

        if fin >= len(texto):
            break
        # `max(...)` garantiza avance: sin eso, un solape >= al trozo cicla para siempre.
        inicio = max(fin - solape, inicio + 1)

    return trozos


def trocear(paginas: list[str]) -> list[Fragmento]:
    """Páginas -> fragmentos numerados, con su página de origen."""
    largo = settings.rag_chunk_chars
    solape = min(settings.rag_chunk_overlap, max(largo - 1, 0))

    fragmentos: list[Fragmento] = []
    for numero, texto in enumerate(paginas, start=1):
        if not texto:
            continue
        for trozo in _cortar(texto, largo, solape):
            fragmentos.append(Fragmento(orden=len(fragmentos), pagina=numero, texto=trozo))
    return fragmentos


def procesar(contenido: bytes) -> tuple[list[Fragmento], int]:
    """Atajo: (fragmentos, cantidad de páginas) de un PDF en memoria."""
    paginas = extraer_paginas(contenido)
    return trocear(paginas), len(paginas)
