#!/bin/sh
set -e

echo "[Gankyo] Aguardando banco de dados em: $DATABASE_URL"

until bun -e "
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });
p.query('SELECT 1').then(() => { p.end(); process.exit(0); }).catch(() => process.exit(1));
" 2>/dev/null; do
  echo "[Gankyo] Banco ainda não disponível, tentando novamente em 2s..."
  sleep 2
done

echo "[Gankyo] Banco disponível. Aplicando schema (drizzle-kit push)..."
cd /app/apps/backend && bun run db:push

echo "[Gankyo] Iniciando servidor na porta ${PORT:-3001}..."
exec bun /app/apps/backend/src/index.ts
