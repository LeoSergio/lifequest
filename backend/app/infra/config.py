from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Groq = provedor principal (baixa latência). Gemini = fallback/multimodal.
    groq_api_key: str = ""
    gemini_api_key: str = ""
    
    # Credenciais Sociais
    google_client_id: str = "228718930815-9b532nkd4ikhdtl3v72mtgch9ujabltm.apps.googleusercontent.com"

    # Em produção, defina CORS_ORIGINS como JSON no Railway:
    # ["https://seu-app.vercel.app"]
    # Em desenvolvimento, aceita localhost e IPs locais.
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:4173",
    ]

    # Regex para dev local (192.168.x.x ou 10.x.x.x) e produção (https://*.vercel.app)
    cors_origins_regex: str = (
        r"http://(192\.168|10\.\d+)\.\d+\.\d+(:\d+)?"
        r"|https://.*\.vercel\.app"
        r"|https://.*\.railway\.app"
    )

    environment: str = "development"
    database_url: str = "postgresql+asyncpg://lifequest_user:lifequest_password@localhost:5432/lifequest_db"

    # Chave secreta JWT — OBRIGATÓRIO definir no Railway via variável de ambiente
    secret_key: str = "lifequest-super-secret-key-CHANGE-IN-PRODUCTION"


settings = Settings()
