FROM oven/bun:1-alpine AS deps

WORKDIR /app

# Copia só o package.json do backend (context = apps/backend/)
COPY package.json ./
RUN bun install

# ─── Runtime ──────────────────────────────────────────────────────────────────
FROM oven/bun:1-alpine

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

COPY package.json ./
COPY tsconfig.json ./
COPY drizzle.config.ts ./
COPY src ./src
COPY entrypoint.sh ./

RUN chmod +x ./entrypoint.sh

ENV NODE_ENV=production
EXPOSE 3001

ENTRYPOINT ["./entrypoint.sh"]
