# LifeQuest — Documentação Técnica do Banco de Dados

> **SGBD:** PostgreSQL 15 | **ORM:** SQLAlchemy 2.0 (Mapped + type-annotated) | **Migrações:** Alembic

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Tecnologias e Configuração](#2-tecnologias-e-configuração)
3. [Arquitetura do Schema](#3-arquitetura-do-schema)
4. [Padrão SyncBase — Local-First](#4-padrão-syncbase--local-first)
5. [Tabelas — Módulo de Usuários](#5-tabelas--módulo-de-usuários)
6. [Tabelas — Módulo de Hábitos e Metas](#6-tabelas--módulo-de-hábitos-e-metas)
7. [Tabelas — Módulo de Treinos](#7-tabelas--módulo-de-treinos)
8. [Tabelas — Módulo de Nutrição e Inventário](#8-tabelas--módulo-de-nutrição-e-inventário)
9. [Tabelas — Módulo Social](#9-tabelas--módulo-social)
10. [Histórico de Migrações (Alembic)](#10-histórico-de-migrações-alembic)
11. [Índices e Performance](#11-índices-e-performance)
12. [Integridade e Constraints](#12-integridade-e-constraints)
13. [Estratégia de IDs](#13-estratégia-de-ids)
14. [Soft Delete](#14-soft-delete)
15. [Diagrama Entidade-Relacionamento](#15-diagrama-entidade-relacionamento)
16. [Conexão e Sessão Assíncrona](#16-conexão-e-sessão-assíncrona)
17. [Decisões de Design](#17-decisões-de-design)

---

## 1. Visão Geral

O banco de dados do LifeQuest é um **PostgreSQL 15** que serve como o espelho na nuvem do IndexedDB local do usuário. Ele **não** é a fonte primária de dados (isso é o navegador do usuário), mas sim o repositório de backup, sincronização multi-dispositivo e base para features sociais (ranking, amizades).

### Filosofia do Schema

- **Local-First:** os dados pertencem ao usuário. O banco é uma cópia sincronizada, não a original.
- **Soft Delete:** registros nunca são apagados fisicamente — apenas marcados como `deleted = true`
- **Chaves compostas:** `(id, user_id)` como PK em todas as tabelas sincronizáveis evita colisões multi-tenant
- **UUIDs gerados no cliente:** o frontend gera os IDs, garantindo unicidade sem depender do banco

---

## 2. Tecnologias e Configuração

| Componente | Valor |
|---|---|
| **SGBD** | PostgreSQL 15 (alpine no Docker) |
| **ORM** | SQLAlchemy 2.0 — API Mapped + type-annotated |
| **Driver** | `asyncpg` (driver async nativo PostgreSQL) |
| **Migrações** | Alembic 1.13.3 |
| **Pool** | Pool padrão do SQLAlchemy async |

### String de Conexão

```
postgresql+asyncpg://lifequest_user:lifequest_password@localhost:5432/lifequest_db
```

Em produção (Railway), a URL é injetada via variável de ambiente `DATABASE_URL`.

---

## 3. Arquitetura do Schema

O banco possui **16 tabelas** organizadas em 5 módulos funcionais:

```
lifequest_db
├── 📁 Usuários
│   └── users
│
├── 📁 Hábitos e Metas
│   ├── habits
│   ├── habit_completions
│   ├── goals
│   └── daily_quests
│
├── 📁 Treinos (Academia)
│   ├── exercises
│   ├── workout_plans
│   ├── workout_plan_exercises
│   ├── workout_sessions
│   └── session_sets
│
├── 📁 Nutrição e Inventário
│   ├── pantry_items
│   ├── body_measurements
│   ├── inventory
│   └── unlocked_achievements
│
└── 📁 Social
    └── friendships
```

---

## 4. Padrão SyncBase — Local-First

**Arquivo:** [`infra/models/sync_models.py`](file:///home/leandro/dev/pessoais/lifequest/backend/app/infra/models/sync_models.py)

Todas as tabelas sincronizáveis herdam de `SyncBase`, uma classe abstrata que garante os campos necessários para o protocolo Local-First:

```python
class SyncBase(Base):
    __abstract__ = True

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"),
                                          primary_key=True, index=True)
    deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc)...)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=..., onupdate=...)
```

### Campos Herdados por Todas as Tabelas Sync

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | `VARCHAR` (PK) | UUID gerado pelo cliente (crypto.randomUUID) |
| `user_id` | `UUID` (PK, FK → users) | Proprietário do registro |
| `deleted` | `BOOLEAN` | Flag de soft delete |
| `created_at` | `DATETIME` | Data de criação (sem timezone) |
| `updated_at` | `DATETIME` | Data da última modificação |

### Chave Primária Composta `(id, user_id)`

A PK composta é uma **defesa em profundidade** contra colisões multi-tenant:

- Registros antigos (com IDs numéricos sequenciais 1, 2, 3...) de usuários diferentes poderiam colidir se o `id` fosse a única PK
- Com `(id, user_id)`, dois usuários podem ter o mesmo `id` sem colisão
- Na prática, os IDs novos são UUIDs e nunca colidem — a PK composta é a camada extra de segurança

---

## 5. Tabelas — Módulo de Usuários

### `users`

**Arquivo:** [`infra/models/user_model.py`](file:///home/leandro/dev/pessoais/lifequest/backend/app/infra/models/user_model.py)

Armazena os dados de conta, gamificação e assinatura de cada usuário.

| Coluna | Tipo | Nullable | Padrão | Descrição |
|---|---|---|---|---|
| `id` | `UUID` (PK) | ❌ | `uuid4()` | Identificador único do usuário |
| `email` | `VARCHAR` (UNIQUE) | ❌ | — | E-mail de login |
| `username` | `VARCHAR` (UNIQUE) | ❌ | — | Nome de exibição único |
| `hashed_password` | `VARCHAR` | ✅ | `null` | Hash bcrypt (null para login Google) |
| `level` | `INTEGER` | ❌ | `1` | Nível de gamificação |
| `xp` | `INTEGER` | ❌ | `0` | XP acumulado no nível atual |
| `coins` | `INTEGER` | ❌ | `0` | Moedas comuns |
| `pro_coins` | `INTEGER` | ❌ | `0` | Moedas premium (PRO) |
| `streak_days` | `INTEGER` | ❌ | `0` | Sequência de dias ativos |
| `avatar` | `VARCHAR` | ✅ | `null` | URL ou base64 do avatar |
| `last_active_date` | `DATETIME` | ✅ | `null` | Último acesso |
| `ranking_visible` | `BOOLEAN` | ✅ | `null` | Aparece no ranking global |
| `is_pro` | `BOOLEAN` | ❌ | `false` | Status PRO ativo |
| `pro_expires_at` | `DATETIME` | ✅ | `null` | Expiração do PRO (null = vitalício) |
| `created_at` | `DATETIME` | ❌ | `now()` | Data de criação da conta |
| `updated_at` | `DATETIME` | ❌ | `now()` | Última atualização |

**Índices:** `email` (UNIQUE), `username` (UNIQUE)

---

## 6. Tabelas — Módulo de Hábitos e Metas

### `habits`

Hábitos criados pelo usuário, com recorrência diária ou semanal.

| Coluna | Tipo | Nullable | Descrição |
|---|---|---|---|
| `id` | `VARCHAR` (PK) | ❌ | UUID do cliente |
| `user_id` | `UUID` (PK, FK) | ❌ | Proprietário |
| `title` | `VARCHAR` | ❌ | Nome do hábito |
| `icon` | `VARCHAR` | ✅ | Emoji ou código de ícone |
| `cadence` | `VARCHAR` | ❌ | `'daily'` ou `'weekly'` |
| `weekly_target` | `INTEGER` | ✅ | Meta semanal (ex: 3× por semana) |
| `xp_reward` | `INTEGER` | ❌ | `0` | XP ao completar |
| `archived_at` | `VARCHAR` | ✅ | Data de arquivamento (ISO string) |
| `deleted` | `BOOLEAN` | ❌ | Soft delete |
| `created_at` / `updated_at` | `DATETIME` | ❌ | Auditoria |

---

### `habit_completions`

Registros de cada vez que um hábito foi completado em um dia.

| Coluna | Tipo | Nullable | Descrição |
|---|---|---|---|
| `id` | `VARCHAR` (PK) | ❌ | UUID do cliente |
| `user_id` | `UUID` (PK, FK) | ❌ | Proprietário |
| `habit_id` | `VARCHAR` (INDEX) | ❌ | FK implícita para `habits.id` |
| `date` | `VARCHAR` | ❌ | Data no formato `YYYY-MM-DD` |
| `deleted` / `created_at` / `updated_at` | — | — | Padrão SyncBase |

> **Nota:** `habit_id` é uma string (não FK formal) para permitir que completions de hábitos deletados (soft delete) permaneçam no banco sem violar constraints.

---

### `goals`

Metas com progresso numérico e prazo.

| Coluna | Tipo | Nullable | Descrição |
|---|---|---|---|
| `id` | `VARCHAR` (PK) | ❌ | UUID do cliente |
| `user_id` | `UUID` (PK, FK) | ❌ | Proprietário |
| `title` | `VARCHAR` | ❌ | Descrição da meta |
| `target_value` | `FLOAT` | ❌ | Valor alvo numérico |
| `current_value` | `FLOAT` | ❌ | `0.0` | Progresso atual |
| `unit` | `VARCHAR` | ❌ | Unidade (kg, km, dias, etc.) |
| `reward` | `VARCHAR` | ✅ | Recompensa definida pelo usuário |
| `xp_reward` | `INTEGER` | ❌ | XP ao atingir a meta |
| `deadline` | `VARCHAR` | ❌ | Data limite `YYYY-MM-DD` |
| `achieved_at` | `VARCHAR` | ✅ | Data de conquista (ou null) |
| `is_epic` | `BOOLEAN` | ❌ | `false` | Meta épica (gerada por IA) |
| Padrão SyncBase | — | — | — |

---

### `daily_quests`

Missões diárias gamificadas geradas por IA para o jogador.

| Coluna | Tipo | Nullable | Descrição |
|---|---|---|---|
| `id` | `VARCHAR` (PK) | ❌ | UUID do cliente |
| `user_id` | `UUID` (PK, FK) | ❌ | Proprietário |
| `date` | `VARCHAR` (INDEX) | ❌ | Data da missão `YYYY-MM-DD` |
| `pillar` | `VARCHAR` | ❌ | Pilar temático (saúde, lar, foco, social) |
| `title` | `VARCHAR` | ❌ | Título da missão |
| `description` | `VARCHAR` | ✅ | Descrição detalhada |
| `xp_reward` | `INTEGER` | ❌ | `0` | XP de recompensa |
| `completed` | `BOOLEAN` | ❌ | `false` | Status de conclusão |
| Padrão SyncBase | — | — | — |

---

## 7. Tabelas — Módulo de Treinos

### `exercises`

Catálogo de exercícios do usuário.

| Coluna | Tipo | Nullable | Descrição |
|---|---|---|---|
| `id` | `VARCHAR` (PK) | ❌ | UUID do cliente |
| `user_id` | `UUID` (PK, FK) | ❌ | Proprietário |
| `name` | `VARCHAR` | ❌ | Nome do exercício |
| `muscle_group` | `VARCHAR` | ✅ | Grupo muscular (Peito, Costas...) |
| `equipment` | `VARCHAR` | ✅ | Equipamento (Barra, Haltere, Máquina...) |
| Padrão SyncBase | — | — | — |

---

### `workout_plans`

Fichas de treino (ex: "Treino A — Peito e Tríceps").

| Coluna | Tipo | Nullable | Descrição |
|---|---|---|---|
| `id` | `VARCHAR` (PK) | ❌ | UUID do cliente |
| `user_id` | `UUID` (PK, FK) | ❌ | Proprietário |
| `name` | `VARCHAR` | ❌ | Nome da ficha |
| `weekday` | `VARCHAR` | ✅ | Array JSON de dias (ex: `["seg","qua"]`) |
| `estimated_duration` | `INTEGER` | ✅ | Duração estimada em minutos |
| Padrão SyncBase | — | — | — |

---

### `workout_plan_exercises`

Vínculo entre fichas e exercícios, com configuração de séries/repetições.

| Coluna | Tipo | Nullable | Descrição |
|---|---|---|---|
| `id` | `VARCHAR` (PK) | ❌ | UUID do cliente |
| `user_id` | `UUID` (PK, FK) | ❌ | Proprietário |
| `workout_plan_id` | `VARCHAR` (INDEX) | ❌ | FK implícita → `workout_plans.id` |
| `exercise_id` | `VARCHAR` (INDEX) | ❌ | FK implícita → `exercises.id` |
| `order` | `INTEGER` | ❌ | `0` | Ordem de exibição na ficha |
| `target_sets` | `INTEGER` | ❌ | `3` | Número de séries prescritas |
| `target_reps` | `VARCHAR` | ✅ | Repetições prescritas (ex: `"8-12"`) |
| `rest_seconds` | `INTEGER` | ❌ | `60` | Descanso entre séries (segundos) |
| Padrão SyncBase | — | — | — |

---

### `workout_sessions`

Registro de cada sessão de treino executada.

| Coluna | Tipo | Nullable | Descrição |
|---|---|---|---|
| `id` | `VARCHAR` (PK) | ❌ | UUID do cliente |
| `user_id` | `UUID` (PK, FK) | ❌ | Proprietário |
| `workout_plan_id` | `VARCHAR` (INDEX) | ✅ | Ficha usada (null = treino livre) |
| `started_at` | `VARCHAR` | ❌ | ISO datetime de início |
| `finished_at` | `VARCHAR` | ✅ | ISO datetime de término |
| `is_rest_day` | `BOOLEAN` | ❌ | `false` | Marca o registro como dia de descanso |
| Padrão SyncBase | — | — | — |

---

### `session_sets`

Cada série individual executada dentro de uma sessão de treino.

| Coluna | Tipo | Nullable | Descrição |
|---|---|---|---|
| `id` | `VARCHAR` (PK) | ❌ | UUID do cliente |
| `user_id` | `UUID` (PK, FK) | ❌ | Proprietário |
| `workout_session_id` | `VARCHAR` (INDEX) | ❌ | FK implícita → `workout_sessions.id` |
| `workout_plan_exercise_id` | `VARCHAR` (INDEX) | ❌ | FK implícita → `workout_plan_exercises.id` |
| `exercise_id` | `VARCHAR` (INDEX) | ❌ | FK estável → `exercises.id` (sobrevive ao delete do plano) |
| `set_number` | `INTEGER` | ❌ | Número da série (1, 2, 3...) |
| `weight_kg` | `FLOAT` | ✅ | Carga utilizada em kg |
| `reps_done` | `INTEGER` | ✅ | Repetições realizadas |
| `completed_at` | `VARCHAR` | ✅ | ISO datetime de conclusão da série |
| Padrão SyncBase | — | — | — |

> **Design key:** `exercise_id` é armazenado diretamente na série para que o histórico de desempenho sobreviva mesmo se a ficha (`workout_plan`) for deletada depois.

---

## 8. Tabelas — Módulo de Nutrição e Inventário

### `pantry_items`

Itens da despensa do usuário.

| Coluna | Tipo | Nullable | Descrição |
|---|---|---|---|
| `id` | `VARCHAR` (PK) | ❌ | UUID do cliente |
| `user_id` | `UUID` (PK, FK) | ❌ | Proprietário |
| `name` | `VARCHAR` | ❌ | Nome do item |
| `category` | `VARCHAR` | ✅ | Categoria (proteínas, carboidratos...) |
| `quantity` | `VARCHAR` | ✅ | Quantidade (ex: "500g", "1 unidade") |
| Padrão SyncBase | — | — | — |

---

### `body_measurements`

Medidas corporais e perimetria ao longo do tempo.

| Coluna | Tipo | Nullable | Descrição |
|---|---|---|---|
| `id` | `VARCHAR` (PK) | ❌ | UUID do cliente |
| `user_id` | `UUID` (PK, FK) | ❌ | Proprietário |
| `date` | `VARCHAR` (INDEX) | ❌ | Data da medição `YYYY-MM-DD` |
| `age` | `INTEGER` | ✅ | Idade |
| `weight` | `FLOAT` | ✅ | Peso (kg) |
| `height` | `FLOAT` | ✅ | Altura (cm) |
| `shoulder` | `FLOAT` | ✅ | Ombro (cm) |
| `chest` | `FLOAT` | ✅ | Peito (cm) |
| `abdomen` | `FLOAT` | ✅ | Abdômen (cm) |
| `thigh` | `FLOAT` | ✅ | Coxa (cm) |
| `calf` | `FLOAT` | ✅ | Panturrilha (cm) |
| `arm_left` | `FLOAT` | ✅ | Braço esquerdo (cm) |
| `arm_right` | `FLOAT` | ✅ | Braço direito (cm) |
| `forearm` | `FLOAT` | ✅ | Antebraço (cm) |
| `body_fat_percent` | `FLOAT` | ✅ | % de gordura corporal |
| Padrão SyncBase | — | — | — |

---

### `inventory`

Itens adquiridos pelo usuário na Loja do jogo (temas, avatares, etc).

| Coluna | Tipo | Nullable | Descrição |
|---|---|---|---|
| `id` | `VARCHAR` (PK) | ❌ | UUID do cliente |
| `user_id` | `UUID` (PK, FK) | ❌ | Proprietário |
| `item_id` | `VARCHAR` | ❌ | ID do item no catálogo da loja |
| `category` | `VARCHAR` | ❌ | Categoria do item (tema, avatar, poção) |
| `name` | `VARCHAR` | ❌ | Nome de exibição do item |
| `purchased_at` | `VARCHAR` | ❌ | ISO datetime da compra |
| Padrão SyncBase | — | — | — |

---

### `unlocked_achievements`

Conquistas desbloqueadas pelo usuário.

| Coluna | Tipo | Nullable | Descrição |
|---|---|---|---|
| `id` | `VARCHAR` (PK) | ❌ | UUID do cliente |
| `user_id` | `UUID` (PK, FK) | ❌ | Proprietário |
| `achievement_id` | `VARCHAR` | ❌ | ID da conquista no catálogo |
| `unlocked_at` | `VARCHAR` | ❌ | ISO datetime do desbloqueio |
| Padrão SyncBase | — | — | — |

---

## 9. Tabelas — Módulo Social

### `friendships`

Relacionamentos de amizade entre usuários. Não herda de `SyncBase` (gerenciada exclusivamente pelo backend, não sincronizada via fila local).

| Coluna | Tipo | Nullable | Padrão | Descrição |
|---|---|---|---|---|
| `id` | `UUID` (PK) | ❌ | `uuid4()` | ID da amizade |
| `requester_id` | `UUID` (INDEX, FK → users) | ❌ | — | Usuário que enviou a solicitação |
| `addressee_id` | `UUID` (INDEX, FK → users) | ❌ | — | Usuário que recebeu a solicitação |
| `status` | `VARCHAR(20)` | ❌ | `'pending'` | `pending` \| `accepted` \| `blocked` |
| `created_at` | `DATETIME` | ❌ | `now()` | Data da solicitação |
| `updated_at` | `DATETIME` | ❌ | `now()` | Última atualização |

**Constraints:**

```sql
UNIQUE ("requester_id", "addressee_id")  -- uq_friendship_pair
CHECK  ("requester_id" <> "addressee_id") -- ck_no_self_friendship
```

> A amizade é **direcional no banco** (requester → addressee), mas as queries de amigos aceitos buscam nas **duas direções** com `OR`.

---

## 10. Histórico de Migrações (Alembic)

O schema evoluiu com **14 migrations**, cada uma representando uma entrega de feature:

| Arquivo | Descrição |
|---|---|
| `8c8182915226_create_users_table.py` | Criação inicial da tabela `users` |
| `a3f1d02b8e91_add_gamification_fields_to_users.py` | Adiciona `level`, `xp`, `streak_days`, `coins` |
| `5e95a34d30ff_add_avatar_to_user.py` | Adiciona `avatar` |
| `a063b6f03f67_add_gamification_and_perimetria_fields.py` | Campos adicionais de gamificação e perimetria |
| `0a9d79de4556_add_sync_models_for_local_first.py` | Criação de todas as tabelas de sync (habits, goals, workouts...) — **maior migration** |
| `ab3be94ca329_composite_pk_sync_tables.py` | Converte PKs simples para PKs compostas `(id, user_id)` |
| `c1b2d3e4f5a6_add_updated_at_to_users.py` | Adiciona `updated_at` à tabela `users` |
| `52d67f2e800c_add_friendships_table.py` | Criação da tabela `friendships` |
| `0ab8ec596729_add_pro_subscription_fields.py` | Adiciona `is_pro`, `pro_expires_at` |
| `1976f3a47d31_add_pro_coins_to_users.py` | Adiciona `pro_coins` |
| `bc998a2200b3_add_is_epic_to_goals.py` | Adiciona `is_epic` à tabela `goals` |
| `456369faa9f4_float_epic_quests.py` | Converte `target_value` de `goals` para `FLOAT` |
| `13be4525722f_add_ranking_visible_to_users.py` | Adiciona `ranking_visible` |
| `c65f4cd3d575_add_is_rest_day_to_workout_sessions.py` | Adiciona `is_rest_day` à `workout_sessions` |

### Executar Migrações

```bash
# Aplicar todas as migrações pendentes
alembic upgrade head

# Ver histórico
alembic history --verbose

# Criar nova migração automática
alembic revision --autogenerate -m "descricao_da_mudanca"

# Reverter 1 migration
alembic downgrade -1
```

---

## 11. Índices e Performance

### Índices Existentes

| Tabela | Coluna(s) | Tipo |
|---|---|---|
| `users` | `email` | UNIQUE INDEX |
| `users` | `username` | UNIQUE INDEX |
| Todas as SyncBase | `user_id` | INDEX |
| `habit_completions` | `habit_id` | INDEX |
| `daily_quests` | `date` | INDEX |
| `exercises` | — | — |
| `workout_plan_exercises` | `workout_plan_id`, `exercise_id` | INDEX |
| `workout_sessions` | `workout_plan_id` | INDEX |
| `session_sets` | `workout_session_id`, `workout_plan_exercise_id`, `exercise_id` | INDEX |
| `body_measurements` | `date` | INDEX |
| `friendships` | `requester_id`, `addressee_id` | INDEX |

### Query Hot Paths

1. **Sync Pull** — `WHERE user_id = ? AND updated_at > ?` em todas as tabelas sync → `user_id` indexado
2. **Ranking global** — `ORDER BY level DESC, xp DESC, streak_days DESC LIMIT 100` → considerar índice composto em produção
3. **Busca de usuários** — `WHERE username ILIKE '%q%'` → candidato a índice GIN/trigram em escala

---

## 12. Integridade e Constraints

### Constraints Declaradas

| Tabela | Constraint | Tipo | Regra |
|---|---|---|---|
| `users` | `email` | UNIQUE | Um e-mail por conta |
| `users` | `username` | UNIQUE | Um username por conta |
| `friendships` | `uq_friendship_pair` | UNIQUE | Par `(requester, addressee)` único |
| `friendships` | `ck_no_self_friendship` | CHECK | `requester_id <> addressee_id` |
| Todas SyncBase | PK composta | PRIMARY KEY | `(id, user_id)` único por par |

### Integridade Referencial

As FK implícitas (como `habit_id` em `habit_completions`) são intencionalmente **sem FOREIGN KEY formal** para:
1. Permitir que completions de hábitos soft-deletados continuem existindo
2. Evitar cascatas acidentais durante o sync

---

## 13. Estratégia de IDs

O sistema adota **dois tipos de chaves primárias** dependendo do contexto:

### Tabelas Sync (`SyncBase`)

```
id: VARCHAR (UUID gerado pelo cliente com crypto.randomUUID())
```

- O cliente gera o UUID antes mesmo de salvar no IndexedDB
- O mesmo UUID é usado no banco (sem geração server-side)
- Elimina round-trips para obter IDs
- Funciona offline sem risco de conflito

### Tabelas Backend-Only

```
id: UUID (gerado pelo servidor com uuid4())
```

- `users.id` — gerado no momento do registro
- `friendships.id` — gerado no momento da criação da amizade

---

## 14. Soft Delete

O soft delete é implementado via campo `deleted` (Boolean) em todas as tabelas SyncBase.

### Fluxo

```
Usuário deleta item
        │
        ▼
Frontend: enqueue("delete", entity, entityId)
        │
        ▼
Sync Push: POST /sync/push
        │
        ▼
Backend: UPDATE tabela SET deleted=true, updated_at=now()
         WHERE id=? AND user_id=?
        │
        ▼
Sync Pull (próximo ciclo):
  → Retorna registros com deleted=true
  → Frontend deleta do IndexedDB local
```

### Por Que Soft Delete?

1. **Rastreabilidade:** histórico de dados preservado para auditoria
2. **Sincronização bidirecional:** o `pull` pode propagar deletes para múltiplos dispositivos
3. **Segurança:** recuperação de dados em caso de delete acidental (via query direta ao banco)
4. **Consistência:** garante que o device B saiba que o device A deletou um item, mesmo se o B estiver offline

---

## 15. Diagrama Entidade-Relacionamento

```
┌─────────────────┐
│     USERS        │
│─────────────────│
│ id (UUID, PK)    │◄──────────────────────────────────┐
│ email (UNIQUE)   │                                   │
│ username (UNIQUE)│                                   │ user_id (FK)
│ level, xp, coins │                                   │
│ is_pro, streak   │              ┌────────────────────┤
└─────────────────┘              │                    │
                                 │                    │
         ┌───────────────────────┼────────────────────┼────────────────────────┐
         │                       │                    │                        │
         ▼                       ▼                    ▼                        ▼
┌──────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌───────────────────┐
│   HABITS      │    │    EXERCISES    │    │  PANTRY_ITEMS   │    │  BODY_MEASUREMENTS│
│ + SyncBase   │    │  + SyncBase    │    │  + SyncBase    │    │   + SyncBase       │
└──────┬───────┘    └───────┬─────────┘    └─────────────────┘    └───────────────────┘
       │                    │
       ▼                    ▼
┌──────────────┐    ┌─────────────────────┐
│ HABIT_       │    │  WORKOUT_PLANS      │
│ COMPLETIONS  │    │  + SyncBase        │
│ + SyncBase   │    └──────────┬──────────┘
└──────────────┘               │
                               ▼
                    ┌───────────────────────┐
                    │ WORKOUT_PLAN_EXERCISES│
                    │ + SyncBase           │◄── exercise_id
                    └──────────┬────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  WORKOUT_SESSIONS   │
                    │  + SyncBase        │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   SESSION_SETS      │◄── exercise_id (estável)
                    │   + SyncBase       │◄── workout_plan_exercise_id
                    └─────────────────────┘


GOALS       + SyncBase (is_epic)
DAILY_QUESTS + SyncBase
INVENTORY    + SyncBase
UNLOCKED_ACHIEVEMENTS + SyncBase


FRIENDSHIPS (backend-only, sem SyncBase):
  requester_id → USERS.id
  addressee_id → USERS.id
  UNIQUE(requester_id, addressee_id)
  CHECK(requester_id <> addressee_id)
```

---

## 16. Conexão e Sessão Assíncrona

**Arquivo:** `infra/database.py`

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

engine = create_async_engine(settings.database_url, echo=False)
async_session_maker = async_sessionmaker(engine, expire_on_commit=False)

async def get_db_session() -> AsyncSession:
    async with async_session_maker() as session:
        async with session.begin():
            yield session
        # commit automático ao sair do bloco sem exceção
        # rollback automático em caso de exceção
```

O gerenciador de contexto `session.begin()` garante:
- **Commit** implícito ao final de cada request bem-sucedido
- **Rollback** implícito em caso de qualquer exceção não tratada

---

## 17. Decisões de Design

### Por que `VARCHAR` para `id` nas tabelas sync (e não `UUID`)?

O frontend usa `crypto.randomUUID()` que retorna uma string. Versões antigas do app tinham IDs numéricos (Dexie `++id`). Usar `VARCHAR` permite aceitar ambos os formatos sem conversão.

### Por que datas como `VARCHAR` (ISO string) e não `DATE`?

Os campos `date` em `habit_completions`, `daily_quests` e `body_measurements` são armazenados como `YYYY-MM-DD` (string). Razão: evitar conversão de timezone entre cliente (local) e servidor (UTC). A data do hábito pertence ao calendário local do usuário, não ao UTC do servidor.

### Por que `created_at`/`updated_at` sem tzinfo?

SQLAlchemy + asyncpg têm comportamento inconsistente com `TIMESTAMP WITH TIME ZONE` e datetimes `aware`. Todos os datetimes são armazenados como UTC sem tzinfo (naive), e o código sempre usa `datetime.now(timezone.utc).replace(tzinfo=None)` para consistência.

### Por que não usar FKs formais entre tabelas sync?

As tabelas sync do mesmo usuário se referenciam (ex: `habit_completions.habit_id` → `habits.id`), mas sem FK formal. Razões:
1. Soft delete: o referenciado pode estar `deleted=true` e a referência ainda deve existir
2. Ordem de sync: eventos podem chegar fora de ordem (o filho antes do pai)
3. Flexibilidade: facilita migrações de schema sem cascade de constraints

---

*Documentação gerada em 30/09/2026 com base no estado atual do código-fonte.*
