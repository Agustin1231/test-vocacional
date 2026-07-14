"""Configuración del servicio, leída de variables de entorno (ver .env.example)."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    # Proveedor del LLM: "google" (API key de Google AI Studio) u "openrouter".
    llm_provider: str = "google"

    # Opción A — Google Gemini directo (API key de Google AI Studio).
    google_api_key: str = ""
    google_model: str = "gemini-2.5-flash-lite"

    # Opción B — OpenRouter (compatible con la API de OpenAI).
    openrouter_api_key: str = ""
    openrouter_model: str = "google/gemini-2.5-flash-lite"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"

    # App.
    app_port: int = 8000
    log_level: str = "info"


settings = Settings()
