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

    # --- RAG sobre documentos de la institución (plan de estudios) ---
    # URL de conexión a la base pgvector, formato SQLAlchemy:
    #   postgresql+psycopg://usuario:password@host:5432/base
    # Si queda VACÍA el RAG está desactivado: el agente arranca igual y responde
    # igual, solo que sin la herramienta de búsqueda (ver agent/graph.py). Es la
    # degradación buscada: una base de documentos caída no puede tumbar el chat.
    vector_store_url: str = ""

    rag_embedding_model: str = "models/gemini-embedding-001"

    # 768 y no 3072 (el default del modelo) por un límite de pgvector: sus índices
    # hnsw e ivfflat no soportan más de 2000 dimensiones, así que con 3072 la
    # búsqueda quedaría siempre en secuencial. `gemini-embedding-001` acepta
    # `output_dimensionality`, así que se pide directamente en 768.
    #
    # OJO: cambiar este número después de haber indexado NO re-indexa nada. La
    # columna `vector(n)` se crea con este valor y `rag/store.py` aborta ruidosamente
    # si no coincide con la tabla existente, en vez de guardar vectores incomparables.
    rag_embedding_dims: int = 768

    # Cuántos fragmentos devuelve la herramienta de búsqueda.
    rag_top_k: int = 5

    # Piso de similitud coseno (0 a 1) para que un fragmento se considere
    # relevante. Por debajo se descarta: es preferible que el agente diga que no
    # encontró el dato a que responda con el fragmento menos malo.
    rag_min_similitud: float = 0.45

    # Tope de tamaño del PDF que se acepta subir.
    rag_max_pdf_mb: int = 20

    # Troceado del texto antes de embeber. ~1200 caracteres es del orden de un
    # párrafo largo: suficiente para que el fragmento se entienda solo, y chico
    # como para no diluir el embedding. El solape evita cortar una tabla de
    # materias justo en el límite.
    rag_chunk_chars: int = 1200
    rag_chunk_overlap: int = 150

    # Cuántos intercambios (pregunta + respuesta) del historial se le pasan al
    # modelo en cada mensaje. Es una VENTANA: más allá de esto el agente se olvida
    # del principio de la conversación, sin avisar.
    #
    # Se cuenta en intercambios y no en filas de la tabla, que son el doble (ver
    # memory.py). Subirlo encarece todas las respuestas de la conversación, porque
    # el historial entero viaja al modelo en cada pregunta.
    memoria_intercambios: int = 10

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
