"""Configuración del servicio, leída de variables de entorno (ver .env.example)."""
from urllib.parse import quote_plus

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    # Proveedor del LLM: "google" (API key de Google AI Studio) u "openrouter".
    llm_provider: str = "google"

    # Opción A — Google Gemini directo (API key de Google AI Studio).
    google_api_key: str = ""
    google_model: str = "gemini-flash-lite-latest"

    # Opción B — OpenRouter (compatible con la API de OpenAI).
    openrouter_api_key: str = ""
    openrouter_model: str = "google/gemini-2.5-flash-lite"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"

    # Seguridad: clave que debe enviar quien consume el servicio (el backend .NET)
    # en el header `X-API-Key`. Si está vacía, el servicio rechaza todo (fail-closed).
    service_api_key: str = ""

    # Rate limit por estudiante (formato de slowapi, p. ej. "20/minute").
    # La clave la resuelve `main._clave_rate_limit` con la cabecera X-Cliente-IP.
    rate_limit: str = "20/minute"

    # Base de datos MySQL (memoria de conversación). Mismos nombres que el backend.
    db_host: str = ""
    db_port: int = 3306
    db_name: str = "test_vocacional"
    db_user: str = ""
    db_password: str = ""

    # App. El puerto lo fija el Dockerfile (uvicorn --port 8000): no es
    # configurable por variable, así que no se declara acá para no prometerlo.
    log_level: str = "info"

    def database_url(self) -> str:
        """URL de conexión SQLAlchemy (driver PyMySQL). Vacía si falta el host."""
        if not self.db_host:
            return ""
        return (
            f"mysql+pymysql://{self.db_user}:{quote_plus(self.db_password)}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}?charset=utf8mb4"
        )


settings = Settings()
