from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Groq = provedor principal (baixa latência). Gemini = fallback/multimodal (ex: OCR de nota fiscal).
    groq_api_key: str = ""
    gemini_api_key: str = ""

    # Em desenvolvimento, aceita localhost e qualquer IP da rede local (192.168.x.x)
    # para permitir testes no celular via Wi-Fi.
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:4173",
    ]

    # Regex para liberar qualquer origin na rede local (192.168.x.x:qualquer_porta)
    cors_origins_regex: str = r"http://192\.168\.\d+\.\d+(:\d+)?"

    environment: str = "development"
    database_url: str = "postgresql+asyncpg://lifequest_user:lifequest_password@localhost:5432/lifequest_db"


settings = Settings()

