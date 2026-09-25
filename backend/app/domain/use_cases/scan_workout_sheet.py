"""
Use Case: scan_workout_sheet

Responsabilidade: receber uma imagem de ficha de treino (ex: foto tirada pelo
usuário de uma ficha do personal), enviar ao Gemini Vision com um prompt
especializado e retornar os exercícios estruturados prontos para salvar no Dexie.

Segue a Regra de Dependência da Clean Architecture:
- Depende APENAS de AIProviderInterface (porta de saída abstrata)
- Não importa nada de infra/, adapters/ ou modelos de banco
"""

from app.domain.repositories.ai_provider_interface import AIProviderInterface

_SYSTEM_PROMPT = """\
Você é um assistente especializado em leitura de fichas de treino de academia.

Analise a imagem fornecida e extraia TODOS os exercícios listados na ficha.
A ficha pode ser manuscrita, impressa, foto de papel, ou captura de tela de um app.

Retorne EXCLUSIVAMENTE um JSON válido com a seguinte estrutura (sem markdown, sem texto extra):

{
  "plan_name_suggestion": "Nome sugerido para o treino baseado no conteúdo",
  "exercises": [
    {
      "name": "Nome do exercício em português",
      "muscle_group": "grupo muscular normalizado",
      "sets": 3,
      "reps": "8-12",
      "rest_seconds": 90
    }
  ]
}

REGRAS OBRIGATÓRIAS:
1. Normalize o campo "muscle_group" para EXATAMENTE um destes valores:
   peitoral | costas | ombro | bíceps | tríceps | pernas | glúteos | abdômen | antebraço | panturrilha | cardio | corpo_todo

2. Para "sets": use número inteiro. Se a ficha mostrar "4x12", sets=4.
3. Para "reps": mantenha como string. Exemplos: "12", "8-12", "15", "até a falha", "Livre".
4. Para "rest_seconds": converta para segundos. "1min" = 60, "90s" = 90. Se não informado, use 90.
5. Se o nome do exercício estiver abreviado ou ilegível, use seu conhecimento para inferir o mais provável.
6. Inclua TODOS os exercícios visíveis, mesmo que estejam em colunas separadas.
7. Mantenha a ordem original da ficha.
"""


async def scan_workout_sheet(
    image_base64: str,
    mime_type: str,
    ai_provider: AIProviderInterface,
) -> dict:
    """
    Envia imagem ao Gemini Vision e retorna exercícios estruturados.

    Args:
        image_base64: Imagem codificada em base64 (com ou sem prefixo data:...)
        mime_type: MIME type da imagem (image/jpeg, image/png, image/webp)
        ai_provider: Instância do provedor de IA injetada pelo adapter

    Returns:
        dict com "plan_name_suggestion" (str) e "exercises" (list[dict])
    """
    result = await ai_provider.generate_from_image(
        image_base64=image_base64,
        mime_type=mime_type,
        prompt=_SYSTEM_PROMPT,
    )

    # Garantia mínima de estrutura para não quebrar o frontend
    if "exercises" not in result:
        result["exercises"] = []
    if "plan_name_suggestion" not in result:
        result["plan_name_suggestion"] = "Ficha Importada"

    # Normaliza campos obrigatórios de cada exercício
    for ex in result["exercises"]:
        ex.setdefault("name", "Exercício")
        ex.setdefault("muscle_group", "corpo_todo")
        ex.setdefault("sets", 3)
        ex.setdefault("reps", "Livre")
        ex.setdefault("rest_seconds", 90)

    return result
