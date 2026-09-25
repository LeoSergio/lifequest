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
Você é um instrutor de musculação especialista em interpretar fichas de treino de academia.

Sua tarefa: analisar a imagem da ficha de musculação e extrair APENAS E EXCLUSIVAMENTE os exercícios que estão PREENCHIDOS pelo instrutor ou aluno.

== REGRAS CRÍTICAS E OBRIGATÓRIAS ==

REGRA 1 — EXERCÍCIOS NÃO PREENCHIDOS DEVEM SER TOTALMENTE IGNORADOS (CRÍTICO):
- A ficha possui tabelas impressas com dezenas de exercícios possíveis.
- Extraia APENAS os exercícios que têm anotação manuscrita (escrita à mão) de Séries ou Repetições.
- Se as colunas de "Séries" e "Repet." estiverem VAZIAS, EM BRANCO ou sem preenchimento manuscrito, IGNORE o exercício completamente. NÃO o inclua na resposta sob nenhuma hipótese!
- Exemplo: se na seção de Glúteo ou Peito todas as linhas estiverem sem números de séries e repetições anotadas, NÃO retorne nenhum exercício dessa seção.

REGRA 2 — UNIFICAÇÃO DOS TREINOS PELA MESMA LETRA / DIVISÃO (CRÍTICO):
- Observe atentamente os códigos na coluna "Dia":
  1) Códigos com mesma letra pertencem AO MESMO TREINO. Por exemplo: C1, C2, C8, C9, C10 pertencem TODOS ao "Treino C". NUNCA crie múltiplos Treinos C separados! Junte todos os exercícios com letra C em um único "Treino C".
  2) O mesmo vale para A (A1, A7, A8, A9 -> tudo em um único "Treino A") e B (B1, B2, B3... -> tudo em um único "Treino B").
  3) O nome do treino deve indicar a letra e os principais grupos musculares presentes nele. Exemplo: "Treino C - Pernas", "Treino B - Coxa e Glúteo", "Treino A - Bíceps e Ombros".
  4) Não misture exercícios de letras diferentes no mesmo treino.

REGRA 3 — CABEÇALHOS NÃO SÃO EXERCÍCIOS:
- Linhas com fundo cinza/escuro com o nome do grupo muscular (ex: "Coxa", "Glúteo", "Bíceps", "Tríceps", "Antebraço", "Abdominal") são cabeçalhos de seção, NÃO exercícios. Use-as apenas para identificar o grupo muscular e o nome do treino.

REGRA 4 — ANOTAÇÕES MANUSCRITAS NO NOME DO EXERCÍCIO:
- Se houver texto manuscrito complementando o exercício impresso (ex: impresso "Leg press" com manuscrito "45°" -> "Leg press 45°"; impresso "Agachamento livre" com manuscrito "Frontal" -> "Agachamento livre Frontal"; impresso "Rosca Martelo" com manuscrito "45°" -> "Rosca Martelo 45°"; impresso "Tríceps testa" com manuscrito "Polia" -> "Tríceps testa Polia"), inclua essa variação no nome do exercício.

== FORMATO DE RESPOSTA (JSON ESTRITO) ==
Retorne EXCLUSIVAMENTE um JSON válido com esta estrutura:
{
  "workouts": [
    {
      "name": "Nome descritivo da divisão (ex: Treino B - Coxa, ou Treino A - Bíceps)",
      "exercises": [
        {
          "name": "Nome completo do exercício",
          "muscle_group": "pernas | glúteos | bíceps | tríceps | peitoral | ombro | costas | abdômen | antebraço | panturrilha",
          "sets": 4,
          "reps": "8 (ou 1x20+4x8, ou 15)",
          "rest_seconds": 90
        }
      ]
    }
  ]
}

== NORMALIZAÇÃO DO muscle_group ==
Use apenas: peitoral | costas | ombro | bíceps | tríceps | pernas | glúteos | abdômen | antebraço | panturrilha
- Coxa / Quadríceps / Isquiotibiais -> pernas
- Glúteo -> glúteos
- Deltóide / Trapézio -> ombro
- Abdominal -> abdômen
"""


async def scan_workout_sheet(
    image_base64: str | list[dict],
    mime_type: str = "image/jpeg",
    ai_provider: AIProviderInterface = None,
) -> dict:
    """
    Envia imagem ou lista de imagens ao Gemini Vision e retorna exercícios estruturados.

    Args:
        image_base64: Imagem base64 ou lista de dicts [{"image_base64": "...", "mime_type": "..."}]
        mime_type: MIME type padrão caso seja imagem única
        ai_provider: Instância do provedor de IA injetada pelo adapter

    Returns:
        dict com "plan_name_suggestion" (str), "exercises" (list[dict]) e "workouts" (list[dict])
    """
    result = await ai_provider.generate_from_image(
        image_base64=image_base64,
        mime_type=mime_type,
        prompt=_SYSTEM_PROMPT,
    )

    grupos_musculares = {
        "bíceps", "biceps", "tríceps", "triceps", "peitoral", "costas",
        "ombro", "ombros", "pernas", "coxa", "glúteos", "glúteo", "gluteos", "gluteo",
        "abdômen", "abdomen", "abdominal", "antebraço", "antebraco", "panturrilha", "cardio",
    }

    workouts = result.get("workouts", [])
    all_exercises = []

    # Se a IA retornou no formato de lista de workouts
    cleaned_workouts = []
    for w in workouts:
        w_name = w.get("name", "Treino").strip()
        raw_exs = w.get("exercises", [])
        cleaned_exs = []
        for ex in raw_exs:
            ex_name = ex.get("name", "").strip()
            if not ex_name or ex_name.lower() in grupos_musculares:
                continue
            
            # Normalizar sets
            try:
                sets_val = int(ex.get("sets", 4))
            except (ValueError, TypeError):
                sets_val = 4
            
            # Normalizar reps
            reps_val = str(ex.get("reps", "8")).strip() or "8"

            cleaned_ex = {
                "name": ex_name,
                "muscle_group": ex.get("muscle_group", "pernas"),
                "sets": sets_val,
                "reps": reps_val,
                "rest_seconds": int(ex.get("rest_seconds", 90)),
            }
            cleaned_exs.append(cleaned_ex)
            all_exercises.append(cleaned_ex)

        if cleaned_exs:
            cleaned_workouts.append({
                "name": w_name,
                "exercises": cleaned_exs,
            })

    # Unificação determinística por letra de treino (ex: se houver 2 "Treino C", funde em 1 só)
    merged_by_letter = {}
    for w in cleaned_workouts:
        name_lower = w["name"].lower()
        # Detecta se é Treino A, B, C, D...
        match_letter = None
        for letter in ["treino a", "treino b", "treino c", "treino d", "treino e"]:
            if letter in name_lower:
                match_letter = letter
                break
        
        key = match_letter if match_letter else name_lower
        if key in merged_by_letter:
            target = merged_by_letter[key]
            # Adiciona exercícios sem duplicar nome
            for ex in w["exercises"]:
                if not any(e["name"].lower().strip() == ex["name"].lower().strip() for e in target["exercises"]):
                    target["exercises"].append(ex)
        else:
            merged_by_letter[key] = {
                "name": w["name"],
                "exercises": list(w["exercises"])
            }

    cleaned_workouts = list(merged_by_letter.values())

    # Caso a IA retorne no formato antigo direto com "exercises"
    if not cleaned_workouts and "exercises" in result:
        direct_exs = []
        for ex in result["exercises"]:
            ex_name = ex.get("name", "").strip()
            if not ex_name or ex_name.lower() in grupos_musculares:
                continue
            try:
                sets_val = int(ex.get("sets", 4))
            except (ValueError, TypeError):
                sets_val = 4
            reps_val = str(ex.get("reps", "8")).strip() or "8"
            item = {
                "name": ex_name,
                "muscle_group": ex.get("muscle_group", "pernas"),
                "sets": sets_val,
                "reps": reps_val,
                "rest_seconds": int(ex.get("rest_seconds", 90)),
            }
            direct_exs.append(item)
            all_exercises.append(item)
        if direct_exs:
            cleaned_workouts.append({
                "name": result.get("plan_name_suggestion", "Ficha Importada"),
                "exercises": direct_exs,
            })

    plan_name = result.get("plan_name_suggestion")
    if not plan_name and cleaned_workouts:
        plan_name = cleaned_workouts[0]["name"]
    elif not plan_name:
        plan_name = "Ficha Importada"

    return {
        "plan_name_suggestion": plan_name,
        "exercises": all_exercises,
        "workouts": cleaned_workouts,
    }
