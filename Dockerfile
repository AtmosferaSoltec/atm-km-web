# syntax=docker/dockerfile:1

# Production image. It is built in GitHub Actions and published to GHCR: the
# server never compiles. The app is a static SPA, so the runtime is nginx
# serving the Vite build (deploy/nginx.conf).

# ---- Build ----
FROM node:24-alpine AS builder
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# No API address: the SPA calls /api on its own origin (host nginx routes it to km-api).
RUN pnpm build

# ---- Runtime ----
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runner
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/security-headers.inc /etc/nginx/security-headers.inc
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
