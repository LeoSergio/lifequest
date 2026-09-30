# LifeQuest — Documentação Técnica do Frontend

> **Versão:** 0.1.0 | **Tecnologia principal:** Svelte 4 + Vite 5 | **Paradigma:** Local-First PWA

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Stack Tecnológica](#2-stack-tecnológica)
3. [Estrutura de Diretórios](#3-estrutura-de-diretórios)
4. [Arquitetura Local-First](#4-arquitetura-local-first)
5. [Banco de Dados Local — Dexie.js / IndexedDB](#5-banco-de-dados-local--dexiejs--indexeddb)
6. [Sistema de Sincronização (Sync Engine)](#6-sistema-de-sincronização-sync-engine)
7. [Rotas (Páginas)](#7-rotas-páginas)
8. [Componentes](#8-componentes)
9. [Serviços](#9-serviços)
10. [Biblioteca de Utilitários (`lib/`)](#10-biblioteca-de-utilitários-lib)
11. [Sistema de Gamificação](#11-sistema-de-gamificação)
12. [Integração com a API](#12-integração-com-a-api)
13. [Configuração de Build](#13-configuração-de-build)
14. [Variáveis de Ambiente](#14-variáveis-de-ambiente)
15. [Testes](#15-testes)

---

## 1. Visão Geral

O frontend do LifeQuest é uma **Progressive Web App (PWA) local-first** construída com Svelte 4. O princípio central da arquitetura é que **todos os dados do usuário são armazenados localmente no navegador** via IndexedDB (abstrato pelo Dexie.js), e apenas sincronizados com o backend quando há conexão disponível.

Isso garante que o app funcione **offline por padrão** — o usuário pode registrar treinos, hábitos, metas e refeições sem nenhuma conexão à internet. A sincronização ocorre em background de forma transparente.

O backend é tratado como um serviço de **leitura de nuvem e IA**, nunca como fonte primária de dados.

---

## 2. Stack Tecnológica

| Categoria | Tecnologia | Versão | Propósito |
|---|---|---|---|
| Framework UI | **Svelte** | `^4.2.18` | Componentes reativos compilados |
| Build Tool | **Vite** | `^5.4.0` | Dev server e bundler |
| CSS Framework | **Tailwind CSS** | `^3.4.0` | Utilitários de estilo |
| Banco Local | **Dexie.js** | `^4.0.8` | Abstração do IndexedDB |
| PWA | **vite-plugin-pwa** | `^0.20.0` | Service Worker + Manifest |
| Gráficos | **Chart.js** | `^4.4.4` | Visualizações (Radar, Bar, Line) |
| OCR Local | **Tesseract.js** | `^5.1.0` | Reconhecimento de fichas de treino |
| PDF | **jsPDF + AutoTable** | `^4.2.1` | Exportação de relatórios |
| Analytics | **@vercel/analytics** | `^2.0.1` | Métricas de uso em produção |
| Testes | **Vitest** | `^2.0.0` | Unit tests |
| Testes de componente | **@testing-library/svelte** | `^5.0.0` | Testes de componente |

---

## 3. Estrutura de Diretórios

```
frontend/
├── index.html                  # Ponto de entrada HTML
├── vite.config.js              # Configuração Vite + PWA
├── tailwind.config.js          # Tema customizado Tailwind
├── postcss.config.js           # PostCSS
├── package.json
├── vercel.json                 # Configuração de deploy (SPA routing)
├── public/                     # Assets estáticos
└── src/
    ├── main.js                 # Bootstrap da aplicação
    ├── App.svelte              # Componente raiz (roteamento principal)
    ├── db/
    │   └── db.js               # Definição do banco IndexedDB (Dexie)
    ├── lib/                    # Utilitários e stores Svelte
    │   ├── api.js              # Cliente HTTP para o backend
    │   ├── gamification.js     # Lógica de XP e level up
    │   ├── levels.js           # Tabela de níveis e recompensas
    │   ├── achievements.js     # Definição de conquistas
    │   ├── habits.js           # Helpers de hábitos (streak, progresso)
    │   ├── goals.js            # Helpers de metas
    │   ├── metrics.js          # Cálculos de métricas de treino e corpo
    │   ├── constants.js        # Constantes globais (XP, moedas, etc.)
    │   ├── modal.js            # Store Svelte para controle de modais
    │   ├── nav.js              # Store de navegação
    │   ├── pro.js              # Lógica PRO (pagamento, features)
    │   ├── syncStore.js        # Store reativo do estado de sync
    │   ├── id.js               # Gerador de UUIDs (crypto.randomUUID)
    │   └── receiptParser.js    # Parser de notas fiscais
    ├── components/             # Componentes reutilizáveis
    ├── routes/                 # Telas (páginas) da aplicação
    ├── services/               # Serviços de acesso a dados (CRUD local)
    └── styles/                 # CSS global e temas
```

---

## 4. Arquitetura Local-First

```
┌─────────────────────────────────────────┐
│              FRONTEND (Navegador)        │
│                                         │
│  ┌──────────────┐   ┌────────────────┐  │
│  │   Svelte UI  │◄──│  Svelte Stores  │  │
│  └──────┬───────┘   └───────┬────────┘  │
│         │                   │           │
│         ▼                   ▼           │
│  ┌──────────────────────────────────┐  │
│  │        Services (CRUD Local)      │  │
│  └──────────────┬───────────────────┘  │
│                 │                       │
│                 ▼                       │
│  ┌──────────────────────────────────┐  │
│  │     Dexie.js / IndexedDB          │  │
│  │   (Fonte de verdade primária)     │  │
│  └──────────────┬───────────────────┘  │
│                 │                       │
│         ┌───────▼──────┐               │
│         │  syncQueue    │               │
│         │  (fila local) │               │
│         └───────┬───────┘               │
└─────────────────┼───────────────────────┘
                  │  (quando online)
                  ▼
         ┌─────────────────┐
         │    Backend API   │
         │  POST /sync/push │
         │  GET  /sync/pull │
         └─────────────────┘
```

### Fluxo de Dados

1. **Escrita**: O usuário interage com a UI → Service grava no IndexedDB → Evento entra na `syncQueue`
2. **Leitura**: Componentes leem sempre do IndexedDB (sem depender do backend)
3. **Sync Push**: A cada 10 segundos, o `syncWorker` envia a fila pendente ao backend
4. **Sync Pull**: Após cada push, o frontend busca mudanças do servidor (ex: dados de outro dispositivo)

---

## 5. Banco de Dados Local — Dexie.js / IndexedDB

**Arquivo:** [`src/db/db.js`](file:///home/leandro/dev/pessoais/lifequest/frontend/src/db/db.js)

O banco local usa **versionamento progressivo** (migrations), onde cada `db.version(N)` adiciona tabelas ou colunas sem destruir dados existentes. O banco possui atualmente **10 versões**.

### Tabelas e Esquemas

#### Versão 1 — Núcleo inicial
| Tabela | Índices | Descrição |
|---|---|---|
| `player` | `++id, archetype, level, xp, streak, createdAt` | Dados do jogador (único registro) |
| `missions` | `++id, pillar, status, dueDate, difficulty` | Missões geradas pela IA |
| `pantryItems` | `++id, name, category, quantity, updatedAt` | Itens da despensa |
| `shoppingList` | `++id, itemName, checked, recipeId, createdAt` | Lista de compras |
| `budget` | `++id, month, limit, spent` | Controle de orçamento |
| `workoutPlans` | `++id, name, weekday, estimatedDuration` | Fichas de treino |
| `workoutPlanExercises` | `++id, workoutPlanId, exerciseId, order, ...` | Exercícios por ficha |
| `exercises` | `++id, name, muscleGroup, equipment` | Catálogo de exercícios |
| `workoutSessions` | `++id, workoutPlanId, startedAt, finishedAt` | Sessões de treino |
| `sessionSets` | `++id, workoutSessionId, ...` | Séries executadas |
| `recipes` | `++id, title, goalContext, createdAt` | Receitas salvas |
| `guildMembership` | `++id, guildId, joinedAt` | Associação a guildas |

#### Versões subsequentes (adições)
| Versão | Tabela Adicionada | Motivo |
|---|---|---|
| v2 | `bodyMeasurements` | Perimetria corporal |
| v3 | `habits`, `habitCompletions` | Sistema de hábitos |
| v4 | `goals` | Metas com progresso numérico |
| v5 | — (upgrade de `sessionSets`) | Vincula sets ao exercício pelo ID estável |
| v6 | `dailyQuests` | Missões diárias geradas por IA |
| v7 | `inventory` | Itens da Loja (temas, avatares) |
| v8 | `unlockedAchievements` | Conquistas desbloqueadas |
| v9 | `syncQueue` | Fila de sincronização Local-First |
| v10 | — (upgrade de `goals`) | Índice `isEpic` para Metas Épicas |

### Convenção de IDs

Antes da v9 (sync), os registros usavam `++id` (auto-incremento numérico do Dexie). Para sincronização segura entre dispositivos, o frontend passou a gerar **UUIDs via `crypto.randomUUID()`** para todos os registros novos sincronizáveis, evitando colisões.

---

## 6. Sistema de Sincronização (Sync Engine)

**Arquivo:** [`src/services/syncService.js`](file:///home/leandro/dev/pessoais/lifequest/frontend/src/services/syncService.js)

### Tabelas Sincronizáveis

```js
const SYNCABLE_TABLES = [
  'player', 'habits', 'habitCompletions', 'goals', 'dailyQuests',
  'exercises', 'workoutPlans', 'workoutPlanExercises',
  'workoutSessions', 'sessionSets', 'pantryItems',
  'bodyMeasurements', 'inventory', 'unlockedAchievements'
]
```

> **Não sincronizadas:** `shoppingList`, `budget`, `recipes`, `guildMembership` — permanecem apenas locais.

### API Pública do syncService

| Função | Descrição |
|---|---|
| `enqueue(action, entity, entityId, payload)` | Adiciona evento na `syncQueue` local |
| `pushSync()` | Envia eventos pendentes ao backend (`POST /sync/push`) |
| `pullSync()` | Busca alterações do servidor e aplica no IndexedDB (`GET /sync/pull`) |
| `startSyncWorker(intervalSeconds?)` | Inicia loop de sync automático (padrão: 10s) |

### Conversão de Case

O frontend usa `camelCase` (Dexie/JS) e o backend usa `snake_case` (Python/SQLAlchemy). O `syncService` converte automaticamente:

- **Push:** dados do Dexie → enviados como `camelCase` no payload JSON
- **Pull:** resposta do backend em `snake_case` → convertida para `camelCase` via `snakeToCamel()`

### Soft Delete

Ao "deletar" um registro, o frontend enfileira `action: "delete"`. O backend aplica um **soft delete** (`deleted = true`). No próximo pull, registros com `deleted: true` são removidos do IndexedDB local.

### Estado de Sync (Store Reativo)

```js
// src/lib/syncStore.js
import { writable } from 'svelte/store';
export const syncState = writable({ status: 'idle', lastSyncTime: null });
// status: 'idle' | 'syncing' | 'error' | 'offline'
```

O componente [`SyncBadge.svelte`](file:///home/leandro/dev/pessoais/lifequest/frontend/src/components/SyncBadge.svelte) exibe o estado visualmente na interface.

---

## 7. Rotas (Páginas)

**Diretório:** `src/routes/`  
O roteamento é manual, controlado por uma variável de estado no `App.svelte`.

| Arquivo | Rota lógica | Descrição |
|---|---|---|
| `Onboarding.svelte` | `/onboarding` | Fluxo de boas-vindas com IA (gera arquétipo do jogador) |
| `Goals.svelte` | `/goals` | Criação e acompanhamento de metas |
| `Habits.svelte` | `/habits` | Gerenciamento de hábitos diários/semanais |
| `HabitsAndGoals.svelte` | `/habits-goals` | View combinada de hábitos e metas |
| `Quests.svelte` | `/quests` | Missões diárias geradas por IA |
| `Training.svelte` | `/training` | Entrada de treinos (stub/wrapper) |
| `TrainingMetrics.svelte` | `/training-metrics` | Métricas avançadas de treino |
| `WorkoutPlanDetail.svelte` | `/workout/:id` | Detalhes de uma ficha de treino |
| `NewWorkoutPlan.svelte` | `/workout/new` | Criação de nova ficha (manual ou IA) |
| `Profile.svelte` | `/profile` | Perfil do jogador, avatar, configurações |
| `Ranking.svelte` | `/ranking` | Ranking global e de amigos |
| `Stats.svelte` | `/stats` | Estatísticas e gráficos |
| `Pantry.svelte` | `/pantry` | Gestão da despensa |
| `Shop.svelte` | `/shop` | Loja de itens (temas, avatares) |

---

## 8. Componentes

**Diretório:** `src/components/`  
Componentes reutilizáveis compartilhados entre rotas.

| Componente | Descrição |
|---|---|
| `Dashboard.svelte` | Tela principal — exibe player stats, missões ativas e resumo |
| `NavBar.svelte` | Barra de navegação inferior (mobile-first) |
| `Modal.svelte` | Modal genérico configurável |
| `ProModal.svelte` | Modal de assinatura PRO com integração Mercado Pago |
| `HabitCard.svelte` | Card de hábito individual com streak e progresso |
| `GoalCard.svelte` | Card de meta com barra de progresso |
| `NutritionList.svelte` | Lista de sugestões de refeição da IA |
| `TrainingList.svelte` | Lista de exercícios de um treino ativo |
| `ShopList.svelte` | Lista de itens disponíveis na loja |
| `StatsBar.svelte` | Barra de atributos do jogador (Força, Foco, Saúde...) |
| `RadarChart.svelte` | Gráfico radar de atributos (via Chart.js) |
| `BarChart.svelte` | Gráfico de barras (via Chart.js) |
| `LineChart.svelte` | Gráfico de linha (via Chart.js) |
| `ConsistencyCalendar.svelte` | Calendário de consistência de hábitos |
| `StreakCalendar.svelte` | Calendário de ofensiva (streak) |
| `PeriodSummary.svelte` | Resumo de período (semanal/mensal) |
| `SyncBadge.svelte` | Indicador visual do estado de sincronização |
| `RestDayModal.svelte` | Modal de dia de descanso |
| `BackgroundBlobs.svelte` | Elemento decorativo de background animado |

---

## 9. Serviços

**Diretório:** `src/services/`  
Serviços encapsulam toda a lógica de acesso ao banco local (Dexie) e ao backend. Componentes **não devem chamar o Dexie diretamente**.

| Arquivo | Responsabilidade |
|---|---|
| `habitService.js` | CRUD de hábitos e registros de conclusão (`habitCompletions`) |
| `goalService.js` | CRUD de metas, atualização de progresso e check de conquista |
| `questService.js` | Geração de missões diárias via IA, conclusão e reset |
| `workoutService.js` | Fichas, exercícios, sessões de treino e séries |
| `mealAiService.js` | Chamadas à IA para sugestão de refeições e receitas |
| `socialService.js` | Amizades, ranking global e de amigos via backend |
| `syncService.js` | Engine de sincronização bidirecional (descrito na seção 6) |

### Padrão de Escrita (com Enqueue)

Todo serviço que escreve dados segue este padrão:

```js
// 1. Grava localmente no Dexie
const id = await db.habits.add(newHabit);

// 2. Enfileira para sync com o backend
await enqueue('upsert', 'habits', id, { ...newHabit, id });
```

---

## 10. Biblioteca de Utilitários (`lib/`)

| Arquivo | Função Principal |
|---|---|
| `api.js` | Cliente HTTP com todas as rotas do backend |
| `gamification.js` | `xpToNextLevel(level)`, `applyXp()`, `xpProgressPercent()` |
| `levels.js` | Tabela completa de níveis, títulos e recompensas |
| `achievements.js` | Definição de todas as conquistas e gatilhos de desbloqueio |
| `habits.js` | `getStreakForHabit()`, `getWeeklyProgress()`, `isHabitDoneToday()` |
| `goals.js` | `isGoalAchieved()`, formatação de progresso |
| `metrics.js` | Cálculos de volume de treino, PR, carga média e medidas corporais |
| `constants.js` | `XP_REWARDS`, `COIN_REWARDS`, pilares, etc. |
| `modal.js` | Store Svelte para abrir/fechar modais de qualquer lugar |
| `pro.js` | Verificação de acesso PRO, controle de features, fluxo de pagamento |
| `id.js` | `generateId()` — wrapper sobre `crypto.randomUUID()` |
| `syncStore.js` | Store reativo do estado de sincronização |
| `receiptParser.js` | Parsing de texto de nota fiscal para itens de despensa |

---

## 11. Sistema de Gamificação

**Arquivo:** [`src/lib/gamification.js`](file:///home/leandro/dev/pessoais/lifequest/frontend/src/lib/gamification.js)

### Curva de XP

A curva de progressão foi projetada para recompensar novatos rapidamente e aumentar a dificuldade gradualmente:

| Nível | XP necessário para avançar |
|---|---|
| 1 | 50 XP |
| 2 | 100 XP |
| 3 | 150 XP |
| 4 | 200 XP |
| 5–14 | `200 + (level - 4) × 150` |
| 15+ | `1700 + floor((level - 14)^1.8 × 100)` |

```js
export function xpToNextLevel(level) {
  if (level < 5)  return level * 50;
  if (level < 15) return 200 + (level - 4) * 150;
  return 1700 + Math.floor(Math.pow(level - 14, 1.8) * 100);
}
```

### Level Up

O `applyXp()` suporta **múltiplos level ups consecutivos** em uma única chamada, caso o XP ganho seja muito alto.

### Atributos do Jogador

O jogador possui 5 atributos (pilares) que crescem com atividades específicas:
- 💪 **Força** — treinos completados
- 🎯 **Foco** — hábitos de disciplina
- 🏠 **Lar** — gestão doméstica e despensa
- ❤️ **Saúde** — nutrição e medidas corporais
- 🤝 **Social** — interações sociais e amizades

---

## 12. Integração com a API

**Arquivo:** [`src/lib/api.js`](file:///home/leandro/dev/pessoais/lifequest/frontend/src/lib/api.js)

A URL base é configurada via variável de ambiente:

```js
export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
```

### Métodos Disponíveis no cliente `api`

#### Autenticação
```js
api.register({ name, email, password })
api.login({ email, password })
api.loginGoogle(googleCredential)
```

#### IA (endpoints stateless — não requerem auth)
```js
api.generateArchetype(answers)
api.generateMission({ pillar, player_level, recent_failures })
api.generateRecipe({ pantry_items, goal, meal_type })
api.generateWorkoutFeedback({ exercise_name, last_feedback, ... })
api.suggestMeals({ pantry_items, meal_type, calorie_target, ... })
api.generateWorkoutPlan({ goal, equipment, level, days_per_week, ... })
api.scanWorkoutSheet(imageBase64OrArray, mimeType)
```

#### Sincronização (auth obrigatória)
```js
// Feito diretamente pelo syncService.js com fetch + Bearer token
fetch('/sync/push', { headers: { Authorization: `Bearer ${token}` } })
fetch('/sync/pull?last_sync=...', ...)
```

---

## 13. Configuração de Build

**Arquivo:** `vite.config.js`

- **Framework:** `@sveltejs/vite-plugin-svelte`
- **PWA:** `vite-plugin-pwa` com Service Worker para cache offline
- **Aliases de caminho:** `@` → `src/`

**Arquivo:** `vercel.json`

Configurado com `"rewrites"` para garantir que todas as rotas redirecionem para `index.html` (SPA routing).

---

## 14. Variáveis de Ambiente

**Arquivo:** `.env.local`

| Variável | Padrão | Descrição |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000` | URL base do backend |

> Todas as variáveis de ambiente no frontend devem ser prefixadas com `VITE_` para serem expostas ao código cliente pelo Vite.

---

## 15. Testes

**Executor:** Vitest + @testing-library/svelte

```bash
npm test          # Executa testes uma vez
npm run test:watch # Modo watch
```

Testes existentes em `src/services/habitService.test.js` cobrem a lógica do serviço de hábitos com um banco IndexedDB mockado via jsdom.

---

*Documentação gerada em 30/09/2026 com base no estado atual do código-fonte.*
