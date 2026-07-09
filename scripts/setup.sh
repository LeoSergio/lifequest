#!/usr/bin/env bash
# Bootstrap do ambiente de desenvolvimento do LifeQuest.
# Uso: ./scripts/setup.sh
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Configurando frontend"
cd "$ROOT_DIR/frontend"
[ -f .env ] || cp .env.example .env
npm install

echo "==> Configurando backend"
cd "$ROOT_DIR/backend"
[ -f .env ] || cp .env.example .env
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
deactivate

echo "==> Configurando guildas"
cd "$ROOT_DIR/guildas"
[ -f .env ] || cp .env.example .env
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
deactivate

cat <<'EOF'

Ambiente pronto. Preencha as chaves de API nos arquivos .env:
  - backend/.env   (GROQ_API_KEY, GEMINI_API_KEY)
  - guildas/.env   (UPSTASH_REDIS_URL, UPSTASH_REDIS_TOKEN)

Para rodar em dev, em 3 terminais separados:
  1) cd frontend && npm run dev
  2) cd backend  && source .venv/bin/activate && uvicorn app.main:app --reload
  3) cd guildas  && source .venv/bin/activate && uvicorn app.main:app --reload --port 8001

Ou, para backend + guildas via Docker:
  docker compose up --build
EOF
