from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import IntegrityError
import uuid

from app.infra.database import get_db_session
from app.infra.models.user_model import UserModel
from app.infra.security import get_password_hash, verify_password, create_access_token
from app.auth_schemas import UserCreate, UserLogin, UserResponse, Token, GoogleLogin
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import os

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
    await db.flush()  # garante que o id seja gerado sem commitar ainda
    await db.refresh(new_user)
    
    return new_user

@router.post("/login", response_model=Token)
async def login(user_credentials: UserLogin, db: AsyncSession = Depends(get_db_session)):
    # Busca usuário
    result = await db.execute(select(UserModel).where(UserModel.email == user_credentials.email))
    user = result.scalars().first()
    
    # Valida senha
    try:
        is_valid = False
        if user and user.hashed_password:
            is_valid = verify_password(user_credentials.password, user.hashed_password)
    except ValueError:
        is_valid = False

    if not user or not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais inválidas",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Gera JWT
    access_token = create_access_token(data={"sub": str(user.id)})
    return {
        "access_token": access_token, 
        "token_type": "bearer", 
        "name": user.username,
        "level": user.level,
        "xp": user.xp,
        "streak_days": user.streak_days,
        "coins": user.coins
    }

@router.post("/google", response_model=Token)
async def login_google(google_data: GoogleLogin, db: AsyncSession = Depends(get_db_session)):
    client_id = "228718930815-9b532nkd4ikhdtl3v72mtgch9ujabltm.apps.googleusercontent.com"
    
    try:
        # Validate Google token
        idinfo = id_token.verify_oauth2_token(google_data.credential, google_requests.Request(), client_id)
        
        email = idinfo.get("email")
        name = idinfo.get("name")
        picture = idinfo.get("picture")
        
        if not email:
            raise HTTPException(status_code=400, detail="E-mail não fornecido pelo Google")
            
        # Check if user exists
        result = await db.execute(select(UserModel).where(UserModel.email == email))
        user = result.scalars().first()
        
        if not user:
            # Create new user for Google login
            base_username = name.lower().replace(" ", "") if name else email.split("@")[0]
            unique_username = f"{base_username}_{str(uuid.uuid4())[:4]}"
            
            user = UserModel(
                email=email,
                username=unique_username,
                hashed_password=None,
                avatar=picture
            )
            db.add(user)
            await db.flush()
            await db.refresh(user)
            
        # Atualiza a foto apenas se for vazia ou se já for uma URL (Google), preservando uploads customizados (base64)
        elif picture and (not user.avatar or user.avatar.startswith("http")):
            user.avatar = picture
            await db.commit()
            
        # Generate JWT
        access_token = create_access_token(data={"sub": str(user.id)})
        return {
            "access_token": access_token, 
            "token_type": "bearer", 
            "name": user.username,
            "level": user.level,
            "xp": user.xp,
            "streak_days": user.streak_days,
            "coins": user.coins
        }
        
    except ValueError as e:
        # Invalid token
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token do Google inválido: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


