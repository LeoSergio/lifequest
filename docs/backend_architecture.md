# Documento Arquitetural — Backend LifeQuest

> **Objetivo deste documento**: descrever com precisão técnica a arquitetura do backend,
> com ênfase na estratégia **offline-first** de sincronização, de modo que você possa
> avaliar se esse padrão pode ser reaproveitado em outros projetos.

---

## 1. Visão Geral

O backend do LifeQuest foi projetado com uma filosofia explícita: **ser o mínimo necessário**. Ele não é o sistema de registro (*system of record*) da aplicação — esse papel é do dispositivo do usuário (IndexedDB via Dexie.js). O backend existe para três propósitos únicos:

| Propósito | Responsável |
|---|---|
| **Backup & Sincronização** — guardar uma cópia dos dados do usuário no servidor e sincronizar entre dispositivos | `sync_router` + PostgreSQL |
| **AI Gateway** — intermediar chamadas aos modelos de IA sem expor as chaves de API ao frontend | `ai_router` + Use Cases |
| **Camadas Sociais & Monetização** — ranking global, amizades, assinatura PRO | `social_router` + `payment_router` |

O resultado é um serviço **100% stateless do ponto de vista de negócio**: nenhuma lógica de negócio *crítica* ocorre no backend. Se o backend cair, o app continua funcionando normalmente.

---

## 2. Stack Tecnológico

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Framework web | **FastAPI 0.115** | Performance assíncrona nativa, validação automática com Pydantic v2 |
| Linguagem | **Python 3.12** | Ecossistema maduro para IA e async |
| ORM | **SQLAlchemy 2.0 (async)** | Suporte a `asyncpg`, tipagem forte com `Mapped[]` |
| Driver BD | **asyncpg 0.29** | Driver PostgreSQL nativo async (sem bloqueio de event loop) |
| Banco de dados | **PostgreSQL 15** | JSONB para payloads flexíveis, restrições de integridade |
| Migrations | **Alembic 1.13** | Versionamento de schema, compatível com async |
| Auth | **PyJWT 2.8 + bcrypt 4.2** | JWT HS256, 7 dias de validade |
| HTTP client | **httpx 0.27** | Cliente async para chamar APIs de IA |
| Configuração | **pydantic-settings 2.5** | Carrega `.env` com validação de tipos |
| Pagamentos | **mercadopago SDK 3.2** | Checkout Pro + Webhooks |
| Containerização | **Docker + docker-compose** | Dev e produção consistentes |

---

## 3. Arquitetura em Camadas (Clean Architecture)

O código segue uma arquitetura em camadas inspirada na **Clean Architecture** / **Ports & Adapters (Hexagonal)**:

```
backend/app/
├── adapters/          ← Camada de Interface (HTTP)
│   └── http/
│       ├── ai_router.py        # Traduz HTTP → Use Cases
│       ├── auth_router.py      # Registro, login, Google OAuth
│       ├── sync_router.py      # Push/Pull de sincronização
│       ├── social_router.py    # Ranking, amizades
│       ├── payment_router.py   # Checkout Pro, webhooks
│       └── schemas.py          # DTOs da API (separados das entities)
│
├── domain/            ← Núcleo de Negócio (puro, sem dependências externas)
│   ├── entities/
│   │   └── ai_entities.py      # Tipos de negócio (PantryItemEntity, etc.)
│   ├── repositories/
│   │   └── ai_provider_interface.py  # Porta de saída abstrata para IA
│   └── use_cases/
│       ├── generate_recipe.py
│       ├── generate_archetype.py
│       ├── generate_daily_quests.py
│       ├── generate_epic_quest.py
│       ├── generate_mission.py
│       ├── calibrate_workout.py
│       ├── generate_workout_plan.py
│       └── suggest_meals.py
│
└── infra/             ← Implementações concretas (BD, IA, Segurança)
    ├── ai_client.py            # GroqGeminiProvider (impl. concreta)
    ├── config.py               # Settings (pydantic-settings)
    ├── database.py             # Engine async + get_db_session
    ├── security.py             # JWT + bcrypt
    └── models/
        ├── user_model.py       # Tabela `users`
        └── sync_models.py      # Tabelas sincronizadas (SyncBase)
```

### Regra de Dependência

```mermaid
graph LR
    A[adapters/http] -->|usa| B[domain/use_cases]
    B -->|depende de| C[domain/entities]
    B -->|depende de| D[domain/repositories - interface]
    E[infra/ai_client] -->|implementa| D
    E -->|usa| F[infra/config]
    A -->|usa diretamente| G[infra/database]
    A -->|usa diretamente| H[infra/models]
```

> [!IMPORTANT]
> Os **use cases** nunca importam nada de `infra/` nem de `adapters/`. A injeção
> do `ai_provider` é feita pelo adapter no momento da chamada — isso permite trocar
> Groq por Gemini (ou qualquer outro provedor) sem alterar uma linha de lógica de negócio.

---

## 4. Estratégia Offline-First de Sincronização

Esta é a peça central da arquitetura. Toda a estratégia é implementada em
[`sync_router.py`](file:///home/leandro/dev/pessoais/lifequest/backend/app/adapters/http/sync_router.py).

### 4.1 Filosofia: Client-First com Backup no Servidor

```
┌─────────────────────────────────────────┐
│           DISPOSITIVO DO USUÁRIO        │
│                                         │
│  ┌──────────┐   ┌──────────────────┐   │
│  │ App UI   │──▶│  IndexedDB       │   │
│  │ (Svelte) │   │  (Dexie.js)      │   │
│  └──────────┘   │  - habits        │   │
│                 │  - goals         │   │
│                 │  - workouts      │   │
│                 │  - syncQueue ◄───│───┼── writes offline
│                 └──────────────────┘   │
└──────────────┬──────────────────────────┘
               │ Quando online
               ▼
┌─────────────────────────────────────────┐
│           BACKEND (FastAPI)             │
│                                         │
│  POST /sync/push  ◄── envia eventos     │
│  GET  /sync/pull  ──► recebe mudanças   │
│                                         │
│  ┌──────────────────────────────────┐   │
│  │  PostgreSQL                      │   │
│  │  - habits, goals, workouts...    │   │
│  │  (cópia do estado do cliente)    │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

**Princípio fundamental**: o IndexedDB é a fonte da verdade. O PostgreSQL é um espelho com capacidade social (ranking, amizades).

### 4.2 Modelo de Evento: SyncEvent

Cada operação do usuário que deve ser persistida gera um `SyncEvent` na fila local (`syncQueue` do Dexie):

```python
class SyncEvent(BaseModel):
    id: int           # ID sequencial local na syncQueue
    entity: str       # Nome da tabela: "habits", "goals", "workoutSessions"...
    entityId: str     # UUID do registro afetado (gerado pelo cliente)
    action: str       # "upsert" | "delete"
    timestamp: str    # ISO 8601 — quando ocorreu no cliente
    payload: dict     # O dado completo (para upserts)
```

### 4.3 Fluxo de Push (Cliente → Servidor)

```mermaid
sequenceDiagram
    participant C as Cliente (PWA)
    participant B as Backend (FastAPI)
    participant DB as PostgreSQL

    C->>B: POST /sync/push { events: [...] }
    note over B: Autentica JWT
    loop Para cada evento
        B->>DB: BEGIN SAVEPOINT
        alt event.action == "upsert"
            B->>DB: SELECT WHERE id = entityId AND user_id = ?
            alt Registro existe
                B->>DB: UPDATE (campos do payload)
            else Novo registro
                B->>DB: INSERT (camelCase → snake_case automático)
            end
        else event.action == "delete"
            B->>DB: UPDATE SET deleted=True (soft delete)
        end
        alt Sucesso
            DB-->>B: RELEASE SAVEPOINT
        else Erro (constraint, schema inválido)
            DB-->>B: ROLLBACK TO SAVEPOINT
            B->>B: adiciona event.id em failed_events
        end
    end
    B->>DB: COMMIT (todos os SAVEPOINTs bem-sucedidos)
    B-->>C: { success: true, processed_events: N, failed_events: [ids...] }
    note over C: Remove da syncQueue apenas os IDs<br/>que NÃO estão em failed_events
```

**Destaques desta implementação:**

- **SAVEPOINT por evento**: uma falha em um evento malformado não derruba o lote inteiro. Cada evento tem sua própria sub-transação.
- **Isolamento por `(id, user_id)`**: chave primária composta garante que dois usuários com o mesmo `entityId` (UUIDs legados sequenciais) não colidam.
- **camelCase → snake_case automático**: o frontend (Dexie.js) usa camelCase; o SQLAlchemy usa snake_case. A conversão é feita com regex no momento do upsert.
- **Whitelist de colunas**: apenas campos que existem na tabela do banco são aceitos. O resto é descartado silenciosamente, prevenindo injeção de campos arbitrários.
- **`updated_at` sempre gerenciado pelo servidor**: o backend sobrescreve este campo para evitar problemas de clock skew entre dispositivos.

### 4.4 Fluxo de Pull (Servidor → Cliente)

```mermaid
sequenceDiagram
    participant C as Cliente (PWA)
    participant B as Backend (FastAPI)
    participant DB as PostgreSQL

    C->>B: GET /sync/pull?last_sync=2026-08-01T16:50:19Z
    note over B: Autentica JWT<br/>Normaliza timestamp (remove Z, offset)
    loop Para cada tabela mapeada
        B->>DB: SELECT * WHERE user_id=? AND updated_at > last_sync
        DB-->>B: registros modificados
    end
    B->>DB: SELECT * FROM users WHERE id=? AND updated_at > last_sync
    DB-->>B: dados do Player (se modificados)
    B-->>C: { timestamp: "2026-09-02T21:43:00Z", changes: { habits: [...], goals: [...], player: [...] } }
    note over C: Aplica mudanças no IndexedDB<br/>Salva o novo timestamp para o próximo pull
```

**Destaques:**
- **Delta sync**: retorna apenas registros com `updated_at > last_sync`, não o dataset completo.
- **Inclui soft-deletes**: registros com `deleted=True` são retornados normalmente; o cliente aplica a deleção no IndexedDB ao ver o flag.
- **Normalização de timestamp**: tratamento cuidadoso de formatos ISO 8601 (Z, +00:00, duplo sufixo) para evitar bugs de comparação naive vs. aware.
- **Serialização segura**: datetimes convertidos para ISO + "Z" para consumo direto pelo JavaScript sem ambiguidade.

### 4.5 Mapeamento de Tabelas

O roteador mantém um dicionário explícito que traduz nomes do frontend para modelos SQLAlchemy:

```python
TABLE_TO_MODEL = {
    "habits":               HabitModel,
    "habitCompletions":     HabitCompletionModel,
    "goals":               GoalModel,
    "dailyQuests":         DailyQuestModel,
    "exercises":           ExerciseModel,
    "workoutPlans":        WorkoutPlanModel,
    "workoutPlanExercises": WorkoutPlanExerciseModel,
    "workoutSessions":     WorkoutSessionModel,
    "sessionSets":         SessionSetModel,
    "pantryItems":         PantryItemModel,
    "bodyMeasurements":    BodyMeasurementModel,
    "inventory":           InventoryModel,
    "unlockedAchievements": UnlockedAchievementModel,
    # Entidade especial (não usa SyncBase):
    # "player" → UserModel (tratado separadamente no código)
}
```

---

## 5. Modelo de Dados — SyncBase

Todos os modelos sincronizáveis herdam de [`SyncBase`](file:///home/leandro/dev/pessoais/lifequest/backend/app/infra/models/sync_models.py):

```python
class SyncBase(Base):
    __abstract__ = True

    id: Mapped[str]         # UUID gerado pelo CLIENTE (crypto.randomUUID())
    user_id: Mapped[UUID]   # FK para users.id — chave primária composta (id, user_id)
    deleted: Mapped[bool]   # Soft delete — nunca deletamos fisicamente
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]  # Critério de delta sync
```

**Por que PK composta `(id, user_id)`?**

- O cliente gera o UUID localmente (`crypto.randomUUID()`), o que elimina colisões na prática.
- A PK composta é uma **defesa em profundidade**: mesmo que dois usuários gerem IDs idênticos (ex.: dados legados com IDs sequenciais), o par `(id, user_id)` permanece único.

### Diagrama do Modelo de Dados

```mermaid
erDiagram
    users {
        UUID id PK
        string email UK
        string username UK
        string hashed_password
        int level
        int xp
        int coins
        int pro_coins
        int streak_days
        string avatar
        bool is_pro
        datetime pro_expires_at
        bool ranking_visible
    }

    habits {
        string id PK
        UUID user_id PK_FK
        string title
        string cadence
        int weekly_target
        int xp_reward
        bool deleted
        datetime updated_at
    }

    habit_completions {
        string id PK
        UUID user_id PK_FK
        string habit_id
        string date
        bool deleted
    }

    goals {
        string id PK
        UUID user_id PK_FK
        string title
        float target_value
        float current_value
        string unit
        int xp_reward
        string deadline
        bool is_epic
        bool deleted
    }

    daily_quests {
        string id PK
        UUID user_id PK_FK
        string date
        string pillar
        string title
        int xp_reward
        bool completed
        bool deleted
    }

    workout_plans {
        string id PK
        UUID user_id PK_FK
        string name
        string weekday
        int estimated_duration
        bool deleted
    }

    workout_sessions {
        string id PK
        UUID user_id PK_FK
        string workout_plan_id
        string started_at
        string finished_at
        bool is_rest_day
        bool deleted
    }

    session_sets {
        string id PK
        UUID user_id PK_FK
        string workout_session_id
        string exercise_id
        int set_number
        float weight_kg
        int reps_done
        bool deleted
    }

    pantry_items {
        string id PK
        UUID user_id PK_FK
        string name
        string category
        string quantity
        bool deleted
    }

    body_measurements {
        string id PK
        UUID user_id PK_FK
        string date
        float weight
        float height
        float body_fat_percent
        bool deleted
    }

    friendships {
        UUID id PK
        UUID requester_id FK
        UUID addressee_id FK
        string status
    }

    users ||--o{ habits : "possui"
    users ||--o{ goals : "possui"
    users ||--o{ workout_sessions : "possui"
    users ||--o{ pantry_items : "possui"
    users ||--o{ friendships : "solicita/recebe"
```

---

## 6. AI Gateway — Padrão de Abstração

O backend age como um **proxy seguro** para modelos de IA. As chaves de API nunca chegam ao cliente.

### 6.1 Arquitetura do AI Gateway

```mermaid
graph TD
    A[HTTP Request] --> B[ai_router adapter]
    B --> C{Use Case}
    C --> D[AIProviderInterface]
    D --> E{Groq disponível?}
    E -- Sim --> F[Groq API]
    E -- Não --> G{Gemini disponível?}
    G -- Sim --> H[Gemini API]
    G -- Não --> I[Relança erro do Groq]
    F --> J[JSON Response]
    H --> J
    J --> K[Valida com Entity Pydantic]
    K --> L[Retorna para adapter]
    L --> M[HTTP Response]
```

### 6.2 Interface de Porta de Saída

```python
class AIProviderInterface(ABC):
    @abstractmethod
    async def generate_json(self, system_prompt: str, user_prompt: str) -> dict:
        """Nunca persiste nada — cada chamada é completamente stateless."""
        ...
```

### 6.3 Implementação com Fallback Automático

```python
class GroqGeminiProvider(AIProviderInterface):
    async def generate_json(self, system_prompt, user_prompt) -> dict:
        try:
            return await self._call_groq(system_prompt, user_prompt)
        except Exception as groq_error:
            if not settings.gemini_api_key:
                raise groq_error  # relança erro original para debug
            return await self._call_gemini(system_prompt, user_prompt)
```

- **Groq** (primário): baixa latência (~1s), usa `response_format: json_object` para forçar JSON válido.
- **Gemini 1.5 Flash** (fallback): `response_mime_type: application/json`, timeout 30s.
- **Singleton**: instância única injetada nos routers via `Depends()`.

### 6.4 Use Cases de IA Disponíveis

| Endpoint | Use Case | Descrição |
|---|---|---|
| `POST /ai/onboarding/archetype` | `generate_archetype` | Quiz de onboarding → arquétipo RPG + 3 missões iniciais |
| `POST /ai/quests/daily` | `generate_daily_quests` | 3 missões diárias personalizadas por nível |
| `POST /ai/quests/epic` | `generate_epic_quest` | Missão épica de longo prazo |
| `POST /ai/missions/generate` | `generate_mission` | Missão ad-hoc por pilar e nível |
| `POST /ai/recipes/generate` | `generate_recipe` | Receita com base na despensa |
| `POST /ai/meals/suggest` | `suggest_meals` | Até 3 sugestões de refeição |
| `POST /ai/workouts/calibrate` | `calibrate_workout` | Ajuste de carga/reps com base em feedback |
| `POST /ai/workouts/generate-plan` | `generate_workout_plan` | Ficha completa de treino por objetivo |

---

## 7. Autenticação e Segurança

### 7.1 Estratégias de Autenticação

| Método | Endpoint | Detalhes |
|---|---|---|
| **Email + Senha** | `POST /auth/register`, `POST /auth/login` | bcrypt (salt automático), username único por auto-incremento |
| **Google OAuth** | `POST /auth/google` | Validação do `id_token` via `google-auth`. Cria conta automaticamente se nova. |

### 7.2 Token JWT

- **Algoritmo**: HS256
- **Validade**: 7 dias
- **Payload**: `{ "sub": "<user_uuid>", "exp": <timestamp> }`
- **Transmissão**: `Authorization: Bearer <token>` em todos os endpoints protegidos

```python
# Todos os routers protegidos usam o mesmo padrão:
security = HTTPBearer()

def get_current_user_id(credentials = Depends(security)) -> str:
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    return payload.get("sub")  # UUID do usuário
```

### 7.3 Isolamento de Dados

Todos os endpoints de sync e social **filtram obrigatoriamente por `user_id`** extraído do JWT. Um usuário nunca pode ler ou modificar dados de outro usuário nas tabelas sincronizadas.

---

## 8. Módulo Social

O módulo social é o **único componente que armazena dados além do backup pessoal**. Ele existe porque o ranking e amizades são inerentemente multi-usuário.

### 8.1 Endpoints

| Endpoint | Auth | Descrição |
|---|---|---|
| `GET /social/ranking/global` | Opcional | Top 100 por nível → XP → streak. Respeita `ranking_visible` |
| `GET /social/ranking/friends` | Obrigatória | Ranking filtrado pelos amigos do usuário |
| `GET /social/search?q=` | Obrigatória | Busca por username (ilike, mín. 2 chars) |
| `POST /social/friends/request` | Obrigatória | Envia solicitação por username |
| `POST /social/friends/accept/{id}` | Obrigatória | Aceita solicitação recebida |
| `DELETE /social/friends/{id}` | Obrigatória | Remove amigo ou recusa solicitação |
| `GET/POST /social/ranking/visibility` | Obrigatória | Controla aparição no ranking global |

### 8.2 Modelo de Amizades

Tabela `friendships` é **direcional** no banco (requester → addressee) mas bidirecional nas queries:

```python
# Consulta amigos aceitos nas DUAS direções
select(FriendshipModel).where(
    FriendshipModel.status == "accepted",
    or_(
        FriendshipModel.requester_id == uid,
        FriendshipModel.addressee_id == uid,
    )
)
```

Constraints de integridade no banco:
- `UniqueConstraint("requester_id", "addressee_id")` — sem duplicatas
- `CheckConstraint("requester_id <> addressee_id")` — sem auto-amizade

---

## 9. Módulo de Pagamentos (Mercado Pago)

### 9.1 Fluxo de Checkout

```mermaid
sequenceDiagram
    participant C as Cliente
    participant B as Backend
    participant MP as Mercado Pago

    C->>B: POST /payments/subscribe { plan: "lifetime" }
    B->>MP: preference().create({ items, back_urls, external_reference: "user_id:plan" })
    MP-->>B: { init_point: "https://mp.com/checkout/..." }
    B-->>C: { checkout_url: "https://mp.com/checkout/..." }
    C->>MP: Redireciona usuário para o checkout
    MP->>B: POST /payments/webhook { action: "payment.updated", data.id: "..." }
    B->>MP: payment().get(data_id)  ← Zero Trust: valida no MP
    MP-->>B: { status: "approved", external_reference: "user_id:plan" }
    B->>DB: UPDATE users SET is_pro=True, pro_expires_at=?
```

### 9.2 Planos Disponíveis

| Plano | ID | Preço | Expiração |
|---|---|---|---|
| Mensal | `PRO_MONTHLY` | R$ 4,99 | 30 dias após aprovação |
| Vitalício | `PRO_LIFETIME` | R$ 19,99 | Nunca (`pro_expires_at = null`) |

**Zero Trust no Webhook**: o backend não confia no payload do webhook — sempre re-consulta o status real do pagamento na API do Mercado Pago antes de ativar o PRO.

---

## 10. Gestão de Sessão de Banco (AsyncSession)

```python
async def get_db_session() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        async with session.begin():   # ← begin() EXPLÍCITO
            yield session
```

> [!IMPORTANT]
> O `session.begin()` explícito é obrigatório. Sem ele, o asyncpg não abre
> uma transação de nível superior — chamadas a `session.begin_nested()`
> (SAVEPOINT, usado no push de sync) lançariam `"no transaction is active"`.
> Com ele, a transação de nível superior sempre existe e os SAVEPOINTs funcionam.

O commit é implícito ao sair do `session.begin()` sem exceção. Não se usa `db.commit()` manualmente nos routers — isso causaria `InvalidRequestError`.

---

## 11. Configuração e Deploy

### 11.1 Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | ✅ Sim | `postgresql+asyncpg://user:pass@host:5432/db` |
| `SECRET_KEY` | ✅ Sim (prod) | Chave HS256 para JWT |
| `GROQ_API_KEY` | ✅ Sim | Chave do provedor principal de IA |
| `GEMINI_API_KEY` | ⚠️ Recomendado | Fallback de IA |
| `GOOGLE_CLIENT_ID` | ⚠️ Opcional | OAuth Google |
| `MERCADOPAGO_ACCESS_TOKEN` | ⚠️ Opcional | Pagamentos |
| `CORS_ORIGINS` | ⚠️ Prod | JSON array de origens permitidas |
| `ENVIRONMENT` | ✅ Sim | `development` \| `production` |

### 11.2 Infraestrutura de Produção

```
┌─────────────────┐     ┌───────────────────┐     ┌──────────────────┐
│ Cloudflare Pages│────▶│ Backend (Railway   │────▶│ PostgreSQL       │
│ ou Vercel       │     │ ou Fly.io)         │     │ (Railway Postgres)│
│ (PWA Estática)  │     │ FastAPI + uvicorn  │     └──────────────────┘
└─────────────────┘     └───────────────────┘
                                 │
                                 ▼
                         ┌───────────────────┐
                         │ Groq API          │
                         │ Gemini API        │
                         │ Mercado Pago API  │
                         └───────────────────┘
```

### 11.3 Dockerfile

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 12. Padrões Aplicados — Resumo de Decisões

| Decisão | Escolha | Alternativas Consideradas |
|---|---|---|
| Arquitetura de sincronização | **Push/Pull com event sourcing leve** (SyncQueue no cliente) | CRDTs (complexo demais), Sync em tempo real via WebSocket (overkill) |
| Resolução de conflitos | **Last-Write-Wins via `updated_at`** | CRDT (complexo), merge manual (inviável para muitos tipos de dado) |
| Geração de IDs | **UUID no cliente** (`crypto.randomUUID()`) | ID sequencial no servidor (requer round-trip; inviável offline) |
| Soft delete | **Flag `deleted=True` + delta sync** | Hard delete (impossível sincronizar deleções com LWW) |
| Chave primária | **Composta `(id, user_id)`** | Só `id` (risco de colisão entre usuários com dados legados) |
| Granularidade do evento de sync | **Por entidade/registro** | Por campo (muito granular), por tabela (muito grosseiro) |
| Sub-transação por evento | **SAVEPOINT** por evento no lote | Rollback total do lote (bloqueia a fila indefinidamente) |
| Abstração de IA | **Interface `AIProviderInterface` + Dependency Injection** | Chamar Groq diretamente (sem portabilidade) |

---

## 13. Avaliação de Reusabilidade em Outros Projetos

### O que é facilmente reutilizável

| Componente | Esforço para Reusar | O que mudar |
|---|---|---|
| **Padrão SyncBase + Push/Pull** | Baixo | Definir as entidades do novo domínio herdando `SyncBase` |
| **TABLE_TO_MODEL + `_apply_event`** | Baixo | Popular o dicionário com os modelos do novo projeto |
| **AI Gateway (AIProviderInterface)** | Mínimo | Zero mudança — é agnóstico ao domínio |
| **Auth JWT (email + Google)** | Mínimo | Trocar `google_client_id` nas config |
| **Gestão de sessão async (SAVEPOINT)** | Mínimo | Zero mudança — padrão puro de SQLAlchemy |
| **Configuração com pydantic-settings** | Mínimo | Adicionar/remover campos em `Settings` |

### O que é específico do LifeQuest

| Componente | Por que é específico |
|---|---|
| Modelos de domínio (`habits`, `workoutSessions`, etc.) | Regras de negócio do app |
| Sistema social (ranking, amizades) | Escopo gamificado |
| Pagamentos (Mercado Pago) | Produto específico |
| Use cases de IA (prompts de RPG) | Tom e conteúdo do produto |

### Requisitos para adotar este padrão em um novo projeto

1. **Frontend deve gerar UUIDs localmente** para os registros (sem depender do servidor para criar IDs).
2. **Frontend deve manter uma `syncQueue`** — fila persistente de eventos não sincronizados.
3. **Modelo de resolução de conflito deve ser LWW** — se precisar de merge semântico (ex.: documentos colaborativos), esse padrão não é adequado.
4. **Dados devem ser isoláveis por usuário** — o backend usa `user_id` para particionar tudo. Multi-tenant compartilhado requereria adaptações.
5. **Soft deletes são obrigatórios** — o delta sync depende de `updated_at` para transmitir deleções; hard deletes "somem" sem deixar rastro para o pull.

### Cenários onde este padrão se encaixa bem

- ✅ Aplicativos **mobile ou PWA** com uso frequente offline (diário, academia, finanças pessoais)
- ✅ Apps **single-tenant** (cada usuário tem seus dados completamente isolados)
- ✅ Dados com **baixo volume de conflitos** (um usuário em um dispositivo por vez)
- ✅ Projetos que precisam de **backup + social** sem abrir mão da privacidade local

### Cenários onde este padrão não se encaixa

- ❌ **Edição colaborativa em tempo real** (Google Docs, Figma) — exige CRDTs ou OT
- ❌ **Transações financeiras críticas** — LWW é inseguro para saldos/débitos concorrentes
- ❌ **Multi-device concorrente intenso** — dois dispositivos editando o mesmo registro simultaneamente podem perder uma das edições

---

*Documento gerado automaticamente com base na análise do código-fonte em 02/09/2026.*
