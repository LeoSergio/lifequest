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
Você é um especialista em leitura de fichas de treino de academia.

Sua tarefa: analisar a imagem e extrair TODOS os exercícios presentes na ficha.

== TIPOS DE FICHA QUE VOCÊ PODE RECEBER ==
- Fichas de caderninho com tabelas impressas + preenchimento manuscrito
- Tabelas com colunas: Exercício | Séries | Repetições | Dia/Código | Carga
- Fichas organizadas por grupo muscular (Bíceps, Tríceps, Peitoral, etc.)
- Fichas divididas em treinos A, B, C com ou sem separação visual clara
- Capturas de tela de apps de treino
- PDFs gerados por personal trainers

== REGRAS CRÍTICAS DE INTERPRETAÇÃO ==

REGRA 1 — CABEÇALHOS NÃO SÃO EXERCÍCIOS:
Linhas com fundo cinza/escuro que contenham APENAS o nome de um grupo muscular
(ex: "Bíceps", "Tríceps", "Peitoral", "Ombro", "Costas") são CABEÇALHOS
de seção, NÃO exercícios. Ignore-as completamente — não as adicione na lista.

REGRA 2 — EXERCÍCIOS SEM SÉRIES/REPS PREENCHIDOS:
Se um exercício está listado mas as colunas de séries e repetições estão em branco
ou com traço (-), ainda assim INCLUA o exercício com valores padrão:
- sets = 3
- reps = "Livre"
Isso é comum em fichas onde o aluno ainda não preencheu os dados.

REGRA 3 — COLUNA "DIA" OU "CÓDIGO":
Fichas brasileiras frequentemente têm uma coluna chamada "Dia" com valores como
A7, A8, B3, C9, etc. Esses são CÓDIGOS DE REFERÊNCIA do personal, NÃO dias
da semana. IGNORE essa coluna completamente — não use esses valores.

REGRA 4 — TEXTO MISTO (impresso + manuscrito):
Algumas fichas têm o nome do exercício impresso e anotações manuscritas ao lado
(ex: "Rosca Martelo - 45°" ou "Tríceps testa Polia"). Combine o texto impresso
e manuscrito para formar o nome completo correto do exercício.

REGRA 5 — EXERCÍCIOS REPETIDOS EM GRUPOS DIFERENTES:
Se a mesma ficha tiver "Rosca direta" no grupo Bíceps e depois no grupo Tríceps
(situação rara), inclua ambos separadamente.

REGRA 6 — FICHAS MULTI-PÁGINA:
Se a imagem mostrar apenas uma parte de uma ficha maior (ex: só Bíceps e Tríceps),
extraia apenas o que está visível. O usuário pode enviar outras partes separadamente.

== FORMATO DE RESPOSTA ==
Retorne EXCLUSIVAMENTE um JSON válido (sem markdown, sem texto antes ou depois):

{
  "plan_name_suggestion": "Nome descritivo baseado nos grupos musculares visíveis",
  "exercises": [
    {
      "name": "Nome completo do exercício em português",
      "muscle_group": "grupo muscular normalizado",
      "sets": 4,
      "reps": "8",
      "rest_seconds": 90
    }
  ]
}

== NORMALIZAÇÃO DO CAMPO muscle_group ==
Use EXATAMENTE um destes valores (em minúsculas, com acento):
peitoral | costas | ombro | bíceps | tríceps | pernas | glúteos | abdômen | antebraço | panturrilha | cardio | corpo_todo

Exemplos de mapeamento:
- Seção "Bíceps" → muscle_group = "bíceps"
- Seção "Triceps" → muscle_group = "tríceps"
- Seção "Abdominal" → muscle_group = "abdômen"
- Seção "Antebraço" → muscle_group = "antebraço"
- Seção "Ombro" ou "Deltóide" → muscle_group = "ombro"

== NORMALIZAÇÃO DOS CAMPOS NUMÉRICOS ==
- sets: número inteiro. "4x8" → sets=4. Em branco → 3.
- reps: string. "8" → "8". "8-12" → "8-12". "até a falha" → "até a falha". Em branco → "Livre".
- rest_seconds: inteiro em segundos. "1min" = 60. "90s" = 90. Não informado = 90.

== EXEMPLO DE SAÍDA ESPERADA para a ficha típica de caderninho ==
Ficha com seções: Bíceps (Rosca direta 4x8, Banco Scott 4x8), Tríceps (Tríceps polia 4x8, Rosca francesa 4x8)

{
  "plan_name_suggestion": "Bíceps, Tríceps e Antebraço",
  "exercises": [
    {"name": "Rosca direta", "muscle_group": "bíceps", "sets": 4, "reps": "8", "rest_seconds": 90},
    {"name": "Banco Scott", "muscle_group": "bíceps", "sets": 4, "reps": "8", "rest_seconds": 90},
    {"name": "Tríceps na polia", "muscle_group": "tríceps", "sets": 4, "reps": "8", "rest_seconds": 90},
    {"name": "Rosca francesa", "muscle_group": "tríceps", "sets": 4, "reps": "8", "rest_seconds": 90}
  ]
}
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
        mime_type: MIME type da imagem ou documento (image/jpeg, image/png, application/pdf)
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

    # Filtra possíveis cabeçalhos que escaparam do prompt (linha sem nome real)
    grupos_musculares = {
        "bíceps", "biceps", "tríceps", "triceps", "peitoral", "costas",
        "ombro", "pernas", "glúteos", "gluteos", "abdômen", "abdomen",
        "abdominal", "antebraço", "antebraco", "panturrilha", "cardio",
    }
    result["exercises"] = [
        ex for ex in result["exercises"]
        if ex.get("name", "").strip().lower() not in grupos_musculares
    ]

    # Normaliza campos obrigatórios de cada exercício
    for ex in result["exercises"]:
        ex.setdefault("name", "Exercício")
        ex.setdefault("muscle_group", "corpo_todo")
        # Garante sets como inteiro
        try:
            ex["sets"] = int(ex.get("sets", 3))
        except (ValueError, TypeError):
            ex["sets"] = 3
        ex.setdefault("reps", "Livre")
        # Garante rest_seconds como inteiro
        try:
            ex["rest_seconds"] = int(ex.get("rest_seconds", 90))
        except (ValueError, TypeError):
            ex["rest_seconds"] = 90

    return result
