# Terroir.ma — System Architecture

## Overview

Terroir.ma is a certification management platform for Moroccan geographical indication (GI) products, implementing Morocco's Law 25-06 (SDOQ). The system tracks the full 12-step certification chain from cooperative registration through QR-verified export documents.

---

## Why Modular Monolith for v1

### The Decision

Terroir.ma v1 is built as a **modular monolith**: one NestJS application with four strictly isolated domain modules. This is a deliberate architectural choice, not a shortcut.

### Rationale

**Developer productivity is the primary constraint.** This is a solo developer passion project. Microservices require:
- Multiple repositories or a complex monorepo with independent CI pipelines
- Inter-service network calls adding 2–20ms per hop
- Distributed tracing infrastructure (Jaeger, Zipkin) just to debug a bug that crosses service boundaries
- Service discovery, load balancing, health checks between services
- Multiple deployment units to orchestrate

With a modular monolith:
- One `docker compose up` starts everything
- One test suite (`npm test`) covers all domains
- Debugger attaches once
- Database transactions span module boundaries when truly needed
- Zero network overhead for in-process module communication

### Module Boundaries Are Identical

The critical insight: **the module boundaries in the monolith are exactly the same as they would be in microservices.** We define:

- `cooperative/` — handles cooperative registration, members, farms
- `product/` — handles product types, harvests, production batches, lab tests
- `certification/` — handles certification requests, inspections, QR codes, export documents
- `notification/` — handles email/SMS templating and delivery

These boundaries do not change in Phase 3. What changes is only the deployment unit.

### Zero Inter-Service Latency

All four modules run in the same Node.js process. A Kafka event published by `CertificationModule` and consumed by `NotificationModule` is a local in-process operation through Redpanda — no TCP round-trip between services.

### Phase 3 Extraction Path

When volume justifies microservice extraction (Phase 3):
1. Copy the module directory into a new NestJS application
2. Point it at the same Redpanda cluster
3. Migrate the PostgreSQL schema to a separate database
4. Update Kubernetes Helm charts to deploy the new service
5. Remove the module from the monolith

**Business logic does not change. Kafka event interfaces do not change. API contracts do not change.**

---

## Module Isolation Rules

These rules are enforced at compile time by ESLint and at review time by the Definition of Done checklist.

### Rule 1: No Cross-Module Imports

A module **must never** import a service, entity, or repository from another module.

```
// FORBIDDEN — certification module importing from cooperative module
import { CooperativeService } from '../cooperative/cooperative.service';

// ALLOWED — using a shared DTO from the common layer
import { ResponseEnvelope } from '../../common/dto/response-envelope.dto';
```

The ESLint rule `no-restricted-imports` with path patterns enforces this at compile time. CI fails on any violation.

### Rule 2: Kafka Events Are the Only Inter-Module Contract

Modules communicate exclusively through Kafka events. If `CertificationModule` needs to know the cooperative name, it reads from its own read-model (materialized from cooperative events), not by calling `CooperativeService`.

### Rule 3: Shared Code Lives in `common/`

Utilities, validators, DTOs, and constants used across modules live in `src/common/`. Common code must have zero domain logic — only infrastructure concerns (response envelopes, validators, decorators, Kafka client wrappers).

### Rule 4: Each Module Owns Its PostgreSQL Schema

`cooperative` module reads/writes only the `cooperative` schema. `product` module reads/writes only the `product` schema. No cross-schema JOINs in application queries. Read-models are replicated via Kafka events.

---

## PostgreSQL Schemas-Per-Module Pattern

### Structure

```
terroir_db (single database)
├── cooperative schema
│   ├── cooperative.cooperatives
│   ├── cooperative.members
│   └── cooperative.farms
├── product schema
│   ├── product.product_types
│   ├── product.harvests
│   ├── product.production_batches
│   ├── product.lab_tests
│   └── product.lab_test_results
├── certification schema
│   ├── certification.certifications
│   ├── certification.inspections
│   ├── certification.inspection_reports
│   ├── certification.qr_codes
│   └── certification.export_documents
└── notification schema
    ├── notification.notifications
    └── notification.notification_templates
```

### Why Schemas Over Separate Databases

- **One connection pool** shared across all modules (PostgreSQL max_connections is a limited resource)
- **One `pg_dump`** backs up all data
- **One PostGIS `CREATE EXTENSION`** — PostGIS installs per database, not per schema
- **One TypeORM migration runner** — `npm run migration:run` handles all schemas
- **Simpler development** — one `DATABASE_URL` environment variable

### No Cross-Schema Foreign Keys

Relationships between entities in different modules are maintained via Kafka events and application-level referential integrity, not database foreign keys. This is what makes Phase 3 extraction straightforward: no FK constraints to drop.

### TypeORM Schema Configuration

Each module's TypeORM entities specify their schema:

```typescript
@Entity({ schema: 'cooperative', name: 'cooperatives' })
export class Cooperative { ... }

@Entity({ schema: 'product', name: 'harvests' })
export class Harvest { ... }
```

Migrations are generated per module:

```
database/migrations/cooperative/
database/migrations/product/
database/migrations/certification/
database/migrations/notification/
```

---

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         NestJS Application                               │
│                           (Port 3000)                                   │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  ┌───────────┐  │
│  │  Cooperative │  │   Product    │  │ Certification │  │Notification│  │
│  │    Module    │  │   Module     │  │    Module     │  │  Module   │  │
│  │              │  │              │  │               │  │           │  │
│  │ CoopService  │  │ ProductSvc   │  │  CertService  │  │ NotifSvc  │  │
│  │ MemberSvc    │  │ HarvestSvc   │  │  InspectSvc   │  │ TemplateSvc│ │
│  │ FarmSvc      │  │ LabTestSvc   │  │  QrCodeSvc    │  │           │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘  └─────┬─────┘  │
│         │                 │                  │                 │        │
│  ┌──────┴─────────────────┴──────────────────┴─────────────────┴──────┐ │
│  │              Common Layer (Guards, Decorators, Validators)         │ │
│  │              KafkaProducer | KafkaConsumer | ResponseEnvelope      │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└──────────┬─────────────────┬──────────────────┬────────────────────────┘
           │                 │                  │
           ▼                 ▼                  ▼
┌──────────────────┐  ┌─────────────┐  ┌──────────────────┐
│  PostgreSQL 16   │  │  Redpanda   │  │   Keycloak 24    │
│  + PostGIS 3     │  │ (Port 9092) │  │   (Port 8443)    │
│  (Port 5432)     │  │             │  │                  │
│                  │  │  Topics:    │  │  Realm:          │
│  cooperative.*   │  │  coop.*     │  │  terroir-ma      │
│  product.*       │  │  product.*  │  │                  │
│  certification.* │  │  cert.*     │  │  9 Roles         │
│  notification.*  │  │  notif.*    │  │  5 Clients       │
└──────────────────┘  └─────────────┘  └──────────────────┘
                                                │
           ┌────────────────────────────────────┘
           │
           ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│    Redis 7       │  │    Mailpit       │  │ Redpanda Console │
│  (Port 6379)     │  │  (Port 8025)     │  │   (Port 8080)    │
│                  │  │                  │  │                  │
│  QR code cache   │  │  Email dev trap  │  │  Topic browser   │
│  Rate limiting   │  │  SMS simulation  │  │  Consumer lag    │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

### Docker Compose Container Inventory

| Container | Image | Port | Purpose |
|-----------|-------|------|---------|
| `app` | Custom NestJS | 3000 | Main API |
| `postgres` | postgis/postgis:16-3.4 | 5432 | Primary database |
| `redis` | redis:7-alpine | 6379 | Cache + rate limiting |
| `redpanda` | redpandadata/redpanda | 9092, 9644 | Kafka-compatible broker |
| `redpanda-console` | redpandadata/console | 8080 | Redpanda Web UI |
| `keycloak` | quay.io/keycloak/keycloak:24 | 8443 | Identity provider |
| `mailpit` | axllent/mailpit | 8025, 1025 | Email dev trap |
| `schema-registry` | (built-in Redpanda) | 8081 | Schema Registry (Phase 2) |

---

## Data Flow: 12-Step Certification Chain

The certification chain is an event-driven saga. Each step produces a Kafka event that triggers the next step.

```
Step 1: Cooperative registers
  Actor: cooperative-admin
  HTTP: POST /api/v1/cooperatives
  Event produced: cooperative.registered
  Consumer: NotificationModule → welcome email

Step 2: Product type declared
  Actor: cooperative-admin
  HTTP: POST /api/v1/products
  Event produced: product.declared
  Consumer: CertificationModule → creates draft certification record

Step 3: Harvest logged
  Actor: cooperative-admin
  HTTP: POST /api/v1/harvests
  Event produced: product.harvest-logged
  Consumer: ProductModule → updates batch availability

Step 4: Production batch created
  Actor: cooperative-admin
  HTTP: POST /api/v1/batches
  Event produced: product.batch-created
  Consumer: CertificationModule → links batch to certification

Step 5: Lab test ordered
  Actor: cooperative-admin or certification-body
  HTTP: POST /api/v1/lab-tests
  Event produced: product.lab-test-ordered
  Consumer: NotificationModule → notifies lab-technician

Step 6: Lab test results submitted
  Actor: lab-technician
  HTTP: POST /api/v1/lab-tests/:id/results
  Event produced: product.lab-test-completed
  Consumer: CertificationModule → validates against product type thresholds

Step 7: Lab test evaluated (pass/fail)
  Actor: CertificationModule (automatic)
  Event produced: certification.lab-test-passed OR certification.lab-test-failed
  Consumer on pass: CertificationModule → moves to inspection scheduling
  Consumer on fail: NotificationModule → notifies cooperative, certification paused

Step 8: Inspection scheduled
  Actor: certification-body
  HTTP: POST /api/v1/inspections
  Event produced: certification.inspection-scheduled
  Consumer: NotificationModule → notifies inspector + cooperative

Step 9: Inspection conducted and report filed
  Actor: inspector
  HTTP: PATCH /api/v1/inspections/:id/report
  Event produced: certification.inspection-completed
  Consumer: CertificationModule → evaluates report

Step 10: Inspection evaluated (pass/fail)
  Actor: CertificationModule (automatic)
  Event produced: certification.inspection-passed OR certification.inspection-failed
  Consumer on pass: CertificationModule → moves to certification body review
  Consumer on fail: NotificationModule → notifies cooperative with remediation notes

Step 11: Certification granted or denied
  Actor: certification-body
  HTTP: PATCH /api/v1/certifications/:id/grant OR /deny
  Event produced: certification.granted OR certification.denied
  Consumer on granted: CertificationModule → generates certificate number
                        NotificationModule → notifies cooperative
  Consumer on denied: NotificationModule → notifies cooperative with reasons

Step 12: QR code generated and export document issued
  Actor: certification-body or cooperative-admin
  HTTP: POST /api/v1/qr-codes/:certificationId
        POST /api/v1/export-documents
  Event produced: certification.qr-generated, certification.export-issued
  Consumer: NotificationModule → sends certificate package to cooperative
```

---

## Authentication Flow Through Keycloak

### OIDC Authorization Code Flow (Web Portal)

```
Browser                    NestJS                    Keycloak
   │                          │                          │
   │  GET /dashboard           │                          │
   │─────────────────────────►│                          │
   │                          │ 401 Unauthorized         │
   │◄─────────────────────────│                          │
   │                          │                          │
   │  Redirect to Keycloak login                         │
   │────────────────────────────────────────────────────►│
   │                          │                          │
   │  User enters credentials │                          │
   │────────────────────────────────────────────────────►│
   │                          │                          │
   │  Authorization code      │                          │
   │◄────────────────────────────────────────────────────│
   │                          │                          │
   │  POST /callback?code=... │                          │
   │─────────────────────────►│                          │
   │                          │  Exchange code for token │
   │                          │────────────────────────►│
   │                          │                          │
   │                          │  JWT access_token        │
   │                          │◄───────────────────────── │
   │                          │                          │
   │  Set-Cookie: session     │                          │
   │◄─────────────────────────│                          │
```

### Client Credentials Flow (Service-to-Service, Phase 3)

```
ServiceA                   Keycloak                  ServiceB
   │                          │                          │
   │  POST /token              │                          │
   │  client_id + client_secret│                         │
   │─────────────────────────►│                          │
   │                          │                          │
   │  access_token (JWT)      │                          │
   │◄─────────────────────────│                          │
   │                          │                          │
   │  GET /api/resource        │                          │
   │  Authorization: Bearer <token>                      │
   │────────────────────────────────────────────────────►│
   │                          │                          │
   │                          │  Verify JWT signature    │
   │                          │◄─────────────────────────│
```

### JWT Validation in NestJS

NestJS uses `passport-jwt` with the Keycloak JWKS endpoint:

```
GET http://localhost:8443/realms/terroir-ma/protocol/openid-connect/certs
```

Every request to protected endpoints:
1. `JwtAuthGuard` extracts Bearer token from `Authorization` header
2. `passport-jwt` validates signature against JWKS
3. Checks `exp`, `iss`, `aud` claims
4. `RolesGuard` checks `realm_access.roles` array in JWT payload
5. `@Roles('inspector')` decorator on controller method enforces role

### Keycloak Realm Configuration

| Client | Flow | Purpose |
|--------|------|---------|
| `web-portal` | Authorization Code + PKCE | Cooperative admin web UI |
| `inspector-app` | Authorization Code + PKCE | Mobile inspector app (Phase 3) |
| `consumer-app` | Public client | Consumer QR verification (no auth required) |
| `api-client` | Client Credentials | Service-to-service (Phase 3) |
| `admin-cli` | Direct Grant | CI/CD test token generation |

---

## Phase 3: Extraction to Microservices

### What Changes

| Concern | Modular Monolith | Microservices |
|---------|-----------------|---------------|
| Deployment | 1 Docker container | 4 Docker containers / K8s Deployments |
| Database | 1 DB, 4 schemas | 4 separate databases |
| Kafka | Same cluster | Same cluster |
| Business logic | **Unchanged** | **Unchanged** |
| Event interfaces | **Unchanged** | **Unchanged** |
| API contracts | **Unchanged** | **Unchanged** |
| Module code | **Unchanged** | **Unchanged** |

### Extraction Process (One Module at a Time)

1. **Create new NestJS app**: `nest new certification-service`
2. **Copy module**: Copy `src/certification/` into new app's `src/`
3. **Configure own database**: Point to `certification_db` (exported from `terroir_db.certification`)
4. **Keep same Kafka cluster**: No change to topics, events, or consumer groups
5. **Write Helm chart**: `helm/certification-service/`
6. **Deploy behind same ingress**: `/api/v1/certifications/*` routes to new service
7. **Remove from monolith**: Delete `src/certification/` from main app
8. **No integration test changes**: E2E tests test HTTP endpoints — service location is irrelevant

### What Does NOT Change

- Kafka event interface files (`src/common/interfaces/events/`)
- Business rules (certification number format, HMAC signing, agricultural year logic)
- API request/response shapes
- Keycloak JWT validation
- Database migration SQL (just runs against a different connection)

---

## Performance Characteristics

### QR Verification Latency Target

`GET /api/v1/verify/:uuid` must respond in under 200ms.

- Redis cache hit: ~1ms (HMAC revalidation + Redis GET)
- Redis cache miss: ~15ms (PostgreSQL query + HMAC validation + Redis SET)
- Rate limiter overhead: ~0.5ms

### Database Query Optimization

- PostGIS GiST index on `farms.coordinates` for bounding box queries
- B-tree index on `certifications.certification_number` for lookups
- B-tree index on `qr_codes.uuid` for verification endpoint
- Partial index on `certifications.status = 'ACTIVE'` for active-cert queries

### Kafka Consumer Lag Monitoring

Consumer lag is monitored via Redpanda Console at `http://localhost:8080`. Target: lag < 100 messages on all topics at all times. Consumer groups:

- `cooperative-module-cg` — consumes `product.*` and `certification.*` events
- `product-module-cg` — consumes `cooperative.*` events
- `certification-module-cg` — consumes `product.*` events
- `notification-module-cg` — consumes all events

---

## Security Architecture

### Defense in Depth

```
Internet → Rate Limiter (Helmet + throttler)
         → JWT validation (passport-jwt + Keycloak JWKS)
         → Role-based access control (@Roles decorator)
         → Request validation (class-validator DTOs)
         → Parameterized SQL queries (TypeORM)
         → Schema-level isolation (PostgreSQL schemas)
         → HMAC verification (QR codes)
```

### Secrets Management

All secrets in `.env` (gitignored). For Phase 2+, migrate to AWS Secrets Manager or HashiCorp Vault.

| Secret | Description |
|--------|-------------|
| `QR_HMAC_SECRET` | 32-byte hex, signs QR codes |
| `DATABASE_URL` | PostgreSQL connection string |
| `KEYCLOAK_CLIENT_SECRET` | Keycloak client secret |
| `REDIS_PASSWORD` | Redis auth password |
| `JWT_PUBLIC_KEY` | Keycloak RSA public key |

---

*Document version: 1.0 — Phase 1 (Modular Monolith)*
*Last updated: 2026-03-28*
