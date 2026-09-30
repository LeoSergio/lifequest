# LifeQuest

PWA gamificado para gestão doméstica: compras, nutrição, exercícios e hábitos
unificados como um RPG, com missões geradas por IA.

## Status Atual

> 🚀 **Backend em produção na AWS** — instância EC2 em `15.228.160.215:8000`, respondendo a chamadas de IA, autenticação e sincronização.

### Funcionalidades implementadas

| Módulo | Status | Descrição |
|---|---|---|
| **Autenticação** | ✅ Implementado | Registro e login com e-mail/senha; Google OAuth; JWT com 7 dias de validade |
| **Onboarding com IA** | ✅ Implementado | Quiz de arquétipo RPG → perfil gerado pela IA (Groq + Gemini fallback) |
| **Missões diárias (IA)** | ✅ Implementado | 3 missões personalizadas por nível e pilares, geradas dinamicamente |
| **Missão épica (IA)** | ✅ Implementado | Missão de longo prazo gerada pela IA com base nos objetivos do usuário |
| **Hábitos** | ✅ Implementado | Criação, conclusão e acompanhamento de hábitos com XP e streaks |
| **Objetivos / Metas** | ✅ Implementado | Metas com valor alvo, progresso e recompensa de XP |
| **Treinos** | ✅ Implementado | Fichas de treino (planos + exercícios), sessões com sets, histórico e métricas |
| **Plano de treino por IA** | ✅ Implementado | Geração de ficha completa de treino por objetivo via IA |
| **Calibração de treino** | ✅ Implementado | Ajuste automático de carga/reps com base em feedback pós-sessão |
| **Ranking social** | ✅ Implementado | Ranking global (top 100) e entre amigos, com controle de privacidade |
| **Amizades** | ✅ Implementado | Solicitação, aceite e remoção de amigos; busca por username |
| **Perfil do jogador** | ✅ Implementado | Level, XP, coins, streak, avatar e visibilidade no ranking |
| **Sincronização offline** | ✅ Implementado | Push/Pull delta com SAVEPOINT por evento; app funciona 100% sem internet |
| **Sugestão de refeições** | ✅ Implementado | IA sugere até 3 refeições com base no contexto do usuário |
| **Geração de receitas** | ✅ Implementado | Receitas geradas com base na despensa do usuário |
| **Estatísticas** | ✅ Implementado | Histórico de treinos, medidas corporais e evolução |
| **Despensa (Pantry)** | 🚧 Em desenvolvimento | Controle de ingredientes e lista de compras |
| **Loja (Shop)** | 🚧 Em desenvolvimento | Itens e power-ups com coins do jogo |
| **Pagamentos PRO** | 🏗️ Planejado | Mercado Pago — plano mensal (R$ 4,99) e vitalício (R$ 19,99) |

---

## Filosofia

- **Privacidade extrema (Local-First)**: nenhum dado pessoal sensível em nuvem.
  Tudo fica no IndexedDB do dispositivo, via Dexie.js. O backend é um espelho para backup e funcionalidades sociais.
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
- SQLAlchemy 2.0 async + asyncpg + PostgreSQL 15
- PyJWT + bcrypt (autenticação)
- httpx (cliente async para chamadas à IA)
- Docker
- pytest (testes)
- IA: Groq (principal, baixa latência) com Gemini como fallback/multimodal
- 100% stateless do ponto de vista de negócio

### Guildas (`guildas/` — microsserviço isolado)
- Redis (Upstash, free tier)
- Único componente do sistema com estado persistente compartilhado entre
  usuários, e estritamente limitado a: id do membro, streak coletivo,
  pontuação do grupo. Nenhum dado de despensa, treino ou finanças passa
  por aqui. O usuário é avisado explicitamente ao entrar em uma Guilda.

### Infraestrutura

| Componente | Plataforma |
|---|---|
| **Backend (API + AI Gateway)** | **AWS EC2** — `15.228.160.215:8000` |
| **Banco de dados** | PostgreSQL (containerizado na EC2 via Docker) |
| **Frontend** | Vercel (PWA estática) |
| **Guildas (Redis)** | Upstash (free tier) |
| **CI/CD** | GitHub Actions |

## Arquitetura

- `frontend/`: PWA local-first (IndexedDB como fonte da verdade)
- `backend/`: AI Gateway + sincronização stateless + módulo social
- `guildas/`: microsserviço isolado para estado social mínimo (ver Stack acima)

---

## 📚 Documentação Técnica

Documentação detalhada de cada camada do sistema, gerada a partir do código-fonte:

| Documento | Descrição |
|---|---|
| [`docs/FRONTEND.md`](docs/FRONTEND.md) | Stack (Svelte + Vite + Dexie.js), arquitetura local-first, schema IndexedDB (10 versões), sync engine, rotas, componentes, serviços e gamificação |
| [`docs/BACKEND.md`](docs/BACKEND.md) | Arquitetura clean/hexagonal (FastAPI), todos os endpoints REST, use cases de IA, autenticação JWT + Google OAuth, pagamentos (Mercado Pago) e deploy |
| [`docs/DATABASE.md`](docs/DATABASE.md) | Schema PostgreSQL (16 tabelas), padrão SyncBase, histórico das 14 migrations Alembic, índices, soft delete e decisões de design |

> Para a arquitetura geral do sistema (C4 model, fluxos e guildas), veja também [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Ambiente de desenvolvimento

Setup rápido (cria `.env` a partir dos exemplos e instala dependências):

```bash
./scripts/setup.sh
```

Depois, rode cada serviço em um terminal:

```bash
# 1) Frontend (PWA local-first)
cd frontend && npm run dev            # http://localhost:5173

# 2) Backend (ponte stateless para IA)
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload   # http://localhost:8000

# 3) Guildas (microsserviço isolado, precisa de Redis do Upstash)
cd guildas && source .venv/bin/activate && uvicorn app.main:app --reload --port 8001
```

Ou, para subir backend + guildas via Docker:

```bash
docker compose up --build
```

Antes de rodar, preencha as chaves nos `.env`:
- `backend/.env`: `DATABASE_URL`, `SECRET_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`
- `guildas/.env`: `UPSTASH_REDIS_URL`, `UPSTASH_REDIS_TOKEN` (crie um banco free no [Upstash](https://upstash.com))
- `frontend/.env.local`: `VITE_API_URL` (ex.: `http://localhost:8000` para dev local)

O Vite já faz proxy de `/api` para `http://localhost:8000`, então o frontend não precisa de configuração extra em dev.
