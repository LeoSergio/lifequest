#!/bin/bash
set -e

echo "==> Rodando migrations do banco de dados..."
alembic upgrade head

echo "==> Iniciando o servidor..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
