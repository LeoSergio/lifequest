"""
Testes de integração para os endpoints /sync/push e /sync/pull.

Cada teste:
  - Cria um usuário novo (e-mail E username únicos por execução).
  - Executa o cenário de sync via ASGI (sem servidor real).
  - Verifica o comportamento end-to-end: payload → push → Postgres → pull → dados corretos.

Requisitos para rodar localmente:
  - Postgres rodando em localhost:5432 (ou DATABASE_URL apontando para outro host).
  - Tabelas criadas (alembic upgrade head).
  - pytest.ini com asyncio_mode = auto.
"""
import datetime
import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.infra.database import engine


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
async def _fresh_engine_pool():
    """
    pytest-asyncio cria um event loop novo por teste (function scope).
    O engine assíncrono do SQLAlchemy é global e mantém conexões asyncpg
    presas ao event loop anterior. Descartar o pool antes de cada teste
    garante que as conexões sejam abertas no loop correto.
    """
    await engine.dispose()
    yield
    await engine.dispose()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _register_and_login(client: AsyncClient) -> str:
    """
    Cria um usuário com e-mail e username ÚNICOS por chamada e retorna o Bearer token.
    O sufixo UUID evita colisão de username entre testes paralelos ou reexecuções.
    """
    suffix = uuid.uuid4().hex[:10]
    email = f"sync-{suffix}@test.com"
    name = f"sync-{suffix}"    # vira username único via base_username
    password = "senha-super-forte-123"

    res = await client.post("/auth/register", json={
        "name": name,
        "email": email,
        "password": password,
    })
    assert res.status_code == 200, f"register falhou: {res.text}"

    res = await client.post("/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"login falhou: {res.text}"
    return res.json()["access_token"]


def _make_client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


def _habit_event(queue_id: int, entity_id: str, title: str = "Beber água") -> dict:
    return {
        "id": queue_id,
        "entity": "habits",
        "entityId": entity_id,
        "action": "upsert",
        "timestamp": "2026-08-01T00:00:00.000Z",
        "payload": {
            "id": entity_id,
            "title": title,
            "icon": "💧",
            "cadence": "daily",
            "xpReward": 10,
        },
    }


# ---------------------------------------------------------------------------
# Testes
# ---------------------------------------------------------------------------

async def test_push_single_habit_persists_and_appears_in_pull():
    """
    Caminho feliz: 1 evento válido → push → 200 → pull retorna o hábito.
    Este é o Checkpoint 2+4+5 do fluxo de diagnóstico.
    """
    async with _make_client() as client:
        token = await _register_and_login(client)
        headers = {"Authorization": f"Bearer {token}"}
        habit_id = str(uuid.uuid4())

        # Push
        res = await client.post(
            "/sync/push",
            json={"events": [_habit_event(1, habit_id)]},
            headers=headers,
        )
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["processed_events"] == 1, f"Esperado 1 processado: {data}"
        assert data["failed_events"] == [], f"Esperado sem falhas: {data}"

        # Pull — tudo desde o início dos tempos
        res = await client.get(
            "/sync/pull?last_sync=1970-01-01T00:00:00.000Z",
            headers=headers,
        )
        assert res.status_code == 200, res.text
        changes = res.json()["changes"]

        assert "habits" in changes, f"'habits' ausente em changes: {list(changes.keys())}"
        habit = next((h for h in changes["habits"] if h["id"] == habit_id), None)
        assert habit is not None, f"Hábito {habit_id} não encontrado: {changes['habits']}"
        assert habit["title"] == "Beber água"


async def test_push_bad_event_does_not_block_good_events():
    """
    Regressão: um evento inválido no lote derrubava a transação inteira.
    Agora cada evento roda em seu próprio SAVEPOINT — só o ruim falha.
    """
    async with _make_client() as client:
        token = await _register_and_login(client)
        headers = {"Authorization": f"Bearer {token}"}
        good_id = str(uuid.uuid4())

        events = [
            _habit_event(1, good_id, "Evento bom"),
            {
                "id": 2,
                "entity": "entidade_inventada",
                "entityId": "qualquer-coisa",
                "action": "upsert",
                "timestamp": "2026-08-01T00:00:01.000Z",
                "payload": {"foo": "bar"},
            },
        ]

        res = await client.post("/sync/push", json={"events": events}, headers=headers)
        assert res.status_code == 200, res.text
        data = res.json()

        assert data["processed_events"] == 1, f"Esperado 1 processado: {data}"
        assert data["failed_events"] == [2], f"Esperado [2] em failed_events: {data}"

        # O hábito bom deve ter persistido mesmo com o evento ruim no lote
        res = await client.get(
            "/sync/pull?last_sync=1970-01-01T00:00:00.000Z", headers=headers
        )
        assert res.status_code == 200, res.text
        changes = res.json()["changes"]
        assert any(h["id"] == good_id for h in changes.get("habits", [])), \
            f"Hábito válido não persistiu após evento inválido no lote: {changes}"


async def test_pull_with_malformed_timezone_last_sync_returns_200():
    """
    Regressão: last_sync no formato "...+00:00Z" (aware + Z sobrando)
    antes derrubava o pull com TypeError (naive vs aware datetime),
    resultando em 500 sem CORS. Agora deve retornar 200 normalmente.
    """
    async with _make_client() as client:
        token = await _register_and_login(client)
        headers = {"Authorization": f"Bearer {token}"}

        malformed = "2026-07-28T19:35:30.675604+00:00Z"
        res = await client.get(
            f"/sync/pull?last_sync={malformed}", headers=headers
        )
        assert res.status_code == 200, f"Esperado 200, got {res.status_code}: {res.text}"
        body = res.json()
        assert "changes" in body
        assert "timestamp" in body


async def test_upsert_updates_existing_record():
    """
    Garante que enviar o mesmo entityId duas vezes com payload diferente
    atualiza o registro existente (UPDATE) em vez de criar duplicado (INSERT).
    """
    async with _make_client() as client:
        token = await _register_and_login(client)
        headers = {"Authorization": f"Bearer {token}"}
        habit_id = str(uuid.uuid4())

        # 1ª inserção
        await client.post(
            "/sync/push",
            json={"events": [_habit_event(1, habit_id, "Título original")]},
            headers=headers,
        )
        # 2ª inserção — mesmo id, título diferente
        await client.post(
            "/sync/push",
            json={"events": [_habit_event(2, habit_id, "Título atualizado")]},
            headers=headers,
        )

        # Pull deve retornar exatamente 1 registro com o título atualizado
        res = await client.get(
            "/sync/pull?last_sync=1970-01-01T00:00:00.000Z", headers=headers
        )
        habits = res.json()["changes"].get("habits", [])
        matching = [h for h in habits if h["id"] == habit_id]

        assert len(matching) == 1, f"Esperado 1 registro (upsert), encontrou {len(matching)}: {matching}"
        assert matching[0]["title"] == "Título atualizado", \
            f"Título não foi atualizado: {matching[0]}"


async def test_pull_respects_last_sync_timestamp():
    """
    Garante que o filtro por updated_at funciona:
    - Pull com timestamp ANTES do push → retorna o dado.
    - Pull com timestamp FUTURO → não retorna o dado.
    """
    async with _make_client() as client:
        token = await _register_and_login(client)
        headers = {"Authorization": f"Bearer {token}"}
        habit_id = str(uuid.uuid4())

        before_push = datetime.datetime.now(datetime.timezone.utc)

        await client.post(
            "/sync/push",
            json={"events": [_habit_event(1, habit_id)]},
            headers=headers,
        )

        # Pull desde antes do push → deve ver o dado
        res = await client.get(
            f"/sync/pull?last_sync={before_push.isoformat()}",
            headers=headers,
        )
        habits_before = res.json()["changes"].get("habits", [])
        assert any(h["id"] == habit_id for h in habits_before), \
            "Pull com last_sync antes do push DEVE retornar o hábito"

        # Pull com timestamp futuro → NÃO deve ver o dado
        res = await client.get(
            "/sync/pull?last_sync=2099-01-01T00:00:00.000Z",
            headers=headers,
        )
        habits_future = res.json()["changes"].get("habits", [])
        assert not any(h["id"] == habit_id for h in habits_future), \
            "Pull com last_sync futuro NÃO deve retornar hábito antigo"


async def test_push_without_token_returns_401():
    """Sem Authorization header → 401/403, não 500."""
    async with _make_client() as client:
        habit_id = str(uuid.uuid4())
        res = await client.post(
            "/sync/push",
            json={"events": [_habit_event(1, habit_id)]},
        )
        assert res.status_code in (401, 403), \
            f"Esperado 401/403 sem token, got {res.status_code}"
