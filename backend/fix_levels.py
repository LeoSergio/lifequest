import asyncio
import math
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.infra.database import AsyncSessionLocal
from app.infra.models.user_model import UserModel

def xp_to_next_level(level):
    if level < 5: return level * 50
    if level < 15: return 200 + (level - 4) * 150
    return 1700 + int(math.pow(level - 14, 1.8) * 100)

async def run():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(UserModel))
        users = result.scalars().all()
        for user in users:
            level = user.level
            xp = user.xp
            changed = False
            
            while xp >= xp_to_next_level(level):
                xp -= xp_to_next_level(level)
                level += 1
                changed = True
                
            if changed:
                print(f"Fixing {user.username}: Level {user.level} -> {level}, XP {user.xp} -> {xp}")
                user.level = level
                user.xp = xp
                
        await db.commit()
        print("Done!")

if __name__ == "__main__":
    asyncio.run(run())
