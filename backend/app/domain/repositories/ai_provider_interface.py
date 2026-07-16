"""
Interface (porta de saída) para o provedor de IA.

Os use cases dependem desta abstração — nunca de Groq ou Gemini diretamente.
A implementação concreta vive em infra/ai_client.py.
"""
from abc import ABC, abstractmethod


class AIProviderInterface(ABC):
    @abstractmethod
    async def generate_json(self, system_prompt: str, user_prompt: str) -> dict:
        """Envia um prompt ao modelo e retorna a resposta como dict JSON.

        Nunca persiste nada — cada chamada é completamente stateless.
        Implementações concretas devem tratar fallback entre provedores
        sem que os use cases precisem saber disso.
        """
        ...
