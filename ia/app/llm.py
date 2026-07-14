"""Cliente del modelo de lenguaje.

El proveedor se elige por variable de entorno `LLM_PROVIDER`:

- "google"     → Gemini directo con una API key de Google AI Studio.
- "openrouter" → OpenRouter (API compatible con OpenAI).

Cambiar de proveedor o de modelo es cambiar variables de entorno, sin tocar el
resto del código.
"""
from langchain_core.language_models.chat_models import BaseChatModel

from .config import settings


def get_llm() -> BaseChatModel:
    provider = settings.llm_provider.lower()

    if provider == "google":
        from langchain_google_genai import ChatGoogleGenerativeAI

        return ChatGoogleGenerativeAI(
            model=settings.google_model,
            google_api_key=settings.google_api_key,
            temperature=0.4,
        )

    if provider == "openrouter":
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            model=settings.openrouter_model,
            api_key=settings.openrouter_api_key,
            base_url=settings.openrouter_base_url,
            temperature=0.4,
        )

    raise ValueError(
        f"LLM_PROVIDER no soportado: '{settings.llm_provider}'. Usá 'google' u 'openrouter'."
    )
