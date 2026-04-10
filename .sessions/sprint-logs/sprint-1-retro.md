# Sprint 1 Retrospective — 2026-04-09

## Metrics

| Metric | Value |
|--------|-------|
| Committed | ~89 SP (infrastructure scope, no hard cap) |
| Completed | 89 SP |
| Velocity % | 100% |
| Duration | 2026-03-28 → 2026-04-09 (12 days) |
| Unit tests | 58 passing |
| Integration tests | 11 passing |
| E2E tests | 16 passing |
| TypeScript errors | 0 |
| Lint errors | 0 |

---

## What Went Well

- **Full 3-level test pyramid operational on day 1** — unit + integration (Testcontainers) + E2E (Supertest) all green
- **Modular monolith architecture held up** — 4 domain modules with clean boundaries, no cross-module imports
- **Kafka event definitions complete** — 18 domain events defined with typed interfaces in `src/common/interfaces/events/`
- **TestJwtStrategy pattern works cleanly** — bypasses Keycloak in E2E without touching production guard logic
- **`KafkaClientModule` @Global pattern** — clean DI across all modules without repetition
- **Docker Compose infra solid** — PostgreSQL/PostGIS, Redpanda, Keycloak, Redis, Mailpit all configured

---

## What Didn't Go Well

- **`DataTypeNotSupportedError: Object`** — reflect-metadata emits `Object` for `string | null` unions; had to add `type: 'varchar'` to 16 columns across 9 entity files. Not obvious from docs.
- **Testcontainers schema creation** — TypeORM `synchronize: true` fails if the schema doesn't exist yet; had to write schema-extraction logic from entity metadata before synchronize
- **Jest `testTimeout` placement** — only valid at root config level, not inside `projects[]`; wasted time diagnosing
- **Factory/fixture mismatches** — initial factories used camelCase property names; DB expects snake_case column names in raw SQL fixtures. Rewrote 4 factories and 2 fixtures
- **`faker.internet.username()` breaking change** — renamed to `faker.internet.userName()` in newer faker versions

---

## Action Items

| Item | Owner | Sprint |
|------|-------|--------|
| Add `type: 'varchar'` check to entity creation checklist | Developer | Ongoing |
| Document Testcontainers schema-creation pattern in CLAUDE.md | Developer | Sprint 4 |
| Add factory linting rule (camelCase properties only) | Developer | Sprint 4 |

---

## Decisions Made This Sprint

| Decision | Rationale |
|---|---|
| `KafkaClientModule` @Global | Avoids repetitive provider registration in every module |
| `TestJwtStrategy` registered as `'jwt'` | Same token name as production — guards work identically |
| E2E DB self-init in `createTestApp()` | Tests are fully self-contained, no pre-seeded DB needed |
| QR: HMAC as path param OR UUID + `?sig=` | Supports both direct HMAC links and UUID-based lookups |
| `type: 'varchar'` on all nullable strings | Required by TypeORM reflect-metadata limitation |

---

## Definition of Done Compliance

| Criterion | Status |
|-----------|--------|
| Zero TypeScript errors | ✅ |
| Zero lint errors | ✅ |
| Unit tests ≥ 80% coverage | ⚠️ Coverage not measured (pending `npm run test:cov`) |
| Integration tests pass | ✅ |
| E2E tests pass | ✅ |
| Kafka events have typed interfaces | ✅ |
| DTOs use class-validator | ✅ |
| No cross-module service imports | ✅ |
| Health endpoints functional | ✅ |
