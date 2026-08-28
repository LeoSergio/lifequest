import asyncio
from httpx import AsyncClient

async def test():
    token = "your-token-here"
    async with AsyncClient() as client:
        # Actually I can't test without a valid token.
        pass
