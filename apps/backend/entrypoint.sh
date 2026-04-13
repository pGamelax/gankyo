#!/bin/sh
set -e

echo "[Gankyo] Aplicando schema no banco (drizzle-kit push)..."
bun run db:push

echo "[Gankyo] Iniciando servidor na porta ${PORT:-3001}..."
exec bun src/index.ts
