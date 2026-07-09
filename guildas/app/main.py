"""
Microsserviço isolado de Guildas.

Único componente do sistema com estado persistente compartilhado entre
usuários. Guarda estritamente: id do membro, streak coletivo, pontuação
do grupo. Nenhum dado de despensa, treino ou finanças passa por aqui.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict
from upstash_redis import Redis


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    upstash_redis_url: str = ""
    upstash_redis_token: str = ""
    cors_origins: list[str] = ["http://localhost:5173"]


settings = Settings()
redis = Redis(url=settings.upstash_redis_url, token=settings.upstash_redis_token)

app = FastAPI(title="LifeQuest Guildas", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


class JoinGuildRequest(BaseModel):
    guild_id: str
    member_id: str


class StreakPingRequest(BaseModel):
    guild_id: str
    member_id: str


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/guilds/{guild_id}/join")
async def join_guild(guild_id: str, payload: JoinGuildRequest):
    redis.sadd(f"guild:{guild_id}:members", payload.member_id)
    return {"joined": True, "guild_id": guild_id}


@app.post("/guilds/{guild_id}/streak-ping")
async def streak_ping(guild_id: str, payload: StreakPingRequest):
    # Cada ping de membro incrementa a pontuação coletiva da guilda.
    score = redis.incr(f"guild:{guild_id}:score")
    redis.hset(f"guild:{guild_id}:streaks", payload.member_id, "1")
    return {"guild_score": score}


@app.get("/guilds/{guild_id}")
async def get_guild(guild_id: str):
    members = redis.smembers(f"guild:{guild_id}:members")
    score = redis.get(f"guild:{guild_id}:score") or 0
    return {"guild_id": guild_id, "members": list(members), "score": int(score)}
