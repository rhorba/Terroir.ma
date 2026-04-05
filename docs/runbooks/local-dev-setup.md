# Local Development Setup — Terroir.ma

This runbook walks through setting up a complete local development environment for the Terroir.ma NestJS project from a fresh clone to a running API.

---

## Prerequisites

Ensure the following tools are installed before starting:

| Tool | Minimum Version | Check command |
|------|----------------|---------------|
| Docker Desktop | 25+ | `docker --version` |
| Node.js | 20 LTS | `node --version` |
| npm | 10+ | `npm --version` |

> On macOS/Linux, use `nvm` to manage Node versions: `nvm install 20 && nvm use 20`

---

## Step 1 — Clone and Install

```bash
git clone https://github.com/your-org/terroir-ma.git
cd terroir-ma
npm install
```

`npm install` installs all runtime and development dependencies defined in `package.json`. This includes NestJS, TypeORM, KafkaJS, class-validator, and all test tooling.

---

## Step 2 — Configure Environment Variables

Copy the example environment file and fill in any values specific to your machine:

```bash
cp .env.example .env
```

Open `.env` in your editor. Key variables:

| Variable | Description | Default (local) |
|----------|-------------|-----------------|
| `DATABASE_URL` | PostgreSQL connection string (all 4 schemas) | `postgresql://postgres:postgres@localhost:5432/terroir` |
| `KAFKA_BROKERS` | Comma-separated Redpanda broker addresses | `localhost:9092` |
| `KEYCLOAK_REALM` | Keycloak realm name | `terroir-ma` |
| `KEYCLOAK_CLIENT_ID` | API client identifier in Keycloak | `terroir-ma-api` |
| `QR_HMAC_SECRET` | Secret key for QR code HMAC-SHA256 signing | _(set a random 32-byte hex string)_ |
| `REDIS_URL` | Redis connection string (QR cache) | `redis://localhost:6379` |
| `SMTP_HOST` | SMTP server hostname | `localhost` |
| `SMTP_PORT` | SMTP server port | `1025` _(Mailpit)_ |

> `QR_HMAC_SECRET` must be at least 32 characters. Generate one with:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

---

## Step 3 — Start Infrastructure

The `docker-compose.yml` uses **profiles** to group services. The `core` profile starts all infrastructure services needed for development:

```bash
docker compose --profile core up -d
```

This starts the following containers:

| Service | Port(s) | Description |
|---------|---------|-------------|
| `postgres` | 5432 | PostgreSQL 16 with PostGIS extension |
| `redis` | 6379 | Redis for QR verification cache |
| `redpanda` | 9092, 9644 | Kafka-compatible message broker |
| `keycloak` | 8443 | Identity and access management |
| `mailpit` | 8025 (UI), 1025 (SMTP) | Email capture for local testing |

Wait for all services to become healthy:

```bash
docker compose ps
```

All services should show `healthy` or `running` status.

---

## Step 4 — Run Database Migrations

Apply all pending TypeORM migrations to create the database schemas and tables:

```bash
npm run migration:run
```

This is equivalent to:

```bash
npx typeorm migration:run -d src/config/typeorm.config.ts
```

On a fresh database this creates all four schemas (`cooperative`, `product`, `certification`, `notification`) and their tables.

---

## Step 5 — Seed Keycloak Realm

Import the pre-configured Keycloak realm definition (includes roles, client, and test users):

```bash
docker exec keycloak /opt/keycloak/bin/kc.sh import --file /tmp/terroir-realm.json
```

This creates:

- Realm: `terroir-ma`
- Client: `terroir-ma-api` (confidential, client credentials enabled)
- All 9 roles (see `keycloak-setup.md`)
- One test user per role (password: `Test@123`)

> If the realm already exists, Keycloak will skip the import without error. To re-import from scratch, delete the realm via the Admin UI first.

---

## Step 6 — Start the Development Server

```bash
npm run start:dev
```

NestJS starts in watch mode on **port 3000**. File changes trigger an automatic hot reload.

---

## Step 7 — Verify the Setup

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{ "status": "ok" }
```

HTTP status: `200 OK`

If you receive a connection error, check that the dev server started without errors and that the `DATABASE_URL` in `.env` is correct.

---

## Useful URLs

| Service | URL |
|---------|-----|
| REST API | http://localhost:3000 |
| Swagger UI | http://localhost:3000/api |
| Mailpit (email UI) | http://localhost:8025 |
| Redpanda Console (Kafka UI) | http://localhost:8080 |
| Keycloak Admin Console | http://localhost:8443 |

> Redpanda Console requires the `monitoring` profile to be running:
> ```bash
> docker compose --profile monitoring up -d
> ```

---

## Makefile Shortcuts

A `Makefile` is provided for common operations:

| Command | Description |
|---------|-------------|
| `make up` | Start all infrastructure (`docker compose --profile core up -d`) |
| `make down` | Stop all containers (`docker compose down`) |
| `make migrate` | Run pending migrations (`npm run migration:run`) |
| `make test` | Run unit test suite (`npm test`) |

Use `make help` to see all available targets.
