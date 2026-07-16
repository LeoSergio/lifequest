"""
Configuração do banco de dados relacional usando SQLAlchemy (Async).

Esta é uma preocupação estrita da camada de Infraestrutura.
"""
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base

from app.infra.config import settings

# Engine assíncrona do SQLAlchemy
engine = create_async_engine(
    settings.database_url,
    echo=(settings.environment == "development"),
)

# Fábrica de sessões para injeção de dependência
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Base para os modelos (Tabelas)
Base = declarative_base()

async def get_db_session() -> AsyncSession:
    """Gera sessões do banco para injetar nos repositórios/routers via Depends()"""
    async with AsyncSessionLocal() as session:
        yield session
