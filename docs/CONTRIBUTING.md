# Contributing to Terroir.ma

Thank you for contributing to Terroir.ma. This document covers everything you need to know to contribute effectively.

---

## Prerequisites

Before you begin, install the following:

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20.x LTS | https://nodejs.org or `nvm install 20` |
| Docker Desktop | Latest | https://docker.com/products/docker-desktop |
| Docker Compose | v2.x (bundled with Docker Desktop) | — |
| Git | 2.x | https://git-scm.com |
| Make | 4.x | `brew install make` (macOS) / `apt install make` (Ubuntu) / Already on Linux |

Optional but recommended:

| Tool | Purpose |
|------|---------|
| `rpk` CLI | Redpanda topic inspection (`rpk topic list`) |
| DBeaver or TablePlus | PostgreSQL GUI |
| Bruno or Postman | API testing |

Verify prerequisites:

```bash
node --version   # v20.x.x
docker --version # Docker version 27.x.x
make --version   # GNU Make 4.x
```

---

## Local Setup

Follow these steps in order. Do not skip steps.

### 1. Clone the repository

```bash
git clone https://github.com/terroir-ma/terroir-ma.git
cd terroir-ma
```

### 2. Install dependencies

```bash
make install
# Equivalent to: npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and set:

```
# Required: generate a 32-byte hex secret for QR code HMAC signing
QR_HMAC_SECRET=your-32-byte-hex-secret-here

# Optional: change only if you have port conflicts
DATABASE_URL=postgresql://terroir:terroir@localhost:5432/terroir_db
REDIS_URL=redis://localhost:6379
KAFKA_BROKERS=localhost:9092
KEYCLOAK_URL=http://localhost:8443
```

Generate a secure HMAC secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Start infrastructure containers

```bash
make docker-core
```

This starts: PostgreSQL, Redis, Redpanda, Redpanda Console, Keycloak, Mailpit.

Wait until all containers are healthy:

```bash
docker compose ps
# All containers should show "healthy" in STATUS column
# Keycloak takes ~60 seconds to fully start — be patient
```

### 5. Import Keycloak realm

```bash
make keycloak-import
# Imports infrastructure/keycloak/realm-export.json into the terroir-ma realm
```

### 6. Create Redpanda topics

```bash
make topics-create
# Runs infrastructure/scripts/redpanda-create-topics.sh
```

### 7. Run database migrations

```bash
make migration-run
# Creates all 4 PostgreSQL schemas and their tables
```

### 8. Start the development server

```bash
make dev
# Equivalent to: npm run start:dev
# Starts NestJS with hot reload
```

### 9. Verify the setup

```bash
# Liveness check
curl http://localhost:3000/health
# Expected: {"status":"ok","info":{"database":{"status":"up"},"redis":{"status":"up"},"kafka":{"status":"up"}}}

# Readiness check
curl http://localhost:3000/ready
# Expected: {"status":"ok"}
```

Open these in your browser:

| URL | What you see |
|-----|-------------|
| http://localhost:3000/api/docs | Swagger UI |
| http://localhost:8080 | Redpanda Console (topics, consumers) |
| http://localhost:8443/admin | Keycloak Admin UI (admin/admin) |
| http://localhost:8025 | Mailpit (captured emails) |

---

## Branch Naming Convention

All branches must follow this pattern: `<type>/<short-description>`

| Type | When to use | Example |
|------|-------------|---------|
| `feature/` | New functionality | `feature/cooperative-registration` |
| `bugfix/` | Fix a bug in a non-main branch | `bugfix/hmac-null-bytes` |
| `hotfix/` | Urgent fix for production issues | `hotfix/qr-verify-500-error` |
| `chore/` | Maintenance tasks, config, deps | `chore/update-nestjs-10` |
| `docs/` | Documentation only | `docs/add-adr-011` |
| `test/` | Adding or fixing tests only | `test/certification-e2e` |
| `refactor/` | Code restructuring without behavior change | `refactor/extract-qr-service` |

Slugs use kebab-case, all lowercase, no special characters. Keep them under 50 characters.

---

## Conventional Commits

Every commit message must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification. This is enforced by `commitlint` in the CI pipeline.

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | When to use |
|------|-------------|
| `feat` | New feature or behavior |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `chore` | Build system, dependencies, config (no production code) |
| `test` | Adding or modifying tests |
| `refactor` | Code restructuring (no behavior change) |
| `perf` | Performance improvement |
| `ci` | CI/CD configuration changes |
| `style` | Formatting, whitespace (no logic change) |

### Scopes

Use the module or area of code being changed:

| Scope | Area |
|-------|------|
| `cooperative` | Cooperative module |
| `product` | Product module |
| `certification` | Certification module |
| `notification` | Notification module |
| `common` | Shared common layer |
| `infra` | Docker, infrastructure |
| `keycloak` | Keycloak realm/config |
| `db` | Database migrations |
| `kafka` | Kafka topics/events |
| `qr` | QR code functionality |
| `auth` | Authentication/authorization |
| `ci` | GitHub Actions |
| `session` | Session persistence files |

### Examples

```
feat(cooperative): add farm GPS coordinate mapping endpoint

fix(qr): correct HMAC signature validation for UUID v4

docs(adr): add ADR-011 for PostGIS index strategy

chore(deps): update @nestjs/common to 10.4.1

test(certification): add E2E test for 12-step chain

refactor(product): extract lab-test validation into separate service

perf(qr): add Redis caching to verify endpoint

ci: add Testcontainers integration test job

chore(session): save state — cooperative module complete
```

### Breaking Changes

Use a footer `BREAKING CHANGE:` or append `!` after the type:

```
feat(certification)!: change certification number format to include region code

BREAKING CHANGE: Certification numbers now include a 3-letter region code.
Old format: TERROIR-IGP-2025-0042
New format: TERROIR-IGP-SOU-2025-0042
```

---

## Pull Request Process

We use an AI-assisted workflow for feature development. Each significant feature goes through:

### 1. `/brainstorm` — Explore the design space

Before writing code, discuss the approach. What are the options? What are the tradeoffs? This is documented in `docs/plans/<feature-name>.md`.

### 2. `/plan` — Create a concrete implementation plan

Break the feature into small, ordered tasks. Each task should be completable in under 2 hours. Document in `docs/plans/<feature-name>.md`.

### 3. `/execute` — Implement the plan

Follow the plan task by task. Commit after each task with a conventional commit message.

### 4. Create a Pull Request

```bash
gh pr create \
  --title "feat(cooperative): add farm GPS coordinate mapping" \
  --body "$(cat <<'EOF'
## Summary
- Adds POST /api/v1/cooperatives/:id/farms endpoint
- Stores GPS coordinates using PostGIS geography(Point, 4326)
- Validates Moroccan geographic bounds (21°N–36°N, 1°W–17°W)

## Test plan
- [x] Unit tests for FarmService.create()
- [x] Integration test with real PostGIS container
- [x] E2E test via HTTP

## Definition of Done
- [x] TypeScript strict, ESLint zero warnings
- [x] 80% coverage on FarmService
- [x] Morocco coordinate validator tested
- [x] TypeORM migration for farms table
- [x] Swagger docs updated
EOF
)"
```

### PR Requirements

- All CI checks must pass (lint, build, unit tests, integration tests)
- PR title must follow Conventional Commits format
- At least one reviewer (even for solo project — use GitHub's "Request review from yourself" for checklist enforcement)
- No TODOs or placeholder code
- All Definition of Done items checked

---

## Definition of Done

A feature is "done" only when ALL of the following are true:

### Code Quality
- [ ] TypeScript strict mode — zero `any`, zero `as unknown`, zero `@ts-ignore`
- [ ] ESLint zero warnings (including no-cross-module-imports rule)
- [ ] Prettier formatted — `npm run format` shows no changes
- [ ] JSDoc on all public methods (services, controllers, utilities)

### Testing
- [ ] Unit test coverage >= 80% for new/modified code (`npm run test:cov`)
- [ ] Integration tests added for any new DB queries or Kafka event flows
- [ ] E2E test updated if the certification chain step was modified

### API
- [ ] Response envelope used: `{ data: ..., meta: ..., error: null }`
- [ ] Swagger `@ApiOperation`, `@ApiResponse` on all new endpoints
- [ ] Health and readiness endpoints still pass after changes

### Database
- [ ] TypeORM migration generated for any entity changes: `npm run migration:generate`
- [ ] Migration is reversible (DOWN migration included)
- [ ] No cross-schema SQL JOIN queries added

### Events
- [ ] Kafka event interface added/updated in `src/common/interfaces/events/`
- [ ] Event published with correct topic name (see `src/common/constants/kafka-topics.ts`)
- [ ] Consumer handler added/updated in the consuming module

### Morocco-Specific
- [ ] Morocco validators used for: CIN, ICE, IF, phone numbers
- [ ] Notification templates exist in all 3 languages: `ar-MA`, `fr-MA`, `zgh`
- [ ] CNDP: PII fields are marked for redaction in logs (Pino `redact` config)

### Session Persistence
- [ ] `progress.md` updated with what was completed
- [ ] Session saved: `git commit -m "chore(session): save state — <feature> complete"`

---

## Module Isolation Rules

**These are non-negotiable.** Violations will fail CI via ESLint.

### Rule 1: No Cross-Module Service Imports

```typescript
// FORBIDDEN — importing another module's service
import { CooperativeService } from '../cooperative/cooperative.service';

// FORBIDDEN — importing another module's entity
import { Cooperative } from '../cooperative/entities/cooperative.entity';

// ALLOWED — importing from common layer
import { MoroccoPhoneValidator } from '../../common/validators/morocco-phone.validator';
```

### Rule 2: Cross-Module Data Access via Kafka Read-Models

If the Certification module needs the cooperative name, it listens for `cooperative.registered` events and stores the name in its own read-model table (`certification.cooperative_read_models`). It never queries the `cooperative` schema directly.

### Rule 3: Module Index Files Must Not Export Implementation Details

Each module's `index.ts` exports only the module class and public DTOs, never services or repositories.

### Rule 4: Common Layer Has Zero Business Logic

`src/common/` contains only: validators, decorators, DTOs, interceptors, guards, Kafka client wrappers, and response envelopes. Never domain services or domain entities.

---

## Session Management

Terroir.ma is developed with Claude Code as an AI pair programmer. Claude Code has no persistent memory between sessions. The following protocol ensures context is never lost.

### Before Ending a Session

```bash
# 1. Update progress.md with what was completed
# 2. Update .sessions/current-state.json with current module/feature status
# 3. Commit session state
git add .sessions/ progress.md
git commit -m "chore(session): save state — <what you completed>"
```

### When Starting a New Session

```
/resume
```

This reads `.sessions/current-state.json` and `progress.md` to restore context.

### Daily Log

A daily log entry must be created in `.sessions/daily-logs/YYYY-MM-DD.md` at the end of each working session. Include:
- What was accomplished
- Any blockers or decisions made
- What to do next

---

## Running Tests

```bash
# Unit tests (fast, no Docker required)
npm test

# Unit tests with coverage
npm run test:cov

# Integration tests (requires Docker — starts Testcontainers)
npm run test:integration

# E2E tests (requires docker-compose.test.yml up)
npm run test:e2e

# All tests
npm run test:all

# Watch mode (development)
npm run test:watch
```

---

## Code Style

We use:
- **Prettier** for formatting (`.prettierrc` in root)
- **ESLint** with TypeScript rules (`eslint.config.mjs` in root)
- **TypeScript strict mode** (`tsconfig.json`)

```bash
# Check formatting
npm run format:check

# Fix formatting
npm run format

# Lint
npm run lint

# Lint with auto-fix
npm run lint:fix
```

---

## Getting Help

- Check existing ADRs in `docs/ADR/` before making architectural decisions
- Check `docs/domain/` for domain model and certification flow documentation
- Check `docs/runbooks/` for troubleshooting common issues
- Open a GitHub Issue for bugs or feature proposals

---

*Document version: 1.0*
*Last updated: 2026-03-28*
