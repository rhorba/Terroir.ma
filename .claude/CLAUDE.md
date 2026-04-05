# Terroir.ma — Claude Code Master Instructions

## Project Identity
Terroir.ma — a modular monolith that digitizes Morocco's terroir product certification chain under Law 25-06 (SDOQ). v1 on localhost, designed to extract to microservices in Phase 3.

## Architecture: Modular Monolith
- ONE NestJS application with 4 domain modules (cooperative, product, certification, notification)
- ONE PostgreSQL database with 4 schemas (cooperative, product, certification, notification)
- Redpanda (Kafka-compatible) for event streaming between modules
- Keycloak for multi-role authentication (9 roles)
- Redis for caching (QR verifications, certification status)
- Modules communicate via Kafka events, NEVER by importing each other's services directly
- Each module owns its own database schema — no cross-schema joins
- This IS NOT a traditional monolith — it's designed to split into microservices when needed

## Tech Stack (exact versions)
- Runtime: Node.js 20 LTS
- Framework: NestJS 10.x (TypeScript 5.4+ strict mode)
- Database: PostgreSQL 16 with PostGIS 3.4
- ORM: TypeORM 0.3.x with migrations
- Caching: Redis 7
- Events: Redpanda (Kafka API-compatible, KafkaJS client)
- Auth: Keycloak 24.x (OpenID Connect)
- Validation: class-validator + class-transformer
- Logging: Pino 9.x (structured JSON, correlation IDs, PII redaction)
- Email: Mailpit (dev SMTP sink)
- QR: qrcode + crypto (HMAC-SHA256)
- Testing: Jest 29 + Testcontainers + Supertest
- CI/CD: GitHub Actions
- Container: Docker 25+, Docker Compose v2

## What is NOT in v1
- Kubernetes orchestration (Phase 3)
- Microservice extraction (Phase 3)
- Prometheus + Grafana monitoring (Phase 2)
- Jaeger distributed tracing (Phase 2)
- Kafka Schema Registry + Avro (Phase 2)
- Performance testing with k6/Artillery (Phase 2)
- Contract testing with Pact (Phase 3)
- OWASP ZAP security scanning (Phase 2)
- Chaos engineering (Phase 3)

## Modular Monolith Rules
- Modules MUST NOT import each other's services, repositories, or entities
- Inter-module communication is ONLY via Kafka events
- Each module has its own PostgreSQL schema — no cross-schema foreign keys
- Shared code lives in src/common/
- Static data lives in shared/constants/
- When a module needs data from another module, it either:
  1. Listens to Kafka events and maintains its own read copy
  2. Calls the other module's REST API (via internal HTTP)
- This ensures clean extraction to microservices later

## Domain-Specific Rules
- Certification chain events are IMMUTABLE — append-only, never update/delete
- QR codes signed with HMAC-SHA256, verification must be < 200ms (use Redis cache)
- Lab test parameters vary by product type — always JSONB, never separate tables
- Farm GPS: PostGIS geography type, SRID 4326 (WGS 84)
- Certification number: TERROIR-{IGP|AOP|LA}-{REGION_CODE}-{YEAR}-{SEQ}
- Agricultural campaign year: October → September (not calendar year)

## Coding Standards
- TypeScript strict: no `any`, strictNullChecks, noImplicitReturns
- Hexagonal architecture within each module: controller → service → repository
- JSDoc on every public method
- Health endpoints: GET /health (liveness), GET /ready (readiness)
- Response envelope: { success: boolean, data: T, error: {code, message}, meta: {page, limit, total} }
- UUIDs for all entity IDs
- Timestamps: UTC in DB, Africa/Casablanca for display
- File naming: kebab-case for files, PascalCase for classes, camelCase for variables

## Morocco Rules
- Languages: ar-MA (Arabic, RTL), fr-MA (French, LTR), zgh (Amazigh/Tifinagh, LTR)
- RTL layout support mandatory for Arabic
- Phone: +212 XXXXXXXXX (9 digits after country code)
- Currency: MAD (Moroccan Dirham), format: 1.234,56 MAD
- Date: DD/MM/YYYY
- Timezone: Africa/Casablanca (UTC+1 permanent since 2018)
- CNDP compliance (data protection law)
- CIN/CNIE national ID validation
- ICE (Identifiant Commun de l'Entreprise): 15 digits
- IF (Identifiant Fiscal) validation
- RC (Registre de Commerce) validation
- ONSSA (food safety) certification number format
- HS codes for export documentation

## Kafka Event Conventions
- Topic naming: <module>.<entity>.<action> (e.g., certification.decision.granted)
- All events: JSON with correlationId, eventId (UUID), timestamp (ISO 8601), version
- Consumer groups: <module>-group (e.g., notification-group)
- Dead letter topics: <topic>.dlq
- Idempotent processing: check eventId before processing

## Keycloak Roles
- super-admin: full platform access, manage all cooperatives, override certifications
- cooperative-admin: manage own cooperative, members, farms, products, view certifications
- cooperative-member: log harvests, create batches, view own cooperative's data
- lab-technician: submit lab test results, manage test queue, view product samples
- inspector: conduct inspections, file reports, manage inspection schedule
- certification-body: review certification requests, grant/deny/revoke, view all data
- customs-agent: validate export docs, issue clearance, view certified products
- consumer: scan QR codes, view verification, report suspicious products
- service-account: machine-to-machine authentication

## Testing (3 levels)
- Unit: Jest, 80% coverage, mock all externals, test/unit/, naming: *.spec.ts
- Integration: Testcontainers (PostgreSQL + Redpanda), test/integration/, naming: *.integration.ts
- E2E: docker-compose.test.yml + Supertest, test/e2e/, naming: *.e2e.ts
- Test data: factories (@faker-js/faker) in test/factories/, fixtures in test/fixtures/
- No test may depend on external network access

## Git Conventions
- Conventional Commits: feat:, fix:, docs:, chore:, test:, refactor:
- Scopes: cooperative, product, certification, notification, common, config, kafka, keycloak, docker, ci, docs, testing, session, infra, domain
- Branch naming: feature/, bugfix/, hotfix/, chore/
- Squash merge to main
- All PRs require tests for changed code

## Development Workflow
- /brainstorm → design.md → /plan → plan.md → /execute → code + progress.md
- Feature ideas start with /brainstorm (collaborative design)
- Validated designs become plans via /plan (bite-sized implementation tasks)
- Plans are executed via /execute (batches of 3, with verification checkpoints)

## Project Management
- Product Backlog in docs/project-management/PRODUCT-BACKLOG.md
- 2-week sprints tracked in .sessions/sprint-logs/
- Every feature traces to a backlog item
- Risk register updated per sprint
- /daily-standup, /sprint-status, /retro for Scrum ceremonies

## Session Persistence
- EVERY session ends with /save-session
- EVERY session starts with /resume
- Progress tracked in .sessions/current-state.json, daily-logs/, sprint-logs/

## Available Slash Commands
- /scaffold-module — Create a new NestJS domain module with all boilerplate
- /health-check — Check health of all running services
- /db-migrate — Run, generate, or revert TypeORM migrations
- /kafka-topic — List or create Redpanda/Kafka topics
- /docker-up — Start Docker services by profile (core/app/monitoring/full)
- /docker-down — Stop and remove all Docker containers
- /lint-all — Run ESLint and Prettier checks on the codebase
- /test-all — Run full test suite (unit → integration → e2e) with coverage
- /logs — Tail logs for a Docker container
- /keycloak-setup — Import Keycloak realm and verify all roles/clients
- /generate-env — Generate .env from .env.example with custom values
- /brainstorm — Start a collaborative design session for a new feature
- /plan — Create a detailed implementation plan from a design doc
- /execute — Execute a plan in batches of 3 tasks with verification
- /save-session — Save current session state before quitting
- /resume — Reload last session state and continue where you left off
- /daily-standup — Generate standup: yesterday/today/blockers
- /sprint-status — Generate sprint dashboard with story progress and velocity
- /test-report — Run tests and generate a coverage/failure report
- /retro — Generate sprint retrospective from session logs

## Available Skills
- modular-monolith-patterns — Module isolation, hexagonal architecture, extraction path
- kafka-integration — Producers, consumers, DLQ, idempotency, event interfaces
- keycloak-auth — JWT validation, role guards, OIDC flows, token testing
- docker-conventions — Multi-stage Dockerfile, Compose profiles, health checks
- api-design — Response envelope, URL patterns, DTOs, OpenAPI decorators
- database-patterns — TypeORM entities, JSONB, PostGIS, migrations, no cross-schema joins
- morocco-localization — Trilingual support, RTL, validators (CIN, ICE, phone), CNDP
- brainstorming-into-designs — YAGNI questioning, module/event/role analysis, design docs
- writing-plans — Bite-sized tasks, exact file paths, verification checkpoints
- executing-plans — Batch execution, progress tracking, blocker protocol
- testing-strategy — Three-level pyramid, Testcontainers, Moroccan test data
- pmp-project-management — Charter, WBS, risk register, stakeholder analysis
- scrum-agile — Sprint ceremonies, DoD, DoR, velocity tracking via files
- session-persistence — Save/resume state, daily logs, sprint logs, crash recovery
- terroir-domain — Law 25-06, certification types, 12-step workflow, product lab parameters
