# Sprint 12 Retrospective — 2026-04-14

**Sprint:** 12 — v1 Hardening  
**Dates:** 2026-04-14 – 2026-04-27 (completed Day 1)

---

## Metrics

| Metric | Value |
|--------|-------|
| Committed | 13 SP |
| Completed | **13 SP** |
| Velocity | **100%** |
| Unit tests before | 382 (36 suites) |
| Unit tests after | **386 (+4)** (36 suites) |
| Integration suites before | 8 (25 tests) |
| Integration suites after | **10 (+2 suites, +4 tests)** |
| E2E suites before | 5 (22 tests) |
| E2E suites after | **8 (+3 suites, +13 tests)** |
| New migrations | **1** (017-AddQrScanEvent, applied live) |
| New endpoints | **1** (GET /certifications/:id/scan-stats) |
| Bugs fixed post-execution | **8** (all caught by post-sprint checklist) |
| Failures at close | **0** |

---

## What Went Well

- **Post-sprint checklist caught everything** — running migration, export:openapi, and both test suites in sequence surfaced 8 real bugs that unit tests couldn't detect: wrong HTTP methods, missing DTO fields, invalid UUIDs, missing ENV vars, incorrect route prefix. The checklist process proved its value.
- **Fire-and-forget pattern is now a first-class convention** — QrScanEvent write follows the exact same `.save().catch(logger.error)` pattern as AuditLog. The pattern is established and reusable.
- **Joi validation gave a clear, actionable error message** — when `MINIO_*` vars were missing, the startup error listed every missing var at once (`abortEarly: false`). No guessing.
- **OpenAPI export doubled as a live ENV smoke test** — `NestFactory.create(AppModule)` in the export script triggers full bootstrap, so any missing required var fails fast. Discovered the `.env` gap immediately.
- **Font fallback is zero-drama** — `existsSync` guard + WARN log + Helvetica means PDF endpoints work in any environment. CI won't fail because fonts aren't checked in.
- **Integration + E2E test suite now covers all 4 modules** — the new suites (system-settings, audit-log, qr-scan-event, notification-preference) fill the last coverage gaps from Sprints 10–11.
- **v1 feature development complete** — 86/90 stories delivered across 12 sprints; remaining 4 stories are Phase 2 by design.

---

## What Didn't Go Well

- **`.env` not kept in sync with `.env.example`** — `MINIO_*` vars were added to `.env.example` in Sprint 9 but never propagated to `.env`. The export:openapi step caught it, but this should have been caught at the time of the Sprint 9 MinIO integration.
- **E2E smoke tests had multiple wrong assumptions** — 7 of the 8 post-checklist bugs were in the 3 new smoke tests: wrong route prefix, wrong HTTP methods, wrong DTO fields, wrong status enum value. The tests were written without running against the real app first.
- **`CooperativeStatus` enum isn't obvious** — `verify()` transitions to `'active'`, not `'verified'`. This is a naming inconsistency in the domain model that will continue to trip up anyone writing tests or clients.
- **VELOCITY-TRACKER.md Sprint 12 row not added inline** — the tracker was not updated during the session; requires a follow-up housekeeping commit.
- **PRODUCT-BACKLOG.md US-058 still shows `Todo`** — backlog not updated to `Done` during the sprint; requires follow-up.

---

## Action Items

| Item | Owner | Due |
|------|-------|-----|
| Mark US-058 as `Done` in `PRODUCT-BACKLOG.md` | Developer | Next session |
| Add Sprint 12 row to `VELOCITY-TRACKER.md` | Developer | Next session (done below) |
| Sync `.env` from `.env.example` at start of every sprint | Developer | Standing practice |
| Run smoke tests against live app before committing | Developer | Standing practice |
| Consider renaming `CooperativeStatus` `'active'` → `'verified'` for clarity | Developer | Phase 2 backlog |
| Start Phase 2 brainstorm (monitoring, tracing, k6, OWASP, Kubernetes) | Developer | Next session |

---

## Decisions Made This Sprint

| Decision | Rationale |
|----------|-----------|
| `QrScanEvent.ipAddress` needs explicit `type: 'varchar'` in `@Column` | TypeORM cannot infer the DB type from a `string \| null` TS union — the column is typed as `Object` and the migration fails without the explicit hint |
| `getScanStats()` uses raw SQL `COUNT(*) FILTER (WHERE ...)` | Cleaner than ORM gymnastics for a two-bucket aggregate; consistent with `getStats()` and `getAnalytics()` patterns elsewhere |
| Joi `abortEarly: false` | Shows all missing vars in one startup error — faster diagnosis than discovering them one at a time |
| `export-openapi.ts` does a full `NestFactory.create(AppModule)` | Ensures the exported spec reflects the actual running app, including all guards, interceptors, and module config |
| `createTestApp()` has no global prefix and no `ResponseInterceptor` | Deliberate — E2E tests hit raw NestJS routing; `main.ts` concerns (prefix, Swagger) are not under test |
| Font fallback to Helvetica (not error) | PDF endpoints must work in all environments including CI where fonts are not present; WARN log makes the gap visible without breaking anything |

---

## Definition of Done Compliance

| Criterion | Status |
|-----------|--------|
| All planned stories delivered | ✅ 13/13 SP |
| Unit tests passing, 0 failures | ✅ 386/386 |
| Integration tests passing | ✅ 29/29 |
| E2E tests passing | ✅ 35/35 |
| lint — 0 errors | ✅ (2 `no-console` warnings in CLI script — acceptable) |
| typecheck — 0 errors | ✅ |
| Migration applied to live DB | ✅ 017-AddQrScanEvent |
| OpenAPI artifact generated | ✅ `docs/api/openapi.json` |
| Session state saved | ✅ `current-state.json` + daily log |
| Committed and pushed to `origin/main` | ✅ `ce1cc9e` |

---

## v1 Closure Summary

Sprint 12 closes v1 feature development for Terroir.ma.

| Measure | Value |
|---------|-------|
| Total sprints | 12 (1 scaffold + 11 feature) |
| Total stories delivered | 86 / 90 |
| Stories deferred to Phase 2 | 4 (US-027, US-053 + 2 minor) |
| Total SP delivered | ~347 |
| Overall velocity | ~100% (10/11 feature sprints at 100%; 2 at 95–96%) |
| Final test counts | 386 unit · 29 integration · 35 E2E |
| Certifcation chain | 12/12 steps implemented |
| Migrations | 17 applied |
| Modules | 4 (cooperative, product, certification, notification) |

**Phase 2 top candidates:** Prometheus/Grafana monitoring, Jaeger distributed tracing, Kafka Schema Registry + Avro, k6/Artillery performance testing, OWASP ZAP security scanning, Kubernetes manifests + Helm charts.
