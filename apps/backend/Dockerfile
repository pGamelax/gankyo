FROM oven/bun:1-alpine AS deps

WORKDIR /app

# Copia os manifestos do monorepo e do backend para resolver dependências
COPY package.json bun.lock* bun.lockb* ./
COPY apps/backend/package.json ./apps/backend/

# Instala TODAS as deps (incluindo devDeps — necessário para drizzle-kit push)
RUN bun install --frozen-lockfile

# ─── Runtime ──────────────────────────────────────────────────────────────────
FROM oven/bun:1-alpine

WORKDIR /app

# Copia node_modules instalados
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules

# Copia o código do backend e o root package.json
COPY package.json ./
COPY apps/backend ./apps/backend

# Entrypoint: aplica schema no banco, depois inicia o servidor
COPY apps/backend/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

ENV NODE_ENV=production
EXPOSE 3001

ENTRYPOINT ["./entrypoint.sh"]
