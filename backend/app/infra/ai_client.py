"""
Implementação concreta do AIProviderInterface usando Groq (principal) e Gemini (fallback).

Esta classe vive em infra/ porque depende de bibliotecas externas (httpx) e de
credenciais de configuração — detalhe de infraestrutura, invisível ao domínio.
"""
import json

import httpx

from app.domain.repositories.ai_provider_interface import AIProviderInterface
from app.infra.config import settings

_GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
_GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

# Groq descontinua modelos com frequência — confira a lista atual em
# https://console.groq.com/docs/models antes de trocar isto.
_GROQ_MODEL = "openai/gpt-oss-120b"


class GroqGeminiProvider(AIProviderInterface):
    """Provedor com fallback automático: tenta Groq primeiro, cai para Gemini se falhar."""

    async def generate_json(self, system_prompt: str, user_prompt: str) -> dict:
        try:
            return await self._call_groq(system_prompt, user_prompt)
        except Exception as groq_error:
            if not settings.gemini_api_key:
                # Sem chave de fallback: relança o erro original da Groq,
                # que é o que realmente importa pra debugar.
                raise groq_error
            return await self._call_gemini(system_prompt, user_prompt)

    async def _call_groq(self, system_prompt: str, user_prompt: str) -> dict:
        """Chamada principal: Groq, baixa latência, resposta em JSON."""
        async with httpx.AsyncClient(timeout=20) as client:
            res = await client.post(
                _GROQ_URL,
                headers={"Authorization": f"Bearer {settings.groq_api_key}"},
                json={
                    "model": _GROQ_MODEL,
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

    async def _call_gemini(self, system_prompt: str, user_prompt: str) -> dict:
        """Fallback: usado se Groq falhar, ou para tarefas multimodais (ex: OCR de nota fiscal)."""
        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.post(
                f"{_GEMINI_URL}?key={settings.gemini_api_key}",
                json={
                    "contents": [{"parts": [{"text": f"{system_prompt}\n\n{user_prompt}"}]}],
                    "generationConfig": {"response_mime_type": "application/json"},
                },
            )
            res.raise_for_status()
            content = res.json()["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(content)


# Instância singleton — injetada nos routers via FastAPI Depends.
ai_provider = GroqGeminiProvider()
