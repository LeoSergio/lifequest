import json

import httpx

from app.config import settings

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

# Groq descontinua modelos com frequência — confira a lista atual em
# https://console.groq.com/docs/models antes de trocar isto.
GROQ_MODEL = "openai/gpt-oss-120b"


class AIClientError(Exception):
    pass


async def call_groq(system_prompt: str, user_prompt: str) -> dict:
    """Chamada principal: Groq, baixa latência, resposta em JSON."""
    async with httpx.AsyncClient(timeout=20) as client:
        res = await client.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {settings.groq_api_key}"},
            json={
                "model": GROQ_MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "response_format": {"type": "json_object"},
            },
        )
        res.raise_for_status()
        content = res.json()["choices"][0]["message"]["content"]
        return json.loads(content)


async def call_gemini(system_prompt: str, user_prompt: str) -> dict:
    """Fallback: usado se Groq falhar, ou para tarefas multimodais (ex: OCR de nota fiscal)."""
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            f"{GEMINI_URL}?key={settings.gemini_api_key}",
            json={
                "contents": [{"parts": [{"text": f"{system_prompt}\n\n{user_prompt}"}]}],
                "generationConfig": {"response_mime_type": "application/json"},
            },
        )
        res.raise_for_status()
        content = res.json()["candidates"][0]["content"]["parts"][0]["text"]
        return json.loads(content)


async def generate_json(system_prompt: str, user_prompt: str) -> dict:
    """Tenta Groq primeiro; cai para Gemini se falhar E houver chave configurada.
    Nunca persiste nada — stateless."""
    try:
        return await call_groq(system_prompt, user_prompt)
    except Exception as groq_error:
        if not settings.gemini_api_key:
            # Sem chave de fallback: relança o erro original da Groq,
            # que é o que realmente importa pra debugar.
            raise groq_error
        return await call_gemini(system_prompt, user_prompt)
