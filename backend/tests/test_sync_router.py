import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


async def _register_and_login(client: AsyncClient) -> str:
    """Cria um usuário novo (email único por execução) e retorna o token."""
    email = f"sync-test-{uuid.uuid4().hex[:10]}@example.com"
    password = "senha-super-forte-123"

    res = await client.post("/auth/register", json={
        "name": "Teste Sync",
        "email": email,
        "password": password,
    })
    assert res.status_code == 200, res.text

    res = await client.post("/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


@pytest.mark.asyncio
async def test_push_with_one_bad_event_does_not_block_the_rest():
    """
    Regressão do bug: antes, um evento inválido no meio do lote (entidade
    desconhecida, payload ausente, etc.) derrubava a transação inteira e
    NENHUM evento do lote era salvo — nem os válidos. Agora cada evento
    roda em sua própria SAVEPOINT, então só o evento ruim falha.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        token = await _register_and_login(client)
        headers = {"Authorization": f"Bearer {token}"}

        good_id = str(uuid.uuid4())
        events = [
            {
                "id": 1,
                "entity": "habits",
                "entityId": good_id,
                "action": "upsert",
                "timestamp": "2026-07-27T00:00:00.000Z",
                "payload": {
                    "id": good_id,
                    "title": "Beber água",
                    "icon": "💧",
                    "cadence": "daily",
                    "xpReward": 10,
                },
            },
            {
                "id": 2,
                "entity": "tabela_que_nao_existe",
                "entityId": "qualquer-coisa",
                "action": "upsert",
                "timestamp": "2026-07-27T00:00:01.000Z",
                "payload": {"foo": "bar"},
            },
        ]

        res = await client.post("/sync/push", json={"events": events}, headers=headers)
        assert res.status_code == 200, res.text
        data = res.json()

        # O evento bom foi processado, o ruim falhou e foi reportado — mas
        # não derrubou o lote inteiro.
        assert data["processed_events"] == 1
        assert data["failed_events"] == [2]

        # Confere que o hábito válido realmente foi salvo (sobreviveu ao evento ruim).
        res = await client.get(
            "/sync/pull?last_sync=1970-01-01T00:00:00.000Z", headers=headers
        )
        assert res.status_code == 200, res.text
        changes = res.json()["changes"]
        assert "habits" in changes
        assert any(h["id"] == good_id and h["title"] == "Beber água" for h in changes["habits"])
