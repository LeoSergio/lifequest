from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
import logging
import re
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update
from datetime import datetime, timezone
from uuid import UUID

from app.infra.security import SECRET_KEY, ALGORITHM
from app.infra.database import get_db_session

# Importar todos os modelos do sync_models
from app.infra.models.sync_models import (
    HabitModel, HabitCompletionModel, GoalModel, DailyQuestModel,
    ExerciseModel, WorkoutPlanModel, WorkoutPlanExerciseModel,
    WorkoutSessionModel, SessionSetModel, PantryItemModel,
    BodyMeasurementModel, InventoryModel, UnlockedAchievementModel
)
from app.infra.models.user_model import UserModel

logger = logging.getLogger("lifequest.sync")

router = APIRouter(prefix="/sync", tags=["Sync"])
security = HTTPBearer()

def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Token inválido")
        return user_id
    except Exception:
        raise HTTPException(status_code=401, detail="Token expirado ou inválido")


# Mapeamento do nome da tabela (string do Frontend) para o Modelo SQLAlchemy
TABLE_TO_MODEL = {
    "habits": HabitModel,
    "habitCompletions": HabitCompletionModel,
    "goals": GoalModel,
    "dailyQuests": DailyQuestModel,
    "exercises": ExerciseModel,
    "workoutPlans": WorkoutPlanModel,
    "workoutPlanExercises": WorkoutPlanExerciseModel,
    "workoutSessions": WorkoutSessionModel,
    "sessionSets": SessionSetModel,
    "pantryItems": PantryItemModel,
    "bodyMeasurements": BodyMeasurementModel,
    "inventory": InventoryModel,
    "unlockedAchievements": UnlockedAchievementModel
}

class SyncEvent(BaseModel):
    id: int # ID na syncQueue local
    entity: str # Nome da tabela
    entityId: str # ID do registro afetado
    action: str # "upsert" ou "delete"
    timestamp: str # ISO string
    payload: Optional[Dict[str, Any]] = None # O dado completo

class SyncPushRequest(BaseModel):
    events: List[SyncEvent]

class SyncPushResponse(BaseModel):
    success: bool
    processed_events: int
    # IDs (da syncQueue local) dos eventos que falharam e devem ser
    # mantidos na fila para retry — o frontend só apaga da fila local
    # os eventos que NÃO aparecem aqui.
    failed_events: List[int] = []


async def _apply_event(event: SyncEvent, db: AsyncSession, user_id: str) -> None:
    """
    Aplica um único evento de sync. Lança exceção se o evento for
    inválido/malformado — o chamador decide o que fazer com isso.
    """
    if event.entity == "player" and event.action == "upsert" and event.payload:
        stmt = update(UserModel).where(UserModel.id == UUID(user_id)).values(
            level=event.payload.get("level", 1),
            xp=event.payload.get("xp", 0),
            coins=event.payload.get("coins", 0),
            pro_coins=event.payload.get("proCoins", 0),
            streak_days=event.payload.get("streak", 0),
            avatar=event.payload.get("avatar"),
            updated_at=datetime.now(timezone.utc).replace(tzinfo=None)
        )
        await db.execute(stmt)
        return

    model_class = TABLE_TO_MODEL.get(event.entity)
    if not model_class:
        raise ValueError(f"Entidade desconhecida: '{event.entity}'")

    if event.action == "delete":
        # Soft delete: marca deleted = True no registro existente
        stmt = update(model_class).where(
            model_class.id == str(event.entityId),
            model_class.user_id == UUID(user_id)
        ).values(deleted=True, updated_at=datetime.now(timezone.utc).replace(tzinfo=None))
        await db.execute(stmt)

    elif event.action == "upsert" and event.payload:
        # Verifica se já existe
        result = await db.execute(select(model_class).where(
            model_class.id == str(event.entityId),
            model_class.user_id == UUID(user_id)
        ))
        existing = result.scalars().first()

        # O Dexie usa camelCase (weeklyTarget, habitId…) mas o SQLAlchemy usa
        # snake_case (weekly_target, habit_id…). Convertemos antes de filtrar.
        def camel_to_snake(name: str) -> str:
            s1 = re.sub(r'([A-Z]+)([A-Z][a-z])', r'\1_\2', name)
            return re.sub(r'([a-z0-9])([A-Z])', r'\1_\2', s1).lower()

        snake_payload = {camel_to_snake(k): v for k, v in event.payload.items()}

        # Limpa campos que não são colunas reais da tabela (whitelist, não hasattr:
        # hasattr também é True pra atributos internos do SQLAlchemy como
        # `metadata`/`registry`, que não queremos deixar o payload sobrescrever).
        column_names = model_class.__table__.columns.keys()
        clean_payload = {k: v for k, v in snake_payload.items() if k in column_names}

        # O backend gerencia updated_at (sempre sobrescreve) e created_at
        # (tem default server-side). O frontend envia ambos como strings ISO
        # que o SQLAlchemy DateTime rejeitaria — removemos para usar os defaults.
        clean_payload.pop("created_at", None)
        clean_payload["updated_at"] = datetime.now(timezone.utc).replace(tzinfo=None)

        # Converte ints para strings onde a Model espera string
        if "id" in clean_payload:
            clean_payload["id"] = str(clean_payload["id"])

        if existing:
            for k, v in clean_payload.items():
                setattr(existing, k, v)
            existing.deleted = False
        else:
            clean_payload["user_id"] = UUID(user_id)
            clean_payload["deleted"] = False
            new_record = model_class(**clean_payload)
            db.add(new_record)
    else:
        raise ValueError(f"Ação inválida ou payload ausente: action='{event.action}'")


@router.post("/push", response_model=SyncPushResponse)
async def push_sync(
    request: SyncPushRequest, 
    db: AsyncSession = Depends(get_db_session),
    user_id: str = Depends(get_current_user_id)
):
    """
    Recebe os eventos offline criados pelo Frontend e salva no PostgreSQL.

    Cada evento é aplicado dentro de sua própria SAVEPOINT: se um evento
    for malformado ou violar uma constraint do banco, só ELE é descartado
    (e reportado em `failed_events`) — os demais eventos do lote continuam
    sendo processados e commitados normalmente. Antes, uma falha em
    qualquer evento derrubava o lote inteiro e travava a fila de sync do
    dispositivo indefinidamente, sem nenhum log no servidor.
    """
    processed = 0
    failed_events: List[int] = []

    for event in request.events:
        try:
            async with db.begin_nested():
                await _apply_event(event, db, user_id)
            processed += 1
        except Exception as exc:
            logger.error(
                "Falha ao processar evento de sync id=%s entity=%s action=%s entityId=%s user_id=%s: %s",
                event.id, event.entity, event.action, event.entityId, user_id, exc,
            )
            failed_events.append(event.id)

    # O commit é feito automaticamente pelo context manager de get_db_session
    # (session.begin()). Não chamar db.commit() aqui — causaria
    # InvalidRequestError: "can't commit a subtransaction".
    return {"success": True, "processed_events": processed, "failed_events": failed_events}


@router.get("/pull")
async def pull_sync(
    last_sync: str = "1970-01-01T00:00:00.000Z",
    db: AsyncSession = Depends(get_db_session),
    user_id: str = Depends(get_current_user_id)
):
    """
    Retorna todos os registros que sofreram mudanças (incluindo deletes)
    após o timestamp `last_sync`.
    """
    try:
        # Normaliza o timestamp: remove sufixo 'Z' e qualquer offset timezone (+00:00)
        # para obter um datetime naive (sem tzinfo) compatível com as colunas Postgres.
        # Casos tratados:
        #   "2026-08-01T16:50:19.232144Z"          → fromisoformat ok
        #   "2026-07-28T19:15:15.678403+00:00"      → fromisoformat ok (Python 3.11+)
        #   "2026-07-28T19:15:15.678403+00:00Z"     → duplo sufixo, era o bug
        normalized = last_sync.strip()
        # Remove o 'Z' final se existir (pode ser Z puro ou +00:00Z)
        if normalized.endswith('Z'):
            normalized = normalized[:-1]
        # Remove offset de timezone (+00:00 ou -03:00) se ainda restar
        normalized = re.sub(r'[+-]\d{2}:\d{2}$', '', normalized)
        last_sync_date = datetime.fromisoformat(normalized)
    except (ValueError, AttributeError):
        last_sync_date = datetime.min

    changes = {}

    # Itera por todas as tabelas e busca os atualizados
    for table_name, model_class in TABLE_TO_MODEL.items():
        stmt = select(model_class).where(
            model_class.user_id == UUID(user_id),
            model_class.updated_at > last_sync_date
        )
        result = await db.execute(stmt)
        records = result.scalars().all()
        
        if records:
            changes[table_name] = [
                {c.name: getattr(r, c.name) for c in r.__table__.columns if c.name not in ["user_id", "created_at", "updated_at"]}
                for r in records
            ]
            
            # Formata datetime em ISO para o Javascript
            for record_dict in changes[table_name]:
                for key, val in record_dict.items():
                    if isinstance(val, datetime):
                        record_dict[key] = val.isoformat() + "Z"

    # Puxa o Player (UserModel) se foi alterado recentemente
    user_stmt = select(UserModel).where(
        UserModel.id == UUID(user_id),
        UserModel.updated_at > last_sync_date
    )
    user_result = await db.execute(user_stmt)
    user = user_result.scalars().first()
    if user:
        changes["player"] = [{
            "id": 1,  # int, igual ao autoincrement do Dexie (++id começa em 1)
            "name": user.username,
            "goal": "health",  # campo necessário no Dexie
            "level": user.level,
            "xp": user.xp,
            "streak": user.streak_days,
            "avatar": user.avatar,
            "coins": getattr(user, 'coins', 0) or 0,
            "proCoins": getattr(user, 'pro_coins', 0) or 0,
            "createdAt": user.created_at.isoformat() + "Z" if user.created_at else None
        }]

    return {
        # Formato limpo: "2026-08-01T16:50:19.232144Z" (sem "+00:00")
        # datetime.now(timezone.utc).isoformat() geraria "+00:00Z" (duplo sufixo)
        # que quebrava o próximo pull com TypeError naive vs aware.
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "changes": changes
    }
