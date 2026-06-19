# LifeQuest (nome provisório)

PWA gamificado para gestão doméstica: compras, nutrição, exercícios e hábitos
unificados como um RPG, com missões geradas por IA.

## Filosofia

- **Privacidade extrema (Local-First)**: nenhum dado pessoal em nuvem.
  Tudo fica no IndexedDB do dispositivo, via Dexie.js. Única exceção: estado
  mínimo de Guildas, sincronizado de forma explícita e isolada (ver seção
  Arquitetura).
- **Atrito zero**: entrada de dados pesados via OCR local (Tesseract.js),
  nunca digitação manual de notas fiscais.
- **Retenção emocional**: Modo Crise Financeira, Loop de Receitas e Despensa,
  e pressão social positiva das Guildas criam vínculo de lealdade.

## Pilares

1. **Início da Jornada** — Onboarding (quiz de arquétipo) & Dashboard (nível, XP, streak, missões iniciais)
2. **Gestão do Lar & Inteligência Financeira** — OCR de nota fiscal, despensa, lista por corredor, Modo Crise Financeira
3. **Academia & Nutrição Sincronizada** — Ficha de treino adaptativa, Loop de Receitas e Despensa
4. **Disciplina & Social** — Missões auto-ajustáveis, Guildas

## Stack

### Frontend (`frontend/`)
- Vite + Svelte (SPA, sem SvelteKit)
- Tailwind CSS
- Dexie.js (IndexedDB) com `liveQuery` para reatividade
- Tesseract.js (OCR local de notas fiscais)
- vite-plugin-pwa (manifest + service worker)
- Vitest (testes)

### Backend (`backend/`)
- FastAPI + Pydantic v2
- httpx (cliente async para chamadas à IA)
- Docker
- pytest (testes)
- IA: Groq (principal, baixa latência) com Gemini como fallback/multimodal
- 100% stateless — não persiste nenhum dado pessoal do usuário

### Guildas (`guildas/` — microsserviço isolado)
- Redis (Upstash, free tier)
- Único componente do sistema com estado persistente compartilhado entre
  usuários, e estritamente limitado a: id do membro, streak coletivo,
  pontuação do grupo. Nenhum dado de despensa, treino ou finanças passa
  por aqui. O usuário é avisado explicitamente ao entrar em uma Guilda.

### Infraestrutura
- Frontend: Cloudflare Pages (ou Vercel)
- Backend: Fly.io ou Render
- Guildas (Redis): Upstash
- CI/CD: GitHub Actions

## Arquitetura

- `frontend/`: PWA local-first
- `backend/`: ponte stateless para a IA
- `guildas/`: microsserviço isolado para estado social mínimo (ver Stack acima)

Planejamento detalhado por etapas: ver `docs/PLANEJAMENTO.md`.
