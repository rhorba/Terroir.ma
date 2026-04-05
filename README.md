# Terroir.ma

**Digitizing Morocco's terroir product certification chain under Law 25-06 (SDOQ)**

> منصة رقمية لسلسلة تصديق منتجات التراث المغربي وفق القانون 25-06 (نظام علامات الجودة والمنشأ)
>
> Plateforme de numérisation de la chaîne de certification des produits du terroir marocain selon la Loi 25-06 (SDOQ)

---

## Overview

Terroir.ma is a NestJS modular monolith that digitizes the end-to-end lifecycle of SDOQ (Signes Distinctifs d'Origine et de Qualité) certification for Moroccan terroir products — from cooperative registration through product labeling, certification body review, and tamper-proof QR code issuance.

The platform implements Morocco's **Loi 25-06** framework, supporting the three designation types:

| Designation | French | Arabic |
|-------------|--------|--------|
| **AOP** — Protected Designation of Origin | Appellation d'Origine Protégée | تسمية المنشأ المحمية |
| **IGP** — Protected Geographical Indication | Indication Géographique Protégée | البيان الجغرافي المحمي |
| **STG** — Traditional Speciality Guaranteed | Spécialité Traditionnelle Garantie | الاختصاص التقليدي المضمون |

---

## Certification Chain

```
  Cooperative          Product              Certification         Consumer
  Registration         Submission           Review                Verification
      │                    │                    │                     │
      ▼                    ▼                    ▼                     ▼
┌──────────┐         ┌──────────┐         ┌──────────┐         ┌──────────┐
│          │  Kafka  │          │  Kafka  │          │  Kafka  │          │
│ Coopera- │────────▶│ Product  │────────▶│ Certifi- │────────▶│  QR Code │
│  tive    │         │  Module  │         │  cation  │         │ Verifica-│
│  Module  │         │          │         │  Module  │         │   tion   │
│          │◀────────│          │◀────────│          │         │          │
└──────────┘  events └──────────┘  events └──────────┘         └──────────┘
      │                    │                    │
      └────────────────────┴────────────────────┘
                           │
                  ┌────────▼────────┐
                  │  Notification   │
                  │    Module       │
                  │ (Email + Events)│
                  └─────────────────┘
```

**Event flow:**
1. `cooperative.registered` → triggers welcome notification
2. `product.submitted` → triggers certification review assignment
3. `certification.approved` → triggers QR code generation + notifies cooperative
4. `certification.rejected` → notifies cooperative with reason
5. `qr.scanned` → consumer-facing verification response (cached in Redis)

---

## Architecture

```
terroir-ma/
├── src/
│   ├── main.ts                    # Bootstrap: Helmet, CORS, Swagger, Pino
│   ├── app.module.ts              # Root module — wires all feature modules
│   ├── config/                    # Typed config factories (DB, Redis, Kafka, Keycloak)
│   ├── common/                    # Guards, decorators, filters, pipes, interceptors
│   └── modules/
│       ├── cooperative/           # Cooperative CRUD, Keycloak group sync
│       ├── product/               # Product catalog, batch tracking, terroir metadata
│       ├── certification/         # SDOQ review workflow, auditor assignment, QR issuance
│       └── notification/          # Kafka consumer → Handlebars email templates
├── shared/                        # Pure TS types / constants shared across modules
├── test/
│   ├── unit/                      # Jest unit tests (mocked dependencies)
│   ├── integration/               # Testcontainers PostgreSQL integration tests
│   └── e2e/                       # Supertest end-to-end tests
├── migrations/                    # TypeORM migration files
└── infrastructure/
    ├── docker/                    # docker-compose.yml (Postgres, Redis, Redpanda, Keycloak)
    └── keycloak/                  # Realm export, client config, role definitions
```

**Module isolation rule:** Modules communicate exclusively via Kafka events. Direct TypeScript imports across module boundaries are forbidden and enforced by ESLint (`no-restricted-imports`). The only shared code lives in `src/common/` (framework utilities) and `shared/` (pure types).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 LTS |
| Framework | NestJS 10 (modular monolith) |
| Language | TypeScript 5 (strict mode) |
| Database | PostgreSQL 16 + PostGIS (TypeORM) |
| Cache | Redis 7 (cache-manager) |
| Messaging | Redpanda / Kafka (KafkaJS) |
| Auth | Keycloak 24 (OpenID Connect, passport-jwt) |
| Email | Nodemailer + Handlebars templates |
| QR Codes | qrcode + HMAC-SHA256 signing |
| Logging | Pino + nestjs-pino (structured JSON) |
| API Docs | Swagger / OpenAPI 3.1 |
| Testing | Jest, Testcontainers, Supertest |
| CI/CD | GitHub Actions |

---

## Quick Start

### Prerequisites

- Node.js >= 20 (`nvm use` or see `.nvmrc`)
- Docker + Docker Compose v2

### 1. Clone and install

```bash
git clone https://github.com/terroir-ma/terroir-ma.git
cd terroir-ma
cp .env.example .env
npm install
```

### 2. Start infrastructure services

```bash
make docker-up
# Starts: PostgreSQL 16, Redis 7, Redpanda (Kafka), Keycloak 24, Mailpit (SMTP sink)
```

Wait ~30 seconds for Keycloak to initialize, then verify:

```bash
curl http://localhost:8443/realms/terroir-ma/.well-known/openid-configuration
```

### 3. Run database migrations

```bash
make migration-run
```

### 4. Start the API

```bash
make start-dev
# API:     http://localhost:3000/api/v1
# Swagger: http://localhost:3000/api/docs
# Health:  http://localhost:3000/health
```

### 5. (Optional) Seed demo data

```bash
make seed
# Creates sample cooperatives, products, and a submitted certification request
```

---

## Development Workflow

### Daily commands

```bash
make start-dev      # Start API in watch mode
make lint-fix       # Fix ESLint violations
make format         # Run Prettier
make typecheck      # tsc --noEmit
make test-unit      # Fast unit tests (no Docker needed)
make test-cov       # Tests with coverage report (must stay >= 80%)
```

### Before committing

Husky hooks run automatically:
- **pre-commit**: `lint-staged` (ESLint + Prettier on staged files)
- **commit-msg**: `commitlint` (enforces Conventional Commits with project scopes)
- **pre-push**: `tsc --noEmit` + unit tests

### Conventional Commit scopes

Valid scopes: `cooperative`, `product`, `certification`, `notification`, `common`, `config`, `kafka`, `keycloak`, `docker`, `ci`, `docs`, `testing`, `session`, `infra`, `domain`

```bash
git commit -m "feat(certification): implement QR code HMAC signing"
git commit -m "fix(cooperative): correct CIN validation regex for Moroccan IDs"
git commit -m "test(product): add integration test for batch registration"
```

### Adding a new module

```bash
nest generate module modules/my-module
nest generate service modules/my-module
nest generate controller modules/my-module
```

Add the module to `src/app.module.ts` imports, then add cross-module import restrictions to `eslint.config.mjs`.

### Database migrations

```bash
# Generate after changing entities
make migration-generate NAME=AddBatchTrackingToProduct

# Apply
make migration-run

# Rollback last migration
make migration-revert
```

---

## Session Management

Sessions are **stateless JWT tokens** issued by Keycloak. The API validates tokens via JWKS endpoint (`KEYCLOAK_JWKS_URI`).

- Token lifetime: 15 minutes (access), 8 hours (refresh)
- Redis is used for **QR verification caching** and **certification status caching**, not session storage
- All protected routes require a valid Bearer token in `Authorization` header
- Role-based access control uses Keycloak realm roles: `cooperative-admin`, `product-manager`, `certification-auditor`, `platform-admin`

```
Authorization: Bearer <keycloak-access-token>
```

To obtain a token locally (via Mailpit for OTP or direct password flow):

```bash
curl -X POST http://localhost:8443/realms/terroir-ma/protocol/openid-connect/token \
  -d "grant_type=password" \
  -d "client_id=api-client" \
  -d "client_secret=${KEYCLOAK_CLIENT_SECRET}" \
  -d "username=admin@terroir.ma" \
  -d "password=admin"
```

---

## Environment Variables

Copy `.env.example` to `.env` and update values. Never commit `.env`.

Key variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Full PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `KAFKA_BROKERS` | Comma-separated Redpanda/Kafka broker addresses |
| `KEYCLOAK_JWKS_URI` | JWKS endpoint for JWT validation |
| `QR_HMAC_SECRET` | 256-bit secret for QR code HMAC signing — **change before production** |

---

## API Documentation

Swagger UI is available at `/api/docs` when the server is running. OpenAPI JSON is at `/api/docs-json`.

Key endpoints:

```
POST   /api/v1/cooperatives              Register a cooperative
GET    /api/v1/cooperatives/:id          Get cooperative details
POST   /api/v1/products                  Submit a product for certification
GET    /api/v1/products/:id              Get product details
POST   /api/v1/certifications            Open a certification request
PATCH  /api/v1/certifications/:id/approve  Approve (auditor role)
PATCH  /api/v1/certifications/:id/reject   Reject with reason (auditor role)
GET    /api/v1/verify/:qrToken           Public QR code verification (cached)
GET    /health                           Liveness check
GET    /ready                            Readiness check (DB + Redis + Kafka)
```

---

## Morocco-Specific Validation

The platform implements validators for Moroccan identity and business data:

- **CIN** (Carte d'Identité Nationale): `[A-Z]{1,2}[0-9]{5,6}`
- **ICE** (Identifiant Commun de l'Entreprise): 15-digit numeric
- **RC** (Registre de Commerce): format varies by tribunal
- **Commune / Province / Region**: validated against RGPH 2014 administrative division list
- **Geographical coordinates**: validated against Morocco's bounding box (lat 27.67–35.93, lon -13.17–(-1.01))

---

## Contributing

1. Fork the repository and create a feature branch: `git checkout -b feat/cooperative-bulk-import`
2. Follow the module isolation rules — no cross-module imports
3. Write tests: unit tests are required, integration tests for database interactions
4. Ensure `make ci` passes before opening a PR
5. Use the PR template and reference the relevant backlog item

---

## License

MIT — see [LICENSE](LICENSE)
