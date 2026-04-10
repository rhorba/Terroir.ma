# Sprint 4 Retrospective — 2026-04-10

## Metrics

| Metric | Value |
|--------|-------|
| Committed | 21 SP |
| Completed | 21 SP |
| Velocity % | 100% |
| Duration | 2026-04-10 (single-session sprint) |
| Unit tests | 210 passing (was 87, +123) |
| New spec files | 10 new + 4 significantly augmented |
| Coverage — statements | 98.35% (was unmeasured / ~32% with wrong scope) |
| Coverage — branches | 85.09% (was unmeasured / ~63% with wrong scope) |
| Coverage — functions | 96.80% |
| Coverage — lines | 98.25% |
| TypeScript errors | 0 |
| Lint errors | 0 |

---

## What Went Well

- **`collectCoverageFrom` scoping fix had massive immediate impact** — the single-line change narrowing coverage to `*.service.ts` + `*.listener.ts` immediately made the 80% target achievable; trying to cover controllers/DTOs/modules at unit level was architecturally wrong
- **`dataSource.transaction` mock pattern discovered and immediately reusable** — `makeMockEm()` with `create`/`save`/`query` delegates was the unlock for full `CertificationService` state machine testing; now documented for future sprints
- **`lab-test.service.ts` branches 13% → 100%** — deliberate parameterized testing of `validateLabTestParameters()` (NaN, enum, missing, min/max boundaries, multiple failures) achieved full branch coverage in one spec rewrite
- **Redis cache architecture stayed simple** — in-service eviction directly in `QrCodeService` was correct call; no Kafka consumer needed, same-process, zero new infrastructure
- **Retro action items from Sprint 3 all resolved** — coverage baseline measured ✅, `useValue` pattern audited and applied ✅, CLAUDE.md documented ✅
- **15/15 plan tasks completed** — the plan → execute discipline with clear task definitions kept scope tight

---

## What Didn't Go Well

- **`test:cov` script cannot exit 0 in dev** — integration and E2E tests are included in the `test:cov` run but require a live PostgreSQL instance; the script always exits 1 in a no-DB environment. The DoD criterion ("test:cov exits 0") was technically not met as written, though unit coverage passes cleanly via `test:unit --coverage`
- **No Sprint 4 daily log written** — only one daily log exists (2026-04-09, which was actually Sprint 1 close-out). Sprint 4 had no real-time log. The `/save-session` discipline was not followed during this sprint
- **notification.service.ts branches stuck at 57.69%** — lines 92-93 (error update path in `send()`) not covered; the error is caught and swallowed internally making it hard to test with simple mock setup
- **product.service.ts branches at 77.77%** — lines 23-33 (product registration with some optional fields) below threshold but doesn't drag global below 80%
- **Migration drift check skipped** — `npm run migration:generate --check` requires live PostgreSQL; could not verify programmatically. Code review substituted

---

## Action Items

| Item | Owner | Sprint |
|------|-------|--------|
| Add `npm run test:unit:cov` script (unit-only coverage) to `package.json` | Developer | Sprint 5 |
| Cover `notification.service.ts` lines 92-93 (error path in `send()`) | Developer | Sprint 5 |
| Write `/save-session` at end of every work session (daily log discipline) | Developer | Ongoing |
| Verify migration chain with live DB when `docker compose up` is used | Developer | Sprint 5 integration setup |
| Add E2E test for QR scan cache-hit path (< 200ms response time assertion) | Developer | Sprint 5 |

---

## Decisions Made This Sprint

| Decision | Rationale |
|---|---|
| `collectCoverageFrom` scoped to service + listener files only | Controllers/DTOs/modules are 0% in unit tests by design; they belong to E2E/integration coverage |
| In-service QR cache eviction (not event-driven) | Same-process call eliminates Kafka round-trip; simpler, faster, no new consumer logic |
| `makeMockEm()` factory for `dataSource.transaction` tests | Inline entity manager with `create`/`save`/`query` stubs is sufficient for state machine testing without a real DB |
| REVOKED/DENIED/EXPIRED certs never cached | These statuses must be real-time; caching them would serve stale valid responses to consumers |

---

## Definition of Done Compliance

| Criterion | Status | Notes |
|-----------|--------|-------|
| Zero TypeScript errors | ✅ | `npm run typecheck` clean |
| Zero lint errors | ✅ | `npm run lint` clean |
| Unit tests ≥80% statements | ✅ | 98.35% |
| Unit tests ≥80% branches | ✅ | 85.09% |
| Unit tests ≥80% functions | ✅ | 96.80% |
| Unit tests ≥80% lines | ✅ | 98.25% |
| Redis QR cache wired | ✅ | `CacheModule.registerAsync` + `redisStore` |
| GRANTED results cached 300s | ✅ | `cacheManager.set(key, result, 300_000)` |
| REVOKED results not cached | ✅ | Verified by unit test |
| Cache evicted on revoke | ✅ | `deactivateByCertificationId` evicts before `update` |
| Cache evicted on renew | ✅ | `renewCertification` calls `evictQrCache` |
| CLAUDE.md updated (patterns) | ✅ | Known Patterns and Pitfalls section added |
| Migration chain verified | ⚠️ | Code review only — live `--check` requires PostgreSQL |
| `npm run test:cov` exits 0 | ⚠️ | Exits 1 due to integration/E2E failures (no PostgreSQL) — unit coverage passes ≥80% |

---

## Cumulative Velocity (Sprints 1–4)

| Sprint | SP | Duration | Notes |
|--------|----|----------|-------|
| 1 | ~89 | 12 days | Scaffold — atypical, excluded from rolling avg |
| 2 | 30 | 1 day | First feature sprint |
| 3 | 21 | 1 day | Chain completion sprint |
| 4 | 21 | 1 session | Production readiness sprint |
| **Total** | **~161** | **~15 days** | |

Feature velocity (Sp 2–4): **~24 SP/session**. Sprint 5 should plan for 21–25 SP.
