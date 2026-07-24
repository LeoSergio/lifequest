from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.infra.config import settings
from app.adapters.http.ai_router import router as ai_router
from app.adapters.http.auth_router import router as auth_router
from app.adapters.http.sync_router import router as sync_router

app = FastAPI(
    title="LifeQuest Backend",
    description="Ponte stateless entre o app local-first e os provedores de IA.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_origins_regex,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(ai_router)
app.include_router(auth_router)
app.include_router(sync_router)


@app.get("/health")
async def health():
    return {"status": "ok", "environment": settings.environment}
