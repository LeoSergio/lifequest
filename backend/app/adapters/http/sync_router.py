from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update
from datetime import datetime
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

@router.post("/push", response_model=SyncPushResponse)
async def push_sync(
    request: SyncPushRequest, 
    db: AsyncSession = Depends(get_db_session),
    user_id: str = Depends(get_current_user_id)
):
    """
    Recebe os eventos offline criados pelo Frontend e salva no PostgreSQL.
    """
    processed = 0
    for event in request.events:
        model_class = TABLE_TO_MODEL.get(event.entity)
        if not model_class:
            continue # Ignora entidades desconhecidas (ex: player)

        if event.action == "delete":
            # Soft delete: marca deleted = True no registro existente
            stmt = update(model_class).where(
                model_class.id == str(event.entityId),
                model_class.user_id == UUID(user_id)
            ).values(deleted=True, updated_at=datetime.utcnow())
            await db.execute(stmt)
        
        elif event.action == "upsert" and event.payload:
            # Verifica se já existe
            result = await db.execute(select(model_class).where(
                model_class.id == str(event.entityId),
                model_class.user_id == UUID(user_id)
            ))
            existing = result.scalars().first()
            
            # Limpa campos que não estão na tabela SQL ou são controlados por nós
            clean_payload = {k: v for k, v in event.payload.items() if hasattr(model_class, k)}
            clean_payload["updated_at"] = datetime.utcnow()
            
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

        processed += 1
        
    await db.commit()
    return {"success": True, "processed_events": processed}


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
        # Se vier com Z no final, converte corretamente
        if last_sync.endswith('Z'):
            last_sync_date = datetime.fromisoformat(last_sync[:-1])
        else:
            last_sync_date = datetime.fromisoformat(last_sync)
    except ValueError:
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

    return {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "changes": changes
    }
