"""Cliente del modelo de lenguaje.

Apunta a OpenRouter (API compatible con OpenAI). Cambiar de modelo o proveedor
es cambiar variables de entorno, sin tocar el resto del código.
"""
from langchain_openai import ChatOpenAI

from .config import settings


def get_llm() -> ChatOpenAI:
    return ChatOpenAI(
        model=settings.openrouter_model,
        api_key=settings.openrouter_api_key,
        base_url=settings.openrouter_base_url,
        temperature=0.4,
    )
