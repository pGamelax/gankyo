FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copia só o package.json do frontend (context = apps/frontend/)
COPY package.json ./
RUN bun install

COPY . .

ARG VITE_API_URL=http://localhost:3001
ENV VITE_API_URL=$VITE_API_URL

RUN bun run build

# ─── Caddy ────────────────────────────────────────────────────────────────────
FROM caddy:2-alpine

COPY --from=builder /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 80

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
