"""Seguridad del servicio: verificación de API key.

El servicio de IA no es público: solo lo consume el backend (.NET) por red
interna. Exigimos una clave compartida en el header `X-API-Key`. La comparación
es de tiempo constante para no filtrar información por timing.
"""
import secrets

from fastapi import Header, HTTPException, status

from .config import settings


def verificar_api_key(x_api_key: str = Header(default="", alias="X-API-Key")) -> None:
    esperada = settings.service_api_key

    # Fail-closed: sin clave configurada en el servidor, no se atiende a nadie.
    if not esperada:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="El servicio no tiene SERVICE_API_KEY configurada.",
        )

    if not secrets.compare_digest(x_api_key, esperada):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key inválida o ausente.",
        )
