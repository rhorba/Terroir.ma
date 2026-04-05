---
name: docker-conventions
description: Docker patterns for Terroir.ma. Multi-stage Dockerfile, docker-compose profiles (core/app/monitoring/full), test infrastructure, health checks, volume mounts for dev hot reload, environment variable management.
---

# Docker Conventions — Terroir.ma

## Multi-Stage Dockerfile Pattern
```dockerfile
# Stage 1: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Runner
FROM node:20-alpine AS runner
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/main"]
```

## Docker Compose Profiles
| Profile | Containers | Use Case |
|---------|-----------|----------|
| core | PostgreSQL, Redis, Redpanda, Keycloak, Keycloak-DB, Mailpit | Backend development |
| app | terroir-app (NestJS) | Run full app |
| monitoring | Redpanda Console UI | Observe Kafka topics |
| full | All 8 containers | Complete stack |

## Network: terroir-network
All containers on the same bridge network. Internal hostname = service name.
Example: app connects to PostgreSQL at `postgresql:5432`.

## Health Check on Every Container
Every service in docker-compose.yml must have:
```yaml
healthcheck:
  test: [...]
  interval: 30s
  timeout: 10s
  retries: 5
  start_period: 30s
```

## Development Override (docker-compose.override.yml)
- Source mount for hot reload: `./src:/app/src`
- Debug port: `9229:9229`
- NODE_ENV=development, LOG_LEVEL=debug

## Named Volumes
- `pgdata` — PostgreSQL data
- `keycloak_pgdata` — Keycloak PostgreSQL data

## Environment Variables
- `.env.docker` — loaded by Docker Compose (for containers)
- `.env.example` — template for all variables (committed)
- `.env` — local developer file (never committed)
