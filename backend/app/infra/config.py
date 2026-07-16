from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Groq = provedor principal (baixa latência). Gemini = fallback/multimodal (ex: OCR de nota fiscal).
    groq_api_key: str = ""
    gemini_api_key: str = ""

    cors_origins: list[str] = ["http://localhost:5173"]

    environment: str = "development"
    database_url: str = "postgresql+asyncpg://lifequest_user:lifequest_password@localhost:5432/lifequest_db"


settings = Settings()
