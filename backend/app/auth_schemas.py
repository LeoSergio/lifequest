from uuid import UUID
from pydantic import BaseModel

class UserCreate(BaseModel):
    name: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class GoogleLogin(BaseModel):
    credential: str

class UserResponse(BaseModel):
    id: UUID
    username: str
    email: str
    level: int
    xp: int
    streak_days: int

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    name: str | None = None
    level: int = 1
    xp: int = 0
    streak_days: int = 0
    coins: int = 0
    is_new_user: bool = False
