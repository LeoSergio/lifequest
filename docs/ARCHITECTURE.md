# LifeQuest — Documentação de Arquitetura

> **Versão:** 0.1.0 (Beta) | **Atualizado em:** Agosto 2026

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Stack Tecnológico](#2-stack-tecnológico)
3. [Arquitetura do Sistema](#3-arquitetura-do-sistema)
4. [Backend — API Principal](#4-backend--api-principal)
5. [Serviço Guildas](#5-serviço-guildas)
6. [Frontend — PWA Local-First](#6-frontend--pwa-local-first)
7. [Banco de Dados](#7-banco-de-dados)
8. [Sistema de Sincronização](#8-sistema-de-sincronização)
9. [Gamificação](#9-gamificação)
10. [Inteligência Artificial](#10-inteligência-artificial)
11. [Autenticação e Segurança](#11-autenticação-e-segurança)
12. [Monetização e Planos](#12-monetização-e-planos)
13. [Infraestrutura e Deploy](#13-infraestrutura-e-deploy)
14. [Variáveis de Ambiente](#14-variáveis-de-ambiente)

---

## 1. Visão Geral

**LifeQuest** é uma aplicação de produtividade e saúde gamificada, construída como **PWA (Progressive Web App) com arquitetura local-first**. O usuário interage com dados armazenados localmente no dispositivo (IndexedDB via Dexie.js), e esses dados são sincronizados com a nuvem de forma assíncrona e transparente.

### Filosofia Central

- **Offline-first:** a aplicação funciona 100% sem internet. A sincronização é um bônus, não um requisito.
- **Gamificação real:** sistema de XP, níveis (1–67), streaks, conquistas, missões diárias e épicas geradas por IA.
- **Privacidade por design:** os dados do usuário vivem no dispositivo dele. O backend é um intermediário stateless.
- **IA como assistente:** geração de planos de treino, receitas, missões e arquétipos de jogador via LLM.

---

## 2. Stack Tecnológico

### Frontend
| Tecnologia | Uso |
|---|---|
| **Svelte 4** | Framework reativo de componentes |
| **Vite 5** | Bundler e dev server |
| **Dexie.js 4** | Wrapper para IndexedDB (banco local) |
| **Tailwind CSS 3** | Estilização utilitária |
| **Chart.js 4** | Gráficos de métricas e progresso |
| **vite-plugin-pwa** | Geração do Service Worker e manifest |
| **Tesseract.js** | OCR para leitura de cupons fiscais |
| **jsPDF** | Exportação de treinos em PDF |
| **Vercel Analytics** | Telemetria de uso |

### Backend
| Tecnologia | Uso |
|---|---|
| **FastAPI** | Framework web assíncrono (Python) |
| **SQLAlchemy 2 (async)** | ORM com suporte a asyncpg |
| **PostgreSQL 15** | Banco de dados relacional |
| **Alembic** | Migrações de banco de dados |
| **PyJWT** | Geração e validação de tokens JWT |
| **bcrypt / passlib** | Hashing de senhas |
| **google-auth** | Validação de tokens OAuth2 do Google |
| **Mercado Pago SDK** | Processamento de pagamentos |

---

## 3. Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────┐
│                      USUÁRIO                            │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTPS
┌─────────────────────▼───────────────────────────────────┐
│              PWA / Frontend (Vercel)                    │
│          Svelte + Dexie.js (IndexedDB)                  │
│                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Dashboard│ │  Treinos │ │ Hábitos/ │ │ Ranking/ │   │
│  │          │ │ Métricas │ │  Metas   │ │  Social  │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│         ▲                                               │
│  Sync Queue (IndexedDB)  ◄──────────────────────────┐  │
└──────────────┬───────────────────────────────────────┼──┘
               │ REST API (JWT)                        │
     ┌─────────┴────────────────────────────────────── ┘
     │
┌────▼─────────────────────┐    ┌────────────────────────┐
│   Backend Principal      │    │   Serviço Guildas      │
│   FastAPI (Railway)      │    │   FastAPI (Railway)    │
│   :8000                  │    │   :8001                │
│                          │    │                        │
│  ┌──────────────────┐    │    └────────────────────────┘
│  │  Auth Router     │    │
│  │  AI Router       │    │
│  │  Sync Router     │    │
│  │  Social Router   │    │
│  │  Payment Router  │    │
│  └──────────────────┘    │
└──────────────┬───────────┘
               │
┌──────────────▼───────────┐    ┌────────────────────────┐
│   PostgreSQL (Railway)   │    │   Google Gemini API    │
│   :5432                  │    │   (LLM)                │
└──────────────────────────┘    └────────────────────────┘
```

---

## 4. Backend — API Principal

O backend segue uma **arquitetura em camadas** inspirada em Clean Architecture / Hexagonal:

```
backend/app/
├── main.py                  # Entry point, registro de routers e CORS
├── config.py                # Settings (pydantic-settings)
├── auth_schemas.py          # Schemas de autenticação
├── schemas.py               # Schemas gerais de resposta
│
├── domain/                  # ★ Núcleo — sem dependências externas
│   ├── entities/            # Entidades de domínio (Pydantic models)
│   │   └── ai_entities.py
│   ├── repositories/        # Interfaces (contratos) dos repositórios
│   └── use_cases/           # Lógica de negócio pura
│       ├── generate_daily_quests.py
│       ├── generate_epic_quest.py
│       ├── generate_workout_plan.py
│       ├── generate_recipe.py
│       ├── suggest_meals.py
│       ├── generate_archetype.py
│       ├── generate_mission.py
│       └── calibrate_workout.py
│
├── adapters/                # Tradutores HTTP ↔ Domínio
│   └── http/
│       ├── ai_router.py
│       ├── auth_router.py
│       ├── sync_router.py
│       ├── social_router.py
│       ├── payment_router.py
│       └── schemas.py
│
└── infra/                   # Detalhes técnicos (banco, segurança, IA)
    ├── database.py          # Engine SQLAlchemy + sessão
    ├── security.py          # JWT, bcrypt
    ├── ai_client.py         # Instância do provider de IA
    ├── config.py            # Configurações de infra
    └── models/
        ├── user_model.py
        └── sync_models.py
```

### Princípio dos Routers

Cada router tem **responsabilidade única**: traduzir HTTP para chamadas de use case. Nenhuma lógica de negócio vive nos routers.

### Endpoints Disponíveis

#### Auth (`/auth`)
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/auth/register` | Registro com email/senha |
| POST | `/auth/login` | Login com email/senha → JWT |
| POST | `/auth/google` | Login OAuth2 via Google → JWT |

#### AI (`/ai`)
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/ai/quests/daily` | Gera 3 missões diárias personalizadas |
| POST | `/ai/quests/epic` | Gera missão épica (boss quest) |
| POST | `/ai/recipes/generate` | Gera receita com itens da dispensa |
| POST | `/ai/meals/suggest` | Sugere refeições baseado no treino do dia |
| POST | `/ai/workouts/generate-plan` | Gera ficha de treino completa |
| POST | `/ai/workouts/calibrate` | Calibra exercício com base no histórico |
| POST | `/ai/onboarding/archetype` | Gera arquétipo de jogador no onboarding |
| POST | `/ai/missions/generate` | Gera missão personalizada |

#### Sync (`/sync`)
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/sync/push` | Envia fila de eventos do cliente para o servidor |
| GET | `/sync/pull` | Busca mudanças do servidor desde `last_sync` |

#### Social (`/social`)
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/social/ranking` | Ranking global de jogadores |
| POST | `/social/friends/request` | Envia solicitação de amizade |
| GET | `/social/friends` | Lista amigos aceitos |
| PUT | `/social/friends/{id}` | Aceita/recusa solicitação |

#### Payments (`/payments`)
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/payments/subscribe` | Inicia checkout PRO (Mercado Pago) |
| POST | `/payments/webhook` | Webhook de confirmação de pagamento |

---

## 5. Serviço Guildas

Microserviço separado (`guildas/`) rodando na porta `8001`. Mantido isolado para escalar independentemente do backend principal. Atualmente em desenvolvimento inicial.

---

## 6. Frontend — PWA Local-First

```
frontend/src/
├── main.js              # Entry point — inicializa app, auth, sync worker
├── App.svelte           # Roteamento principal (hash-based)
│
├── routes/              # Páginas principais (views completas)
│   ├── Dashboard.svelte (38KB)
│   ├── TrainingMetrics.svelte (30KB)
│   ├── Quests.svelte (37KB)
│   ├── Profile.svelte (22KB)
│   ├── Ranking.svelte (24KB)
│   ├── WorkoutPlanDetail.svelte (25KB)
│   ├── Goals.svelte / Habits.svelte
│   ├── Onboarding.svelte (35KB)
│   ├── Stats.svelte / NutritionList.svelte
│   └── NewWorkoutPlan.svelte
│
├── components/          # Componentes reutilizáveis
│   ├── NavBar.svelte    # Barra de navegação inferior (mobile-first)
│   ├── Dashboard.svelte # Card principal do dashboard
│   ├── Modal.svelte     # Sistema de modais global
│   ├── ProModal.svelte  # Modal de upgrade PRO
│   ├── ShopList.svelte  # Loja de itens cosméticos
│   ├── TrainingList.svelte
│   ├── GoalCard / HabitCard
│   ├── Charts (BarChart, LineChart, RadarChart)
│   └── ...
│
├── db/                  # Camada de dados local
│   └── db.js            # Schema Dexie.js (IndexedDB)
│
├── repositories/        # Acesso ao banco local (Dexie)
│   └── playerRepository.js
│
├── services/            # Lógica de negócio e comunicação
│   ├── syncService.js   # ★ Sincronização Push/Pull
│   ├── workoutService.js
│   ├── questService.js
│   ├── habitService.js
│   ├── goalService.js
│   ├── socialService.js
│   └── mealAiService.js
│
├── lib/                 # Utilitários e lógica pura
│   ├── gamification.js  # XP, level up, curva de progressão
│   ├── levels.js        # Títulos e recompensas por nível
│   ├── achievements.js  # Sistema de conquistas
│   ├── pro.js           # Lógica Free vs PRO
│   ├── habits.js        # Lógica de streaks e hábitos
│   ├── metrics.js       # Cálculos de métricas de treino
│   ├── api.js           # Cliente HTTP para o backend
│   ├── modal.js         # Store global de modais
│   └── ...
│
└── styles/              # CSS global e design tokens
```

### Roteamento

O roteamento é feito via **hash-based** (`#/dashboard`, `#/treinos`, etc.) com roteamento manual no `App.svelte`. Não utiliza SvelteKit.

### Padrão de Componentes

Componentes Svelte usam reatividade declarativa (`$:`) e stores do Svelte para estado global (como `syncStore` e `modal`).

---

## 7. Banco de Dados

### Banco Local (IndexedDB via Dexie.js)

O banco local é o **sistema de verdade** do usuário. Cada tabela possui campos sincronizáveis.

| Tabela Dexie | Descrição |
|---|---|
| `player` | Perfil do jogador (XP, nível, coins, streak) |
| `habits` | Hábitos diários/semanais |
| `habitCompletions` | Registro de conclusões de hábitos |
| `goals` | Metas de curto/longo prazo |
| `dailyQuests` | Missões diárias geradas por IA |
| `exercises` | Biblioteca de exercícios |
| `workoutPlans` | Fichas de treino |
| `workoutPlanExercises` | Exercícios dentro de uma ficha |
| `workoutSessions` | Sessões de treino executadas |
| `sessionSets` | Séries individuais de cada sessão |
| `pantryItems` | Itens da dispensa/neveira |
| `bodyMeasurements` | Histórico de medidas corporais |
| `inventory` | Itens cosméticos adquiridos |
| `unlockedAchievements` | Conquistas desbloqueadas |
| `syncQueue` | Fila de eventos pendentes de sync |
| `recipes` | Receitas geradas por IA |

### Banco Remoto (PostgreSQL)

O banco remoto é um **espelho** do banco local, com camadas adicionais para social e autenticação.

**Modelos principais:**

- `users` — autenticação, gamificação, assinatura PRO
- `habits`, `habit_completions`, `goals`, `daily_quests`
- `exercises`, `workout_plans`, `workout_plan_exercises`
- `workout_sessions`, `session_sets`
- `pantry_items`, `body_measurements`, `inventory`
- `unlocked_achievements`
- `friendships` — relação social entre usuários

Todos os modelos sincronizáveis herdam de `SyncBase` com campos:
- `id` (String — UUID gerado pelo cliente)
- `user_id` (FK para `users`)
- `deleted` (soft delete)
- `created_at` / `updated_at`

---

## 8. Sistema de Sincronização

A sincronização é bidirecional e baseada em **fila de eventos**.

### Fluxo Push (Cliente → Servidor)

```
Ação do usuário
    ↓
enqueue(action, entity, entityId, payload)
    ↓
syncQueue (IndexedDB) ← armazena o evento localmente
    ↓
pushSync() — a cada 10 segundos (ou manual)
    ↓
POST /sync/push { events: [...] }
    ↓
Backend aplica eventos → PostgreSQL
    ↓
Remove eventos processados da fila local
```

### Fluxo Pull (Servidor → Cliente)

```
GET /sync/pull?last_sync=<ISO timestamp>
    ↓
Backend retorna todas as mudanças desde last_sync
    ↓
pullSync() aplica localmente (upsert ou delete)
    ↓
Atualiza last_sync_time no localStorage
```

### Proteção contra Loop

A flag `isSyncing = true` previne que dados recebidos do servidor sejam re-enfileirados na `syncQueue`.

### Worker de Background

```js
startSyncWorker(10) // Push + Pull a cada 10 segundos
```

---

## 9. Gamificação

### Curva de XP

```js
xpToNextLevel(level):
  level < 5  → level * 50         // Early wins: 50, 100, 150, 200 XP
  level < 15 → 200 + (level-4)*150 // Crescimento linear moderado
  level >= 15 → curva exponencial  // 1700 + (level-14)^1.8 * 100
```

### Sistema de Níveis (1–67)

| Intervalo | Título | Cor |
|---|---|---|
| 1–4 | Iniciante | Cinza |
| 5–9 | Desperto | Verde |
| 10–14 | Aprendiz | Esmeralda |
| 15–19 | Guerreiro | Azul |
| 20–24 | Gladiador | Índigo |
| 25–29 | Veterano | Roxo |
| 30–34 | Guardião | Violeta |
| 35–39 | Mestre | Fúcsia |
| 40–44 | Campeão | Rosa |
| 45–49 | Lenda | Carmim |
| 50–54 | Titã | Laranja |
| 55–59 | Semideus | Âmbar |
| 60–64 | Imortal | Amarelo |
| 65–66 | Transcendente | Amarelo claro |
| **67** | **AURA** | **Ciano — nível máximo** |

### Recompensas de Nível (Baús)

- **Todo nível (FREE):** Bronze Chest → moedas
- **Marco (múltiplo de 5, FREE):** Silver/Gold Chest → mais moedas
- **Todo nível (PRO):** Bronze Chest → moedas + proCoins
- **Marco (PRO):** Gold/Diamond Chest → grande quantidade de moedas + proCoins
- **Nível 67 (AURA):** +5000 moedas, +1000 proCoins (PRO)

### Conquistas

29 conquistas em 3 tiers de dificuldade:
- **Básicas:** primeiros hábitos, treinos matinais, metas iniciais
- **Intermediárias:** consistência de 14 dias, 10k kg semanais, mês perfeito
- **Épicas:** 6 meses contínuos, dobrar carga máxima, 1 ano de uso

### Streaks

Ofensiva diária de treinos, com verificação timezone-aware. Streak ativo mantém bônus visuais no dashboard.

### Missões

- **Missões Diárias:** 3 missões geradas por IA (uma por pilar: saúde, foco, treino, lar, social)
- **Missões Épicas (Boss Quests):** objetivos de longo prazo com XP elevado. PRO: até 3 simultâneas; FREE: 1.

---

## 10. Inteligência Artificial

O backend atua como **proxy stateless** para o LLM (Google Gemini). Nenhuma lógica de prompt vive no frontend.

### Use Cases de IA

| Use Case | Entrada | Saída |
|---|---|---|
| `generate_daily_quests` | Nível do player, áreas de foco, títulos recentes | 3 missões JSON |
| `generate_epic_quest` | Perfil do player | Boss quest JSON |
| `generate_recipe` | Itens da dispensa, objetivo, tipo de refeição | Receita JSON |
| `suggest_meals` | Dispensa, treino do dia, meta calórica | 3 sugestões de refeição |
| `generate_workout_plan` | Objetivo, perfil | Ficha de treino completa |
| `calibrate_workout` | Histórico de treino | Ajuste de cargas recomendado |
| `generate_archetype` | Respostas do onboarding | Arquétipo do jogador |
| `generate_mission` | Contexto do player | Missão personalizada |

### Padrão de Implementação

Todos os use cases seguem o mesmo contrato:
```python
async def generate_X(request: XRequest, ai_provider: AIProviderInterface) -> dict:
    data = await ai_provider.generate_json(SYSTEM_PROMPT, user_prompt)
    entity = XResponseEntity(**data)
    return entity.model_dump()
```

O `AIProviderInterface` é injetado, permitindo trocar o LLM sem alterar use cases.

---

## 11. Autenticação e Segurança

### Fluxo de Autenticação

1. **Email/Senha:** registro com bcrypt hash → login → JWT
2. **Google OAuth2:** validação do `id_token` Google no backend → JWT

### JWT

- Gerado com `PyJWT`
- Contém `sub: user_id (UUID)`
- Enviado como `Bearer` token em todas as rotas protegidas
- Armazenado no `localStorage` do cliente

### Proteções Implementadas

- CORS configurado por ambiente (variáveis de ambiente)
- Usernames únicos gerados automaticamente (com sufixo UUID para Google)
- Soft delete em todos os registros sincronizáveis (campo `deleted`)
- Constraints no banco: `uq_friendship_pair`, `ck_no_self_friendship`

---

## 12. Monetização e Planos

### Planos

| Feature | FREE | PRO |
|---|---|---|
| Hábitos simultâneos | 5 | Ilimitado |
| Missões épicas ativas | 1 | 3 |
| Sugestões de refeição por IA/dia | 1 | Ilimitado |
| Baús de recompensa | Bronze/Silver/Gold | Bronze/Gold/Diamond |
| ProCoins | ✗ | ✓ |

### Integração Mercado Pago

- Checkout offloaded: o backend cria a preferência e retorna `checkout_url`
- O usuário é redirecionado para o Mercado Pago para pagamento
- Webhook `/payments/webhook` confirma o pagamento e atualiza `is_pro=true` no banco

---

## 13. Infraestrutura e Deploy

### Ambientes

| Serviço | Local (dev) | Produção |
|---|---|---|
| Frontend | `npm run dev` (Vite) | Vercel |
| Backend | Docker Compose `:8000` | Railway |
| Guildas | Docker Compose `:8001` | Railway |
| Banco | Docker Compose (PostgreSQL) | Railway PostgreSQL |

### Docker Compose (Dev)

```yaml
services:
  db:      # PostgreSQL 15-alpine
  backend: # FastAPI em :8000 com hot-reload
  guildas: # FastAPI em :8001 com hot-reload
# Frontend roda fora do Docker (npm run dev) para hot-reload mais rápido
```

### Deploy Frontend (Vercel)

O `vercel.json` redireciona todas as rotas para `index.html` (SPA). Assets estáticos são cacheados pelo CDN da Vercel.

---

## 14. Variáveis de Ambiente

### Backend (`.env`)

```env
DATABASE_URL=postgresql+asyncpg://...
SECRET_KEY=<jwt-secret>
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_GEMINI_API_KEY=<gemini-api-key>
MERCADO_PAGO_ACCESS_TOKEN=<mp-token>
CORS_ORIGINS=["https://app.lifequest.com.br"]
ENVIRONMENT=production
```

### Frontend (`.env.local`)

```env
VITE_API_URL=https://api.lifequest.com.br
```

---

## Diagrama de Fluxo — Sessão de Treino

```
Usuário inicia treino
    ↓
workoutService.startSession() → cria WorkoutSession no IndexedDB
    ↓
Usuário executa séries → SessionSets salvos localmente em tempo real
    ↓
workoutService.finishSession()
    → Calcula XP ganho
    → applyXp() → detecta level up se necessário
    → updatePlayer() → salva novo estado no IndexedDB
    → checkAchievements() → verifica e desbloqueia conquistas
    → enqueue() → adiciona todos os eventos na syncQueue
    ↓
syncWorker (background, 10s)
    → pushSync() → POST /sync/push → PostgreSQL atualizado
```

---

*Documentação gerada em Agosto/2026. Para dúvidas, contribuições ou reporte de bugs, abra uma issue no repositório.*
