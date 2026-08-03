#!/usr/bin/env bash
# ==============================================================================
# test_sync_manual.sh — Testa manualmente os endpoints de sync do LifeQuest
# Uso: ./scripts/test_sync_manual.sh [local|prod]
# ==============================================================================
set -euo pipefail

ENV=${1:-local}

if [ "$ENV" = "prod" ]; then
  BASE_URL="https://lifequest-production-adfd.up.railway.app"
else
  BASE_URL="http://localhost:8000"
fi

echo "========================================"
echo " LifeQuest Sync — Teste Manual ($ENV)"
echo " Base URL: $BASE_URL"
echo "========================================"

# --- 1. Health Check ---
echo ""
echo "▶ [1/5] Health check..."
curl -s "$BASE_URL/health" | python3 -m json.tool || echo "❌ Falhou"

# --- 2. Login ---
echo ""
echo "▶ [2/5] Login (pega o token JWT)..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "leandro@lifequest.app", "password": "sua_senha_aqui"}')

echo "$LOGIN_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$LOGIN_RESPONSE"

TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('access_token',''))" 2>/dev/null || echo "")

if [ -z "$TOKEN" ]; then
  echo ""
  echo "⚠️  Token não obtido. Defina TOKEN manualmente:"
  echo "   export TOKEN='seu_jwt_aqui'"
  echo "   e re-execute os passos 3-5 manualmente."
  TOKEN="${TOKEN:-}"
fi

# --- 3. Push: cria um hábito de teste ---
echo ""
echo "▶ [3/5] Push — cria hábito de teste no backend..."
HABIT_ID="test-habit-$(date +%s)"
PUSH_PAYLOAD=$(cat <<EOF
{
  "events": [
    {
      "id": 1,
      "entity": "habits",
      "entityId": "$HABIT_ID",
      "action": "upsert",
      "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)",
      "payload": {
        "id": "$HABIT_ID",
        "title": "Hábito de Teste Manual",
        "icon": "🧪",
        "cadence": "daily",
        "weeklyTarget": 5,
        "xpReward": 10
      }
    }
  ]
}
EOF
)

echo "Payload enviado:"
echo "$PUSH_PAYLOAD" | python3 -m json.tool

PUSH_RESPONSE=$(curl -s -X POST "$BASE_URL/sync/push" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$PUSH_PAYLOAD")

echo ""
echo "Resposta do push:"
echo "$PUSH_RESPONSE" | python3 -m json.tool || echo "$PUSH_RESPONSE"

# --- 4. Pull: busca mudanças ---
echo ""
echo "▶ [4/5] Pull — busca dados do backend (last_sync=epoch)..."
PULL_RESPONSE=$(curl -s -G "$BASE_URL/sync/pull" \
  --data-urlencode "last_sync=1970-01-01T00:00:00.000Z" \
  -H "Authorization: Bearer $TOKEN")

echo "Resposta do pull:"
echo "$PULL_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$PULL_RESPONSE"

# --- 5. Pull: testa o timestamp com duplo sufixo (o bug) ---
echo ""
echo "▶ [5/5] Pull — testa timestamp com '+00:00Z' (o bug reportado)..."
BUGGY_TS="2026-07-28T19:15:15.678403+00:00Z"
BUG_RESPONSE=$(curl -s -G "$BASE_URL/sync/pull" \
  --data-urlencode "last_sync=$BUGGY_TS" \
  -H "Authorization: Bearer $TOKEN" \
  -w "\nHTTP Status: %{http_code}")

echo "Resposta (deve retornar 200, não 500):"
echo "$BUG_RESPONSE"

echo ""
echo "========================================"
echo " Teste concluído!"
echo "========================================"
