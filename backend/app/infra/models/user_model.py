"""
Modelos de banco de dados da Infraestrutura (SQLAlchemy).
Este modelo representa a Tabela real no PostgreSQL.
"""
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import String, Integer, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.infra.database import Base


class UserModel(Base):
    __tablename__ = "users"

    # UUID para não usar IDs previsíveis, bom para APIs públicas
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    
    # Informações de conta (para o futuro Login)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    username: Mapped[str] = mapped_column(String, unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String, nullable=True) # Pode ser null se usar Google Login depois
    
    # Informações de Gamificação (Para o Ranking de Guildas)
    level: Mapped[int] = mapped_column(Integer, default=1)
    xp: Mapped[int] = mapped_column(Integer, default=0)
    streak_days: Mapped[int] = mapped_column(Integer, default=0)
    last_active_date: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    
    # Metadados
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
