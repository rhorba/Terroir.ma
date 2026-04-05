# Sprint 1 Plan — Scaffolding & Core Infrastructure

## Sprint Goal

All 4 domain modules scaffolded with entities, services, controllers, Kafka producers/consumers, and notification templates. Docker Compose running. CI pipeline green.

## Sprint Details

| Field | Value |
|-------|-------|
| Sprint Number | 1 |
| Duration | 2 weeks |
| Start Date | TBD |
| End Date | TBD |
| Team Size | 3 developers |

## Team

| Role | Responsibilities |
|------|----------------|
| Backend Lead | Architecture decisions, cooperative module, certification module, CI/CD pipeline, ADRs |
| Backend Dev 1 | Product module, Docker Compose setup, shared validators, test infrastructure |
| Backend Dev 2 | Notification module, Handlebars templates, documentation |

---

## Stories in Sprint

These stories are sourced from Epics 1–7. Sprint 1 covers scaffolding only — full business logic implementation is deferred to Sprint 2+.

| Story | Description | Assignee | Points |
|-------|-------------|----------|--------|
| US-001 | Cooperative registration flow (scaffold) | Backend Lead | 5 |
| US-002 | Admin creates cooperative with CIN/ICE/IF validation | Backend Lead | 8 |
| US-011 | Product registration with SDOQ spec (scaffold) | Backend Dev 1 | 8 |
| US-021 | Lab technician submits results (scaffold) | Backend Dev 1 | 8 |
| US-031 | Certification request flow (scaffold) | Backend Lead | 5 |
| US-038 | Certification number generation (scaffold) | Backend Lead | 3 |
| US-051 | QR code generation (scaffold) | Backend Lead | 5 |
| US-052 | Public QR verification endpoint (scaffold) | Backend Lead | 8 |
| US-061 | Export documentation request (scaffold) | Backend Dev 1 | 5 |
| US-071 | Email notification service (scaffold) | Backend Dev 2 | 5 |
| US-072 | Multi-language notification templates | Backend Dev 2 | 8 |
| US-073 | SMS notification service (scaffold/stub) | Backend Dev 2 | 5 |
| US-079 | Kafka event publishing (scaffold) | Backend Lead | 3 |

**Sprint 1 Total Points:** 76

---

## Task Breakdown

### Task 1 — NestJS Project Init + TypeORM Config + 4 Schemas
**Assignee:** Backend Lead
**Estimate:** 1 day

- Initialize NestJS project with `@nestjs/cli`
- Configure TypeORM with PostgreSQL + PostGIS
- Define 4 database schemas: `cooperative`, `product`, `certification`, `notification`
- Set up database migration runner
- Configure `.env.example` with all required variables
- Verify `npm run start:dev` succeeds

**Deliverables:**
- `src/app.module.ts` with TypeORM config
- `src/database/migrations/` directory
- `.env.example` with documentation comments

---

### Task 2 — Docker Compose (Core Profile)
**Assignee:** Backend Dev 1
**Estimate:** 1 day

Set up `docker-compose.yml` with the `core` profile containing all required infrastructure services:

| Service | Image | Port |
|---------|-------|------|
| PostgreSQL + PostGIS | `postgis/postgis:16-3.4-alpine` | 5432 |
| Redis | `redis:7-alpine` | 6379 |
| Redpanda | `redpandadata/redpanda:v23.3.8` | 9092, 9644 |
| Keycloak | `quay.io/keycloak/keycloak:24.0` | 8080 |
| Mailpit | `axllent/mailpit:latest` | 1025, 8025 |

**Deliverables:**
- `docker-compose.yml` with core profile
- `docker-compose.override.yml` for local dev overrides
- `docs/setup/LOCAL-SETUP.md` with startup instructions
- All services start with `docker compose --profile core up -d`

---

### Task 3 — Cooperative Module
**Assignee:** Backend Lead
**Estimate:** 2 days

Scaffold the complete cooperative module:

- **Entities:** `Cooperative`, `CooperativeMember`
- **Service:** `CooperativeService` with CRUD operations + status transitions
- **Controller:** `CooperativeController` with Swagger decorators
- **Kafka Producer:** Publish `cooperative.registered`, `cooperative.verified`, `cooperative.rejected` events
- **DTOs:** `CreateCooperativeDto`, `UpdateCooperativeDto`, `VerifyCooperativeDto`
- **Validators:** CIN validator (Moroccan format), ICE validator (15-digit), IF validator

**Deliverables:**
- `src/cooperative/` module directory
- All entities with TypeORM decorators
- Kafka event types in `src/cooperative/events/`
- Unit tests: `cooperative.service.spec.ts` (scaffold)

---

### Task 4 — Product Module
**Assignee:** Backend Dev 1
**Estimate:** 2 days

Scaffold the product module:

- **Entities:** `Product`, `Harvest`, `Batch`
- **Service:** `ProductService` with CRUD + harvest logging + batch creation
- **Controller:** `ProductController` with Swagger decorators
- **Kafka Producer:** Publish `harvest.logged`, `batch.created` events
- **DTOs:** `RegisterProductDto`, `LogHarvestDto`, `CreateBatchDto`
- **GPS validation:** Validate latitude/longitude within Moroccan bounds

**Deliverables:**
- `src/product/` module directory
- PostGIS `Point` geometry for GPS coordinates
- Kafka event types in `src/product/events/`
- Unit tests: `product.service.spec.ts` (scaffold)

---

### Task 5 — Certification Module
**Assignee:** Backend Lead
**Estimate:** 3 days

Scaffold the certification module with 4 sub-services:

- **Entities:** `CertificationRequest`, `Inspection`, `Certificate`, `QrCode`, `ExportDocument`
- **Services:**
  - `CertificationService` — request, grant, deny, revoke
  - `InspectionService` — schedule, file report
  - `QrCodeService` — generate UUID, Redis cache lookup
  - `ExportService` — request, validate, assign HS code
- **Controllers:** `CertificationController`, `QrVerificationController`, `ExportController`
- **Kafka Listener:** `CertificationListener` — handles `lab-test.completed`
- **Certification Number Generator:** `{SDOQ_CODE}/{REGION_CODE}/{YEAR}/{SEQUENCE}` format

**Deliverables:**
- `src/certification/` module directory
- `src/certification/certification-number.util.ts`
- Redis caching in `QrCodeService`
- Public GET `/verify/:uuid` endpoint (no auth required)
- Kafka listener scaffold in `certification.listener.ts`
- Unit tests: `certification.service.spec.ts`, `certification-number.spec.ts` (scaffold)

---

### Task 6 — Notification Module
**Assignee:** Backend Dev 2
**Estimate:** 2 days

Scaffold the notification module with email, SMS, and Kafka listener:

- **Service:** `NotificationService` — route to email/SMS based on event type
- **Email Service:** `EmailService` using Nodemailer + Handlebars templates
- **SMS Service:** `SmsService` — stub implementation (Phase 2: production gateway)
- **Kafka Listener:** `NotificationListener` — handles all notification events

**Handlebars Templates (7 files):**

| Template | Event |
|----------|-------|
| `cooperative-verified.hbs` | Cooperative verification approved |
| `cooperative-rejected.hbs` | Cooperative verification rejected |
| `certification-granted.hbs` | Certificate granted |
| `certification-denied.hbs` | Certificate denied |
| `certification-revoked.hbs` | Certificate revoked |
| `lab-results-available.hbs` | Lab test results uploaded |
| `export-cleared.hbs` | Export documentation cleared |

Each template must support Arabic (RTL), French, and Amazigh (Tifinagh) rendering.

**Deliverables:**
- `src/notification/` module directory
- `src/notification/templates/` with 7 `.hbs` files
- `src/notification/templates/layouts/base.hbs` with RTL support
- Unit tests: `notification.service.spec.ts` (scaffold)

---

### Task 7 — Shared: Constants & Validators
**Assignee:** Backend Dev 1
**Estimate:** 1 day

**Constants JSON files (6):**

| File | Contents |
|------|---------|
| `sdoq-product-types.json` | Recognized SDOQ product designations |
| `moroccan-regions.json` | 12 administrative regions with codes |
| `hs-codes.json` | HS codes for Moroccan agricultural exports |
| `lab-test-parameters.json` | Test parameters by product type |
| `notification-events.json` | Kafka topic names and event types |
| `campaign-year.json` | Agricultural campaign year config (Oct 1 boundary) |

**Common Validators (Morocco-specific):**
- `@IsMoroccanCIN()` — validates CIN format (letter + 6 digits)
- `@IsMoroccanICE()` — validates ICE (15 numeric digits)
- `@IsMoroccanIF()` — validates IF number format
- `@IsMoroccanPhone()` — validates +212 or 06/07 formats
- `@IsWithinMorocco()` — validates GPS coordinates within Morocco bounds

**Deliverables:**
- `src/shared/constants/` with 6 JSON files
- `src/shared/validators/` with decorator implementations
- Unit tests: `validators.spec.ts`

---

### Task 8 — Test Infrastructure
**Assignee:** Backend Dev 1 + Backend Dev 2
**Estimate:** 1 day

- `jest.config.ts` — separate unit and integration test configurations
- `test/factories/` — 6 factory files (one per main entity)
- `test/fixtures/` — 3 fixture files (cooperatives, products, certifications)
- `test/helpers/` — shared test utilities (mock Kafka, mock Redis, mock Mailer)
- Testcontainers setup for integration tests (PostgreSQL + Redis)
- `jest.setup.ts` for global test configuration

**Factories:**
1. `cooperative.factory.ts`
2. `cooperative-member.factory.ts`
3. `product.factory.ts`
4. `batch.factory.ts`
5. `certification-request.factory.ts`
6. `certificate.factory.ts`

**Deliverables:**
- `test/` directory structure
- All factories using `@faker-js/faker` with Moroccan locale data
- Testcontainers configured for PostgreSQL 16 + Redis 7

---

### Task 9 — CI/CD: GitHub Actions Workflow
**Assignee:** Backend Lead
**Estimate:** 0.5 days

GitHub Actions workflow at `.github/workflows/ci.yml`:

**Jobs:**
1. **lint** — ESLint + Prettier check, TypeScript `tsc --noEmit`
2. **unit** — Run unit tests with coverage report (threshold: 80%)
3. **integration** — Run integration tests with Testcontainers (depends on: unit)

**Triggers:** Push to `main`, pull request to `main`

**Requirements:**
- Node.js 20 LTS
- pnpm package manager
- Fail fast on lint errors
- Upload coverage report as artifact
- Integration tests run in parallel where possible

**Deliverables:**
- `.github/workflows/ci.yml`
- `.github/workflows/` directory structure
- `CODEOWNERS` file

---

### Task 10 — Documentation
**Assignee:** Backend Dev 2 + Backend Lead
**Estimate:** 1 day

**Architecture Decision Records (10 ADRs):**

| ADR | Decision |
|-----|---------|
| ADR-001 | NestJS as application framework |
| ADR-002 | PostgreSQL + PostGIS for geospatial data |
| ADR-003 | Redpanda as Kafka-compatible message broker |
| ADR-004 | Keycloak for identity and access management |
| ADR-005 | Redis for QR verification cache |
| ADR-006 | Handlebars for notification templates |
| ADR-007 | TypeORM as database ORM |
| ADR-008 | UUID v4 for QR code identifiers |
| ADR-009 | Certification number format design |
| ADR-010 | Multi-language (Arabic/French/Amazigh) support strategy |

**Domain Documentation (5 files):**
1. `docs/domain/COOPERATIVE-DOMAIN.md`
2. `docs/domain/CERTIFICATION-DOMAIN.md`
3. `docs/domain/PRODUCT-DOMAIN.md`
4. `docs/domain/NOTIFICATION-DOMAIN.md`
5. `docs/domain/QR-VERIFICATION-DOMAIN.md`

**Morocco-Specific Documentation (4 files):**
1. `docs/morocco/SDOQ-SPECIFICATIONS.md`
2. `docs/morocco/CNDP-COMPLIANCE.md`
3. `docs/morocco/MOROCCAN-VALIDATORS.md`
4. `docs/morocco/AGRICULTURAL-CAMPAIGN-YEAR.md`

**Deliverables:**
- All ADRs in `docs/adr/` using MADR format
- All domain and Morocco docs created

---

## Definition of Done

A story or task is considered done when all of the following are true:

- [ ] All services start without errors (`npm run start:dev` succeeds)
- [ ] Health endpoint `GET /health` returns HTTP 200 with all dependencies listed
- [ ] Unit tests pass with 80%+ code coverage for new code
- [ ] All TypeORM migrations run cleanly (`npm run migration:run`)
- [ ] TypeScript compiles with no errors (`tsc --noEmit` passes)
- [ ] ESLint passes with no warnings
- [ ] All Swagger decorators present on new endpoints
- [ ] Docker Compose `--profile core` starts all 5 services cleanly
- [ ] GitHub Actions CI pipeline is green (lint + unit + integration)
- [ ] No `any` type in new code

---

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Keycloak realm import complexity delays auth setup | Medium | High | Use a mock auth guard (`MockAuthGuard`) for Sprint 1; Keycloak integration in Sprint 2 |
| PostGIS setup issues on Windows dev machines | Medium | Medium | All infrastructure runs in Docker; document WSL2 workarounds in setup guide |
| Redpanda consumer group configuration issues | Low | Medium | Use Redpanda Console UI for debugging; test Kafka connectivity in CI |
| Testcontainers slow on Windows WSL2 | Medium | Low | Use pre-pulled images; cache Docker layers in CI |

---

## Sprint Ceremonies

| Ceremony | Cadence | Duration |
|----------|---------|---------|
| Daily Standup | Daily | 15 min |
| Sprint Planning | Sprint start | 2 hours |
| Sprint Review | Sprint end | 1 hour |
| Sprint Retrospective | Sprint end | 1 hour |

Run `/sprint-status` at any time to see the current burn-down and story progress.
