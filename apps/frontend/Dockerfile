FROM oven/bun:1-alpine AS builder

WORKDIR /app

COPY package.json bun.lock* bun.lockb* ./
COPY apps/frontend/package.json ./apps/frontend/

RUN bun install --frozen-lockfile --filter frontend

COPY apps/frontend ./apps/frontend

ARG VITE_API_URL=http://localhost:3001
ENV VITE_API_URL=$VITE_API_URL

WORKDIR /app/apps/frontend
RUN bun run build

# ─── Caddy ────────────────────────────────────────────────────────────────────
FROM caddy:2-alpine

COPY --from=builder /app/apps/frontend/dist /srv
COPY apps/frontend/Caddyfile /etc/caddy/Caddyfile

EXPOSE 80

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
