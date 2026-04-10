# Sprint 2 Retrospective — 2026-04-09

## Metrics

| Metric | Value |
|--------|-------|
| Committed | 30 SP |
| Completed | 30 SP |
| Velocity % | 100% |
| Duration | 2026-04-09 (1 day) |
| Unit tests | 76 passing (was 58) |
| Integration tests | 11 passing |
| E2E tests | 16 passing |
| TypeScript errors | 0 |
| Lint errors | 0 |

---

## What Went Well

- **`applyTransition()` pattern is clean and reusable** — single atomic function handles all 12 transitions consistently; proved its value when refactoring grant/deny/revoke in Sprint 3
- **Kafka-driven Step 7 decoupled cleanly** — `receiveLabResults` wired from listener with idempotency check; no REST endpoint needed
- **CQRS-lite `currentStatus` decision was correct** — no event replay overhead, status reads are instant
- **Vertical slice delivered alongside chain** — US-008/009/015/074 added without blocking chain work
- **State machine unit tests caught real issues** — `certification-state-machine.spec.ts` revealed the JSONB typing problem during batch verification, not in production
- **Batch-of-3 execution discipline** — each batch verified before proceeding; no cascading failures

---

## What Didn't Go Well

- **`grantCertification` guard shortcut left in** — accepted `LAB_RESULTS_RECEIVED | UNDER_REVIEW` instead of `UNDER_REVIEW` only; had to fix in Sprint 3. Should have been caught in Sprint 2 design.
- **TypeORM JSONB `em.insert()` typing** — wasted time before discovering `em.create()` + `em.save()` pattern. Should be documented.
- **`describe` timeout arg error** — minor but required a context recovery at the start of Sprint 3; `describe` only accepts 2 args (name, fn).
- **Lint cleanup for pre-existing test imports** — several integration test files had stale unused imports (`DataSource`, `truncateTables`, etc.) that weren't introduced by Sprint 2 but had to be fixed to pass lint.

---

## Action Items

| Item | Owner | Sprint |
|------|-------|--------|
| Document `em.create()` + `em.save()` JSONB pattern in CLAUDE.md | Developer | Sprint 4 |
| Always verify guard conditions against exact status (not ranges) at design time | Developer | Ongoing |
| Add `describe` timeout misuse to known pitfalls list | Developer | Sprint 4 |

---

## Decisions Made This Sprint

| Decision | Rationale |
|---|---|
| `CertificationEvent` append-only (no `@UpdateDateColumn`, no soft-delete) | Events are facts — they never change |
| Materialized `currentStatus` in CQRS-lite pattern | Law 25-06 audit = events; fast reads = `currentStatus` |
| `correlationId` idempotency guard via `eventRepo.count` | Prevents duplicate Kafka event processing |
| Product `regionCode` via SQL subquery | `Product` entity has no `regionCode` column; belongs to `ProductType` |
| `eslint-disable no-restricted-imports` on `app.module.ts` | AppModule legitimately assembles domain modules |

---

## Definition of Done Compliance

| Criterion | Status |
|-----------|--------|
| Zero TypeScript errors | ✅ |
| Zero lint errors | ✅ |
| Unit tests pass | ✅ 76/76 |
| Integration tests pass | ✅ 11/11 |
| E2E tests pass | ✅ 16/16 |
| Kafka events have typed interfaces | ✅ (+4 new interfaces) |
| New endpoints have class-validator DTOs | ✅ |
| No cross-module service imports | ✅ |
| Migration created for entity changes | ✅ `1700000000005` |
| Coverage measured | ⚠️ Pending |
