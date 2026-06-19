# Planejamento por Etapas — LifeQuest

> Documento vivo. Cada etapa só começa depois que a anterior estiver
> concluída, para evitar confundir os passos.

## Etapa 0 — Configuração inicial do repositório ✅
Estrutura de pastas, README, .gitignore, este documento.

## Etapa 1 — Arquitetura e contratos
- Schema do banco local (Dexie.js / IndexedDB)
- Contrato da API FastAPI (rotas, payloads)
- Design dos prompts enviados à IA
- **Decisão de arquitetura (Guildas) — resolvida**: microsserviço isolado
  (`guildas/`) com Redis (Upstash), guardando apenas id do membro, streak
  coletivo e pontuação de grupo. Backend principal continua 100% stateless.
  Usuário é avisado explicitamente ao entrar em uma Guilda.

## Etapa 2 — Setup do frontend PWA
- Vite + Svelte (SPA) + Tailwind
- Dexie.js (schema inicial) + liveQuery
- vite-plugin-pwa (manifest.json + service worker, instalável, offline-first)

## Etapa 3 — Setup do backend FastAPI
- FastAPI + Pydantic v2 + httpx, stateless
- Rota proxy para IA: Groq (principal) / Gemini (fallback/multimodal)
- Dockerfile para deploy em Fly.io/Render

## Etapa 4 — Pilar 1: Onboarding & Dashboard
- Quiz de arquétipo (Classe do usuário, via IA)
- Painel de status: nível, XP, streak
- 3 missões iniciais geradas no dia 1

## Etapa 5 — Pilar 2: Gestão do Lar & Inteligência Financeira
- OCR de nota fiscal (Tesseract.js) → popula Despensa
- Lista dinâmica organizada por corredor (Hortifruti, Limpeza, etc.)
- Estimativa de preço final vs. orçamento
- Modo Crise Financeira (recalcula rotina/treino/dieta para orçamento apertado)

## Etapa 6 — Pilar 3: Academia & Nutrição Sincronizada
- Ficha de Treino Adaptativa: IA gera treino, coleta feedback
  (Fácil/Ideal/Muito Difícil) para calibrar a próxima sessão; conclusão rende XP
- Loop de Receitas e Despensa ("Ciclo de Ouro"): IA cruza itens da Despensa
  (pós-OCR) com o Objetivo de Treino (ex.: hipertrofia) e sugere receitas
  que evitam desperdício e economizam dinheiro

## Etapa 7 — Pilar 4: Disciplina & Social
- Missões Auto-Ajustáveis: IA reduz a exigência da missão após falhas
  repetidas, em vez de punir (ex.: "6h" → "6h30")
- Guildas: grupos via link de convite, recompensas/perdas coletivas baseadas
  em constância do grupo (não em performance individual)
- Consome o microsserviço `guildas/` definido na Etapa 1

## Etapa 8 — Motor de gamificação transversal
- Geração dinâmica de missões via IA (compartilhada entre os 4 pilares)
- Regras de XP/nível unificadas

## Etapa 9 — Polimento PWA
- Offline-first, ícones, testes, performance

## Stack consolidada (referência rápida)

\`\`\`
Frontend:  Vite + Svelte (SPA) + Tailwind + Dexie.js (liveQuery) + Tesseract.js + vite-plugin-pwa
Backend:   FastAPI + Pydantic v2 + httpx + Docker
IA:        Groq (principal) + Gemini (fallback/multimodal)
Guildas:   Redis (Upstash) — microsserviço isolado, único ponto não-stateless
Testes:    Vitest (front) / pytest (back)
CI/CD:     GitHub Actions
Deploy:    Cloudflare Pages (front) + Fly.io/Render (back) + Upstash (guildas)
\`\`\`
