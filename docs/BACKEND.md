# LifeQuest — Documentação Técnica do Backend

> **Versão:** 0.1.0 | **Tecnologia principal:** Python 3.11+ / FastAPI | **Arquitetura:** Clean Architecture / Hexagonal

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Stack Tecnológica](#2-stack-tecnológica)
3. [Estrutura de Diretórios](#3-estrutura-de-diretórios)
4. [Arquitetura em Camadas](#4-arquitetura-em-camadas)
5. [Ponto de Entrada — `main.py`](#5-ponto-de-entrada--mainpy)
6. [Camada de Adaptadores HTTP (`adapters/http/`)](#6-camada-de-adaptadores-http-adaptorshttp)
   - 6.1 [auth_router — Autenticação](#61-auth_router--autenticação)
   - 6.2 [sync_router — Sincronização Local-First](#62-sync_router--sincronização-local-first)
   - 6.3 [ai_router — Inteligência Artificial](#63-ai_router--inteligência-artificial)
   - 6.4 [social_router — Social e Ranking](#64-social_router--social-e-ranking)
   - 6.5 [payment_router — Pagamentos](#65-payment_router--pagamentos)
7. [Camada de Domínio (`domain/`)](#7-camada-de-domínio-domain)
   - 7.1 [Entidades](#71-entidades)
   - 7.2 [Casos de Uso (Use Cases)](#72-casos-de-uso-use-cases)
8. [Camada de Infraestrutura (`infra/`)](#8-camada-de-infraestrutura-infra)
   - 8.1 [Configuração](#81-configuração)
   - 8.2 [Banco de Dados](#82-banco-de-dados)
   - 8.3 [Segurança (JWT)](#83-segurança-jwt)
   - 8.4 [Provedor de IA](#84-provedor-de-ia)
9. [Autenticação e Autorização](#9-autenticação-e-autorização)
10. [CORS](#10-cors)
11. [Variáveis de Ambiente](#11-variáveis-de-ambiente)
12. [Deploy e Execução](#12-deploy-e-execução)
13. [Testes](#13-testes)

---

## 1. Visão Geral

O backend do LifeQuest é uma **API REST stateless** construída com FastAPI. Ele atua como a **ponte entre o app local-first (frontend PWA) e provedores externos** (LLMs de IA, banco de dados PostgreSQL, gateway de pagamento).

### Responsabilidades do Backend

| Responsabilidade | Módulo |
|---|---|
| Autenticação (JWT + Google OAuth) | `auth_router` |
| Sincronização bidirecional de dados | `sync_router` |
| Geração de conteúdo com IA | `ai_router` + `domain/use_cases/` |
| Ranking e sistema social | `social_router` |
| Cobrança e assinaturas PRO | `payment_router` |

### O que o Backend **não** faz

- **Não** é a fonte primária de dados do usuário (isso é o IndexedDB no cliente)
- **Não** faz renderização de HTML
- **Não** armazena estado de sessão (stateless por design)

---

## 2. Stack Tecnológica

| Componente | Tecnologia | Versão |
|---|---|---|
| Framework Web | **FastAPI** | `0.115.0` |
| Servidor ASGI | **Uvicorn** | `0.30.6` |
| Validação | **Pydantic v2** | `2.9.2` |
| ORM Assíncrono | **SQLAlchemy 2.0** | `2.0.35` |
| Driver PostgreSQL | **asyncpg** | `0.29.0` |
| Migrações | **Alembic** | `1.13.3` |
| Hash de senha | **passlib[bcrypt]** | `1.7.4` / `4.2.0` |
| JWT | **PyJWT** | `2.8.0` |
| Auth Google | **google-auth** | `2.34.0` |
| HTTP Client | **httpx** | `0.27.2` |
| Pagamento | **mercadopago** | `>=3.2.0` |
| Configuração | **pydantic-settings** | `2.5.2` |
| Testes | **pytest + pytest-asyncio** | `8.3.3 / 0.24.0` |

---

## 3. Estrutura de Diretórios

```
backend/
├── Dockerfile                   # Imagem de produção
├── requirements.txt             # Dependências Python
├── alembic.ini                  # Configuração do Alembic
├── start.sh                     # Script de boot (migrate + serve)
├── alembic/
│   ├── env.py                   # Ambiente de migração
│   └── versions/                # Histórico de migrations (14 arquivos)
└── app/
    ├── main.py                  # Bootstrap: FastAPI + CORS + routers
    ├── config.py                # Settings globais (compat. com infra/)
    ├── schemas.py               # Schemas Pydantic legados
    ├── auth_schemas.py          # Schemas de autenticação
    ├── ai_client.py             # AI client legado (substituído por infra/)
    ├── adapters/
    │   └── http/
    │       ├── ai_router.py     # Endpoints de IA
    │       ├── auth_router.py   # Endpoints de autenticação
    │       ├── sync_router.py   # Endpoints de sincronização
    │       ├── social_router.py # Endpoints sociais e ranking
    │       ├── payment_router.py# Endpoints de pagamento
    │       └── schemas.py       # Schemas Pydantic dos endpoints
    ├── domain/
    │   ├── entities/
    │   │   └── ai_entities.py   # Entidades puras de domínio (IA)
    │   ├── repositories/
    │   │   └── (interfaces)     # Contratos de repositório
    │   └── use_cases/
    │       ├── generate_archetype.py
    │       ├── generate_mission.py
    │       ├── generate_daily_quests.py
    │       ├── generate_epic_quest.py
    │       ├── generate_recipe.py
    │       ├── generate_workout_plan.py
    │       ├── calibrate_workout.py
    │       ├── suggest_meals.py
    │       └── scan_workout_sheet.py
    └── infra/
        ├── config.py            # Settings com pydantic-settings
        ├── database.py          # Engine e sessão async SQLAlchemy
        ├── security.py          # Hash de senha e criação de JWT
        ├── ai_client.py         # Provedor GroqGemini (concreto)
        └── models/
            ├── user_model.py    # Modelo SQLAlchemy: tabela `users`
            └── sync_models.py   # Modelos SQLAlchemy: tabelas de sync
```

---

## 4. Arquitetura em Camadas

O backend segue a estrutura de **Clean Architecture** (inspirada em Hexagonal/Ports & Adapters):

```
┌──────────────────────────────────────────────────────┐
│                   ADAPTADORES HTTP                    │
│   (auth_router, sync_router, ai_router, ...)          │
│   Única responsabilidade: HTTP ↔ Use Cases            │
└────────────────────────┬─────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────┐
│                  CASOS DE USO (DOMÍNIO)               │
│   (generate_recipe, calibrate_workout, ...)           │
│   Lógica de negócio pura — sem HTTP, sem banco        │
└────────────────────────┬─────────────────────────────┘
                         │
               ┌─────────┴──────────┐
               ▼                    ▼
┌─────────────────────┐  ┌─────────────────────────────┐
│      ENTIDADES      │  │       INFRAESTRUTURA         │
│   (ai_entities.py)  │  │ (database, models, security, │
│   Objetos de negócio│  │  ai_client — detalhes ext.)  │
└─────────────────────┘  └─────────────────────────────┘
```

> **Regra fundamental:** Os use cases não importam nada de `adapters/` nem de `infra/`. Eles dependem apenas de **interfaces** (ports), injetadas pelos routers no momento da chamada.

---

## 5. Ponto de Entrada — `main.py`

**Arquivo:** [`app/main.py`](file:///home/leandro/dev/pessoais/lifequest/backend/app/main.py)

```python
app = FastAPI(
    title="LifeQuest Backend",
    description="Ponte stateless entre o app local-first e os provedores de IA.",
    version="0.1.0",
)
```

Registra os 5 routers e a configuração de CORS via `CORSMiddleware`.

### Endpoint de Saúde

```
GET /health
→ { "status": "ok", "environment": "production" }
```

---

## 6. Camada de Adaptadores HTTP (`adapters/http/`)

### 6.1 `auth_router` — Autenticação

**Prefixo:** `/auth` | **Tags:** `Auth`  
**Arquivo:** [`auth_router.py`](file:///home/leandro/dev/pessoais/lifequest/backend/app/adapters/http/auth_router.py)

#### Endpoints

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/auth/register` | Cria novo usuário com e-mail e senha |
| `POST` | `/auth/login` | Autentica por e-mail/senha, retorna JWT |
| `POST` | `/auth/google` | Autentica via Google OAuth (token ID) |

#### Fluxo de Registro

1. Verifica unicidade do e-mail
2. Faz hash da senha com bcrypt (via `passlib`)
3. Gera `username` único a partir do nome (`base_username` + contador)
4. Salva `UserModel` no PostgreSQL
5. Retorna o usuário criado (sem senha)

#### Fluxo de Login Google

1. Valida o `id_token` com `google.oauth2.id_token.verify_oauth2_token()`
2. Verifica se o e-mail já existe no banco
3. Se não existir, cria o usuário automaticamente (sin up implícito)
4. Atualiza o avatar apenas se for URL do Google (preserva uploads customizados em base64)
5. Retorna JWT + dados de gamificação

#### Response do Login (ambos os endpoints)

```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "name": "username",
  "level": 5,
  "xp": 1200,
  "streak_days": 7,
  "coins": 150
}
```

---

### 6.2 `sync_router` — Sincronização Local-First

**Prefixo:** `/sync` | **Tags:** `Sync`  
**Arquivo:** [`sync_router.py`](file:///home/leandro/dev/pessoais/lifequest/backend/app/adapters/http/sync_router.py)

Este é o router **mais crítico** do sistema. Implementa o protocolo de sincronização bidirecional do paradigma Local-First.

#### Endpoints

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `POST` | `/sync/push` | ✅ Bearer | Recebe eventos offline do frontend |
| `GET` | `/sync/pull` | ✅ Bearer | Retorna mudanças desde `last_sync` |

#### Mapeamento de Entidades (Frontend → Banco)

```python
TABLE_TO_MODEL = {
    "habits": HabitModel,
    "habitCompletions": HabitCompletionModel,
    "goals": GoalModel,
    "dailyQuests": DailyQuestModel,
    "exercises": ExerciseModel,
    "workoutPlans": WorkoutPlanModel,
    "workoutPlanExercises": WorkoutPlanExerciseModel,
    "workoutSessions": WorkoutSessionModel,
    "sessionSets": SessionSetModel,
    "pantryItems": PantryItemModel,
    "bodyMeasurements": BodyMeasurementModel,
    "inventory": InventoryModel,
    "unlockedAchievements": UnlockedAchievementModel,
}
```

#### `POST /sync/push` — Recebimento de Eventos

Recebe uma lista de `SyncEvent`:

```json
{
  "events": [
    {
      "id": 42,
      "entity": "habits",
      "entityId": "uuid-abc-123",
      "action": "upsert",
      "timestamp": "2026-09-30T12:00:00Z",
      "payload": { "title": "Beber água", "cadence": "daily", ... }
    }
  ]
}
```

**Comportamento chave (resiliência):**
- Cada evento é processado dentro de um **SAVEPOINT** (nested transaction)
- Se um evento falhar, apenas ele é descartado (`failed_events`)
- Os demais eventos do lote continuam sendo processados
- O frontend apaga da fila local apenas os eventos que **não** estão em `failed_events`

**Conversão automática de case:** `camelCase` (JS) → `snake_case` (Python)

**Ação `upsert`:**
1. Busca o registro por `(id, user_id)` no banco
2. Se existir: atualiza os campos
3. Se não existir: cria novo registro
4. Sempre sobrescreve `updated_at` com o timestamp atual do servidor

**Ação `delete`:** Aplica soft delete (`deleted = true`) — o dado nunca é apagado fisicamente.

**Entidade especial `player`:** O payload do player é mapeado para os campos da `UserModel`. O campo `streak_days` só é atualizado se o payload **explicitamente** contiver `"streak"` (evitar reset acidental).

#### `GET /sync/pull` — Envio de Mudanças

```
GET /sync/pull?last_sync=2026-09-30T10:00:00Z
```

Retorna todos os registros com `updated_at > last_sync` para o usuário autenticado.

```json
{
  "timestamp": "2026-09-30T17:00:00.123456Z",
  "changes": {
    "habits": [
      { "id": "uuid-abc", "title": "Beber água", "deleted": false, ... }
    ],
    "player": [
      { "id": 1, "name": "usuario", "level": 5, "xp": 1200, ... }
    ]
  }
}
```

---

### 6.3 `ai_router` — Inteligência Artificial

**Prefixo:** `/ai` | **Tags:** `ai`  
**Arquivo:** [`ai_router.py`](file:///home/leandro/dev/pessoais/lifequest/backend/app/adapters/http/ai_router.py)

> **Design:** Este router **não contém nenhuma lógica de negócio**. Sua única responsabilidade é traduzir o payload HTTP para entidades de domínio e chamar o use case correto.

#### Endpoints de IA

| Método | Rota | Use Case Chamado | Descrição |
|---|---|---|---|
| `POST` | `/ai/onboarding/archetype` | `generate_archetype` | Gera arquétipo RPG do jogador |
| `POST` | `/ai/missions/generate` | `generate_mission` | Gera missão por pilar e nível |
| `POST` | `/ai/quests/daily` | `generate_daily_quests` | Gera 3 missões diárias personalizadas |
| `POST` | `/ai/quests/epic` | `generate_epic_quest` | Gera meta épica (chefe) |
| `POST` | `/ai/recipes/generate` | `generate_recipe` | Gera receita com itens da despensa |
| `POST` | `/ai/meals/suggest` | `suggest_meals` | Sugere até 3 refeições |
| `POST` | `/ai/workouts/calibrate` | `calibrate_workout` | Ajusta carga/repetições pós-treino |
| `POST` | `/ai/workouts/generate-plan` | `generate_workout_plan` | Gera ficha de treino completa |
| `POST` | `/ai/workouts/scan-sheet` | `scan_workout_sheet` | OCR de ficha (imagem/PDF) via Gemini Vision |

**Nenhum endpoint de IA requer autenticação** — são chamadas stateless com contexto no payload.

---

### 6.4 `social_router` — Social e Ranking

**Prefixo:** `/social` | **Tags:** `Social`  
**Arquivo:** [`social_router.py`](file:///home/leandro/dev/pessoais/lifequest/backend/app/adapters/http/social_router.py)

#### Endpoints

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `GET` | `/social/ranking/global` | Opcional | Top 100 por nível → XP → streak |
| `GET` | `/social/ranking/friends` | ✅ | Ranking entre amigos aceitos |
| `GET` | `/social/ranking/visibility` | ✅ | Verifica visibilidade no ranking |
| `POST` | `/social/ranking/visibility` | ✅ | Altera visibilidade no ranking |
| `GET` | `/social/search?q=...` | ✅ | Busca usuários por username (min 2 chars) |
| `GET` | `/social/friends` | ✅ | Lista amigos aceitos |
| `GET` | `/social/friends/requests` | ✅ | Lista solicitações pendentes recebidas |
| `POST` | `/social/friends/request` | ✅ | Envia solicitação de amizade por username |
| `POST` | `/social/friends/accept/{id}` | ✅ | Aceita solicitação de amizade |
| `DELETE` | `/social/friends/{id}` | ✅ | Remove amigo ou recusa solicitação |

#### Lógica de Ranking

Ordenação por: **nível** (primário) → **XP** (desempate) → **streak** (terciário)

Isso garante que um jogador de nível mais alto sempre preceda um de nível menor, independentemente do XP acumulado total.

O ranking global só exibe usuários com `ranking_visible = true`. Usuários podem optar por sair do ranking sem perder seus dados.

---

### 6.5 `payment_router` — Pagamentos

**Prefixo:** `/payments` | **Tags:** `payments`  
**Arquivo:** [`payment_router.py`](file:///home/leandro/dev/pessoais/lifequest/backend/app/adapters/http/payment_router.py)

#### Endpoints

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| `POST` | `/payments/subscribe` | ✅ | Gera link de checkout (Mercado Pago) |
| `POST` | `/payments/webhook` | Público | Recebe notificação de pagamento aprovado |

#### Planos Disponíveis

| `plan` | Preço | Duração |
|---|---|---|
| `monthly` | R$ 4,99 | 30 dias |
| `lifetime` | R$ 19,99 | Vitalício (`pro_expires_at = null`) |

#### Fluxo de Pagamento

1. Frontend chama `POST /payments/subscribe` com o plano escolhido
2. Backend cria uma **Preference** no Mercado Pago com `external_reference: "{user_id}:{plan}"`
3. Retorna `{ checkout_url }` para o frontend redirecionar o usuário
4. Após o pagamento, o Mercado Pago chama `POST /payments/webhook`
5. O backend valida o pagamento diretamente na API do MP (Zero Trust)
6. Se aprovado, atualiza `is_pro = true` e `pro_expires_at` no banco

---

## 7. Camada de Domínio (`domain/`)

### 7.1 Entidades

**Arquivo:** [`domain/entities/ai_entities.py`](file:///home/leandro/dev/pessoais/lifequest/backend/app/domain/entities/ai_entities.py)

Entidades puras de domínio — **sem dependência de HTTP, banco ou bibliotecas externas**.

| Entidade | Campos Principais |
|---|---|
| `PantryItemEntity` | `name, category, quantity` |
| `RecipeEntity` | `title, ingredients_used, ingredients_missing, calories, protein_g, instructions` |
| `OnboardingAnswers` | `answers: dict[str, str]` |
| `ArchetypeEntity` | `archetype, archetype_description, initial_missions` |
| `MissionRequest` | `pillar, player_level, recent_failures` |
| `MissionEntity` | `title, description, difficulty, xp_reward` |
| `DailyQuestEntity` | `id, pillar, title, description, xp_reward` |
| `DailyQuestsRequest` | `player_level, focus_areas, recent_quest_titles` |
| `EpicQuestEntity` | `title, description, target_value, unit, xp_reward, deadline_days` |
| `WorkoutCalibrationRequest` | `exercise_name, last_feedback, current_sets, current_reps, current_weight_kg` |
| `WorkoutCalibrationEntity` | `suggested_sets, suggested_reps, suggested_weight_kg, rationale` |
| `WorkoutPlanGenerationRequest` | `goal, equipment, level, days_per_week, session_duration_min` |
| `WorkoutPlanGenerationEntity` | `plan_name, exercises, rationale` |

### 7.2 Casos de Uso (Use Cases)

**Diretório:** [`domain/use_cases/`](file:///home/leandro/dev/pessoais/lifequest/backend/app/domain/use_cases/)

Cada use case é um módulo Python independente com uma função assíncrona principal. Recebem as entidades de domínio e o `ai_provider` como parâmetros (injeção de dependência).

| Módulo | Função Principal | Descrição |
|---|---|---|
| `generate_archetype.py` | `generate_archetype(answers, ai_provider)` | Analisa respostas do onboarding e gera o arquétipo RPG do jogador |
| `generate_mission.py` | `generate_mission(request, ai_provider)` | Gera uma missão para o pilar e nível especificados |
| `generate_daily_quests.py` | `generate_daily_quests(request, ai_provider)` | Gera 3 missões diárias evitando repetição de títulos recentes |
| `generate_epic_quest.py` | `generate_epic_quest(request, ai_provider)` | Gera uma meta épica com prazo e valor numérico |
| `generate_recipe.py` | `generate_recipe(pantry_items, goal, meal_type, ai_provider)` | Receita baseada nos itens disponíveis na despensa |
| `suggest_meals.py` | `suggest_meals(pantry_items, meal_type, calorie_target, ...)` | Sugere até 3 refeições com contexto nutricional |
| `calibrate_workout.py` | `calibrate_workout(request, ai_provider)` | Ajusta carga/séries baseado no feedback pós-treino |
| `generate_workout_plan.py` | `generate_workout_plan(request, ai_provider)` | Gera ficha de treino completa com exercícios e progressão |
| `scan_workout_sheet.py` | `scan_workout_sheet(image_base64, ai_provider, ...)` | OCR multimodal de fichas manuscritas, impressas ou PDFs |

---

## 8. Camada de Infraestrutura (`infra/`)

### 8.1 Configuração

**Arquivo:** [`infra/config.py`](file:///home/leandro/dev/pessoais/lifequest/backend/app/infra/config.py)

Usa `pydantic-settings` para carregar variáveis de ambiente do `.env` com tipagem forte.

```python
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    groq_api_key: str = ""
    gemini_api_key: str = ""
    google_client_id: str = "..."
    mercadopago_access_token: str = ""
    cors_origins: list[str] = [...]
    cors_origins_regex: str = "..."
    environment: str = "development"
    database_url: str = "postgresql+asyncpg://..."
    secret_key: str = "..."
```

### 8.2 Banco de Dados

**Arquivo:** `infra/database.py`

- Engine assíncrona via **asyncpg** + SQLAlchemy 2.0
- Sessões gerenciadas por `get_db_session()` (FastAPI Depends)
- Cada request HTTP tem sua própria sessão com `begin()` automático
- **Commit** ocorre ao final do request; **Rollback** em caso de exceção

### 8.3 Segurança (JWT)

**Arquivo:** `infra/security.py`

| Função | Descrição |
|---|---|
| `get_password_hash(password)` | Hash bcrypt com passlib |
| `verify_password(plain, hashed)` | Verifica senha |
| `create_access_token(data)` | Cria JWT assinado com `HS256` |

O token **não expira** por padrão na configuração atual — considerar adicionar `exp` em produção.

### 8.4 Provedor de IA

**Arquivo:** [`infra/ai_client.py`](file:///home/leandro/dev/pessoais/lifequest/backend/app/infra/ai_client.py)

Implementa a interface `AIProviderInterface` com **fallback automático**:

```
Tentativa 1: Groq API (openai/gpt-oss-120b)
    ↓ (se falhar)
Tentativa 2: Gemini API (gemini-3.5-flash-lite → gemini-3.5-flash → gemini-3.1-flash-lite)
```

#### Métodos

| Método | Descrição |
|---|---|
| `generate_json(system_prompt, user_prompt)` | Texto → JSON estruturado (usa Groq ou Gemini) |
| `generate_from_image(image_base64, mime_type, prompt)` | Multimodal — imagem/PDF → JSON (usa apenas Gemini) |

**Formatos aceitos pelo `generate_from_image`:**
- String base64 única (`image_base64: str`)
- Lista de dicts `[{"image_base64": "...", "mime_type": "image/jpeg"}, ...]`
- Data URI com prefixo (`data:image/jpeg;base64,...`) — o prefixo é removido automaticamente

---

## 9. Autenticação e Autorização

A autenticação usa **JWT Bearer Token** (RFC 6750). O token é passado no header:

```
Authorization: Bearer eyJ...
```

### Verificação de Token

```python
def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    return payload.get("sub")  # UUID do usuário
```

### Rotas Protegidas vs. Públicas

| Módulo | Proteção |
|---|---|
| `/auth/register` | Pública |
| `/auth/login` | Pública |
| `/auth/google` | Pública |
| `/ai/*` | Pública (stateless, sem dados pessoais) |
| `/sync/push` | 🔐 Bearer obrigatório |
| `/sync/pull` | 🔐 Bearer obrigatório |
| `/social/ranking/global` | Opcional (enriquece com friendship_status se autenticado) |
| `/social/*` (demais) | 🔐 Bearer obrigatório |
| `/payments/subscribe` | 🔐 Bearer obrigatório |
| `/payments/webhook` | Pública (autenticação por validação no MP) |

---

## 10. CORS

Configurado com origens explícitas + regex para máxima segurança sem bloquear desenvolvimento:

```python
cors_origins: list[str] = [
    "http://localhost:5173",
    "http://localhost:4173",
]

cors_origins_regex: str = (
    r"http://(192\.168|10\.\d+)\.\d+\.\d+(:\d+)?"  # LAN local
    r"|https://.*\.vercel\.app"                      # Deploys Vercel
    r"|https://.*\.railway\.app"                     # Deploys Railway
)
```

---

## 11. Variáveis de Ambiente

**Arquivo:** `backend/.env` (baseado em `.env.example`)

| Variável | Obrigatório | Padrão | Descrição |
|---|---|---|---|
| `DATABASE_URL` | ✅ | `postgresql+asyncpg://...` | URL de conexão PostgreSQL |
| `SECRET_KEY` | ✅ | `lifequest-super-secret-key-...` | Chave de assinatura JWT |
| `GROQ_API_KEY` | ✅ | `""` | Chave da API Groq (LLM principal) |
| `GEMINI_API_KEY` | Recomendado | `""` | Chave API Gemini (fallback + Vision) |
| `GOOGLE_CLIENT_ID` | Para Google Auth | `"228718..."` | Client ID OAuth2 do Google |
| `MERCADOPAGO_ACCESS_TOKEN` | Para pagamento | `""` | Token do Mercado Pago |
| `CORS_ORIGINS` | Para produção | `["http://localhost:..."]` | Lista JSON de origens permitidas |
| `ENVIRONMENT` | Não | `development` | Exibido em `/health` |
| `FRONTEND_URL` | Para pagamento | `http://localhost:5173` | URL de retorno pós-pagamento |

> ⚠️ **NUNCA** commitar o `.env` com valores reais. O `.gitignore` já o exclui.

---

## 12. Deploy e Execução

### Desenvolvimento Local

```bash
# 1. Subir o banco PostgreSQL via Docker
docker-compose up db -d

# 2. Ativar ambiente virtual
cd backend
python -m venv .venv && source .venv/bin/activate

# 3. Instalar dependências
pip install -r requirements.txt

# 4. Rodar migrações
alembic upgrade head

# 5. Iniciar servidor com hot-reload
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Produção (Railway)

O `Dockerfile` define a imagem de produção:

```bash
# start.sh executa: alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000
```

A variável `DATABASE_URL` é injetada automaticamente pelo Railway ao conectar o serviço PostgreSQL.

---

## 13. Testes

```bash
cd backend
pytest                          # Roda todos os testes
pytest tests/ -v               # Verbose
pytest --asyncio-mode=auto     # Para testes async
```

Arquivos de teste:
- `tests/` — testes unitários dos use cases
- `test_sync2.py` — testes de sincronização
- `test_sync_google.py` — testes do login Google

---

*Documentação gerada em 30/09/2026 com base no estado atual do código-fonte.*
