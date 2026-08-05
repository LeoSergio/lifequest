from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_, and_, update
import jwt
from uuid import UUID, uuid4
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timezone

from app.infra.security import SECRET_KEY, ALGORITHM
from app.infra.database import get_db_session
from app.infra.models.user_model import UserModel
from app.infra.models.sync_models import FriendshipModel

router = APIRouter(prefix="/social", tags=["Social"])
security = HTTPBearer(auto_error=False)


# ─────────────────────── Auth helpers ────────────────────────

def get_current_user_id_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[str]:
    if credentials is None:
        return None
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except Exception:
        return None


def get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> str:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Token necessário")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token inválido")
        return user_id
    except Exception:
        raise HTTPException(status_code=401, detail="Token expirado ou inválido")


# ─────────────────────── Schemas ────────────────────────

class RankingEntry(BaseModel):
    rank: int
    user_id: str
    username: str
    avatar: Optional[str] = None
    level: int
    xp: int
    streak_days: int
    is_me: bool = False
    friendship_status: Optional[str] = None  # 'accepted' | 'pending_sent' | 'pending_received' | None


class FriendRequestBody(BaseModel):
    username: str

class FriendshipOut(BaseModel):
    id: str
    user_id: str
    username: str
    avatar: Optional[str] = None
    level: int
    status: str  # 'pending' | 'accepted'
    direction: str  # 'sent' | 'received'


# ─────────────────────── Ranking helpers ────────────────────────

async def _friendship_status_for(
    db: AsyncSession, user_id: str, other_user_id: str
) -> Optional[str]:
    """Retorna o status da amizade entre dois usuários do ponto de vista de user_id."""
    uid = UUID(user_id)
    oid = UUID(other_user_id)
    result = await db.execute(
        select(FriendshipModel).where(
            or_(
                and_(FriendshipModel.requester_id == uid, FriendshipModel.addressee_id == oid),
                and_(FriendshipModel.requester_id == oid, FriendshipModel.addressee_id == uid),
            )
        )
    )
    f = result.scalars().first()
    if not f:
        return None
    if f.status == "accepted":
        return "accepted"
    if f.requester_id == uid:
        return "pending_sent"
    return "pending_received"


# ─────────────────────── Endpoints ────────────────────────

@router.get("/ranking/global", response_model=List[RankingEntry])
async def global_ranking(
    db: AsyncSession = Depends(get_db_session),
    current_user_id: Optional[str] = Depends(get_current_user_id_optional),
):
    """Top 100 usuários ordenados por nível → XP → streak. Auth opcional."""
    stmt = select(UserModel).order_by(
        UserModel.level.desc(),
        UserModel.xp.desc(),
        UserModel.streak_days.desc(),
    ).limit(100)

    result = await db.execute(stmt)
    users = result.scalars().all()

    entries = []
    for i, user in enumerate(users, start=1):
        friendship_status = None
        if current_user_id and str(user.id) != current_user_id:
            friendship_status = await _friendship_status_for(db, current_user_id, str(user.id))

        entries.append(RankingEntry(
            rank=i,
            user_id=str(user.id),
            username=user.username,
            avatar=user.avatar,
            level=user.level,
            xp=user.xp,
            streak_days=user.streak_days,
            is_me=(current_user_id is not None and str(user.id) == current_user_id),
            friendship_status=friendship_status,
        ))

    return entries


@router.get("/ranking/friends", response_model=List[RankingEntry])
async def friends_ranking(
    db: AsyncSession = Depends(get_db_session),
    current_user_id: str = Depends(get_current_user_id),
):
    """Ranking entre amigos aceitos do usuário logado + o próprio usuário."""
    uid = UUID(current_user_id)

    # Busca amizades aceitas nas duas direções
    f_stmt = select(FriendshipModel).where(
        FriendshipModel.status == "accepted",
        or_(
            FriendshipModel.requester_id == uid,
            FriendshipModel.addressee_id == uid,
        )
    )
    f_result = await db.execute(f_stmt)
    friendships = f_result.scalars().all()

    # Coleta IDs dos amigos + o próprio usuário
    friend_ids = set()
    for f in friendships:
        friend_ids.add(f.requester_id if f.addressee_id == uid else f.addressee_id)
    friend_ids.add(uid)

    # Busca perfis e ordena
    users_stmt = select(UserModel).where(UserModel.id.in_(friend_ids)).order_by(
        UserModel.level.desc(),
        UserModel.xp.desc(),
        UserModel.streak_days.desc(),
    )
    u_result = await db.execute(users_stmt)
    users = u_result.scalars().all()

    entries = []
    for i, user in enumerate(users, start=1):
        entries.append(RankingEntry(
            rank=i,
            user_id=str(user.id),
            username=user.username,
            avatar=user.avatar,
            level=user.level,
            xp=user.xp,
            streak_days=user.streak_days,
            is_me=(str(user.id) == current_user_id),
            friendship_status="accepted" if str(user.id) != current_user_id else None,
        ))

    return entries


@router.get("/search", response_model=List[RankingEntry])
async def search_users(
    q: str = Query(..., min_length=2),
    db: AsyncSession = Depends(get_db_session),
    current_user_id: str = Depends(get_current_user_id),
):
    """Busca usuários pelo username (parcial, case-insensitive)."""
    stmt = select(UserModel).where(
        UserModel.username.ilike(f"%{q}%"),
        UserModel.id != UUID(current_user_id),
    ).limit(20)

    result = await db.execute(stmt)
    users = result.scalars().all()

    entries = []
    for i, user in enumerate(users, start=1):
        friendship_status = await _friendship_status_for(db, current_user_id, str(user.id))
        entries.append(RankingEntry(
            rank=0,
            user_id=str(user.id),
            username=user.username,
            avatar=user.avatar,
            level=user.level,
            xp=user.xp,
            streak_days=user.streak_days,
            is_me=False,
            friendship_status=friendship_status,
        ))

    return entries


@router.get("/friends", response_model=List[FriendshipOut])
async def list_friends(
    db: AsyncSession = Depends(get_db_session),
    current_user_id: str = Depends(get_current_user_id),
):
    """Lista amigos aceitos do usuário logado."""
    uid = UUID(current_user_id)
    stmt = select(FriendshipModel).where(
        FriendshipModel.status == "accepted",
        or_(FriendshipModel.requester_id == uid, FriendshipModel.addressee_id == uid)
    )
    result = await db.execute(stmt)
    friendships = result.scalars().all()

    out = []
    for f in friendships:
        other_id = f.addressee_id if f.requester_id == uid else f.requester_id
        u_result = await db.execute(select(UserModel).where(UserModel.id == other_id))
        user = u_result.scalars().first()
        if user:
            out.append(FriendshipOut(
                id=str(f.id),
                user_id=str(user.id),
                username=user.username,
                avatar=user.avatar,
                level=user.level,
                status="accepted",
                direction="sent" if f.requester_id == uid else "received",
            ))
    return out


@router.get("/friends/requests", response_model=List[FriendshipOut])
async def list_friend_requests(
    db: AsyncSession = Depends(get_db_session),
    current_user_id: str = Depends(get_current_user_id),
):
    """Solicitações de amizade pendentes recebidas pelo usuário logado."""
    uid = UUID(current_user_id)
    stmt = select(FriendshipModel).where(
        FriendshipModel.addressee_id == uid,
        FriendshipModel.status == "pending"
    )
    result = await db.execute(stmt)
    friendships = result.scalars().all()

    out = []
    for f in friendships:
        u_result = await db.execute(select(UserModel).where(UserModel.id == f.requester_id))
        user = u_result.scalars().first()
        if user:
            out.append(FriendshipOut(
                id=str(f.id),
                user_id=str(user.id),
                username=user.username,
                avatar=user.avatar,
                level=user.level,
                status="pending",
                direction="received",
            ))
    return out


@router.post("/friends/request")
async def send_friend_request(
    body: FriendRequestBody,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: str = Depends(get_current_user_id),
):
    """Envia solicitação de amizade por username."""
    # Busca o destinatário
    result = await db.execute(select(UserModel).where(UserModel.username == body.username))
    addressee = result.scalars().first()
    if not addressee:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    uid = UUID(current_user_id)
    aid = addressee.id

    if uid == aid:
        raise HTTPException(status_code=400, detail="Você não pode adicionar a si mesmo")

    # Verifica se já existe amizade em qualquer estado
    existing = await db.execute(
        select(FriendshipModel).where(
            or_(
                and_(FriendshipModel.requester_id == uid, FriendshipModel.addressee_id == aid),
                and_(FriendshipModel.requester_id == aid, FriendshipModel.addressee_id == uid),
            )
        )
    )
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail="Já existe uma solicitação ou amizade com este usuário")

    friendship = FriendshipModel(
        id=uuid4(),
        requester_id=uid,
        addressee_id=aid,
        status="pending",
    )
    db.add(friendship)
    await db.flush()
    return {"message": "Solicitação enviada!", "friendship_id": str(friendship.id)}


@router.post("/friends/accept/{friendship_id}")
async def accept_friend_request(
    friendship_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: str = Depends(get_current_user_id),
):
    """Aceita uma solicitação de amizade pendente."""
    uid = UUID(current_user_id)
    result = await db.execute(
        select(FriendshipModel).where(
            FriendshipModel.id == UUID(friendship_id),
            FriendshipModel.addressee_id == uid,
            FriendshipModel.status == "pending",
        )
    )
    friendship = result.scalars().first()
    if not friendship:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada")

    friendship.status = "accepted"
    friendship.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.flush()
    return {"message": "Amizade aceita!"}


@router.delete("/friends/{friendship_id}")
async def remove_friend(
    friendship_id: str,
    db: AsyncSession = Depends(get_db_session),
    current_user_id: str = Depends(get_current_user_id),
):
    """Remove amigo ou recusa/cancela solicitação."""
    uid = UUID(current_user_id)
    result = await db.execute(
        select(FriendshipModel).where(
            FriendshipModel.id == UUID(friendship_id),
            or_(
                FriendshipModel.requester_id == uid,
                FriendshipModel.addressee_id == uid,
            )
        )
    )
    friendship = result.scalars().first()
    if not friendship:
        raise HTTPException(status_code=404, detail="Amizade não encontrada")

    await db.delete(friendship)
    await db.flush()
    return {"message": "Removido com sucesso"}
