import asyncio
from httpx import AsyncClient
from app.infra.database import AsyncSessionLocal
from app.infra.models.user_model import UserModel
from sqlalchemy import update, select

async def main():
    # Force a user to have hashed_password = None to simulate Google User
    async with AsyncSessionLocal() as db:
        async with db.begin():
            u = await db.execute(select(UserModel).where(UserModel.username == 'test'))
            u = u.scalars().first()
            if u:
                u.hashed_password = None
            
    async with AsyncClient() as client:
        # Login test user
        # wait, we can't login with password if it's None!
        pass

asyncio.run(main())
