from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import IntegrityError
import uuid

from app.infra.database import get_db_session
from app.infra.models.user_model import UserModel
from app.infra.security import get_password_hash, verify_password, create_access_token
from app.auth_schemas import UserResponse, Token, GoogleLogin
from google.oauth2 import id_token
from google.auth.transport import requests
import os

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post("/google", response_model=Token)
async def login_google(google_data: GoogleLogin, db: AsyncSession = Depends(get_db_session)):
    client_id = "228718930815-9b532nkd4ikhdtl3v72mtgch9ujabltm.apps.googleusercontent.com"
    
    try:
        # Validate Google token
        idinfo = id_token.verify_oauth2_token(google_data.credential, requests.Request(), client_id)
        
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
            
        # Update avatar if different
        elif picture and user.avatar != picture:
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
