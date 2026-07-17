from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import IntegrityError
import uuid

from app.infra.database import get_db_session
from app.infra.models.user_model import UserModel
from app.infra.security import get_password_hash, verify_password, create_access_token
from app.auth_schemas import UserCreate, UserLogin, UserResponse, Token

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post("/register", response_model=UserResponse)
async def register(user: UserCreate, db: AsyncSession = Depends(get_db_session)):
    # Verifica se e-mail já existe
    result = await db.execute(select(UserModel).where(UserModel.email == user.email))
    existing_user = result.scalars().first()
    if existing_user:
        raise HTTPException(status_code=400, detail="E-mail já está em uso.")
    
    # Cria novo usuário
    hashed_password = get_password_hash(user.password)
    
    # Gera um username único se o nome já estiver em uso
    base_username = user.name.lower().replace(" ", "")
    unique_username = base_username
    
    # Loop simples para garantir username único (ou apenas pegamos um try-except)
    new_user = UserModel(
        email=user.email,
        username=unique_username,
        hashed_password=hashed_password
    )
    db.add(new_user)
    
    try:
        await db.commit()
        await db.refresh(new_user)
    except IntegrityError:
        await db.rollback()
        # Se falhou por unique constraint do username, gera com suffix
        unique_username = f"{base_username}_{str(uuid.uuid4())[:8]}"
        new_user.username = unique_username
        db.add(new_user)
        try:
            await db.commit()
            await db.refresh(new_user)
        except IntegrityError:
            await db.rollback()
            raise HTTPException(status_code=400, detail="Erro de integridade no banco de dados.")
    
    return new_user

@router.post("/login", response_model=Token)
async def login(user_credentials: UserLogin, db: AsyncSession = Depends(get_db_session)):
    # Busca usuário
    result = await db.execute(select(UserModel).where(UserModel.email == user_credentials.email))
    user = result.scalars().first()
    
    # Valida senha
    if not user or not verify_password(user_credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais inválidas",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Gera JWT
    access_token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}
