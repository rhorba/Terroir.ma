# Sprint 11 Retrospective — 2026-04-14

**Sprint:** 11 — System Config, Reports, Preferences  
**Dates:** 2026-04-14 – 2026-04-27 (completed Day 1)

---

## Metrics

| Metric | Value |
|--------|-------|
| Committed | 24 SP |
| Completed | **24 SP** |
| Velocity | **100%** |
| Unit tests before | 357 (35 suites) |
| Unit tests after | **382 (+25)** (36 suites) |
| New endpoints | **12** |
| New migrations | **2** (applied live) |
| Kafka events | **0** — all read/config |
| Failures | **0** |

---

## What Went Well

- **Zero-Kafka sprint worked cleanly** — all 6 stories were pure read/config; no event contracts to maintain meant execution was fast and linear.
- **CSV-without-npm discipline held** — manual template-string CSV generation avoided package bloat and is sufficient for regulatory export volumes.
- **Preference filter in `send()` required minimal surgery** — injecting `getPreferences()` before the template lookup was a clean one-line guard; channel filter defaults to `['email']` so zero regression on existing email-channel tests.
- **Route ordering confirmed as a stable pattern** — `/compliance-export`, `/clearances-report`, `/hs-codes`, `/preferences/me` all registered before `/:id`; no collisions.
- **Migration 015 self-seeds** — the 7 default rows are inserted in the migration itself, so the DB is ready without any manual setup after `migration:run`.
- **9-batch execution completed in one session** — consistent with Sprints 7–10 single-session delivery.
- **`send()` mock fix was surgical** — cache mock made key-aware via `mockImplementation(key => key.startsWith('pref:') ? null : template)` instead of blanket `mockResolvedValue`; clean fix, pattern is reusable.

---

## What Didn't Go Well

- **DTO creation order dependency** — `SystemSettingsService` was written before the three settings DTOs it imports, causing a typecheck failure mid-Batch 1. Had to pre-create DTOs to unblock verification. The plan should list DTOs before the service that imports them.
- **`preferenceRepo` lint error** — declared `preferenceRepo` in the test setup before writing any tests that use it; the `@typescript-eslint/no-unused-vars` rule blocked Batch 5 verification. Resolution: pull the preference tests into the same batch to use the variable immediately.
- **`send()` cache-hit test broke after preference filter** — the existing test used a blanket `mockResolvedValue(template)` for `cacheManager.get`, which returned the template object as "preferences" on the new first call. Required test update — not hard to fix but could have been anticipated by reading affected test coverage before implementing.
- **Sprint-11 log and backlog were stale at retro time** — `sprint-11.md` still showed all tasks as "Todo" and `PRODUCT-BACKLOG.md` still showed all 6 stories as "Todo". Required manual update during `/retro`. Should be updated as part of `/save-session` or at sprint close.

---

## Action Items

| Item | Owner | Due |
|------|-------|-----|
| In `/plan`, list DTOs before the service that imports them when both are new files | Developer | Sprint 12 planning |
| During `/execute`, add mocks for new repo injections immediately when extending a service (don't wait until test batch) | Developer | Sprint 12 execution |
| Update `sprint-N.md` task checklist and backlog during `/execute` as tasks complete, not at retro | Developer | Sprint 12 |
| Place font assets (`Amiri-Regular.ttf`, `DejaVuSans.ttf`) in `assets/fonts/` before v1 release | Developer | Pre-release |

---

## Decisions Made This Sprint

| Decision | Rationale |
|----------|-----------|
| `common.system_setting` composite PK (group, key) instead of UUID | Natural identity; upsert on conflict is idiomatic for key-value config stores |
| `SystemSettingsService` upserts camelCase → snake_case keys via regex | Keeps DTOs typed and readable; auto-convert at persistence layer |
| `getPreferences()` defaults to `{ channels: ['email'], language: 'fr' }` if no row | Avoids 404 on first-time users; email default is safe and expected |
| `send()` channel filter runs before template lookup | Earlier exit is cheaper; skips DB+Redis template query for suppressed channels |
| cooperative-admin `GET /export-documents/hs-codes` uses JWT `cooperative_id` claim | Enforces isolation server-side; client cannot inject a different cooperativeId |
| `ExportDocumentService.exportClearancesReport()` joins Certification via `leftJoin` | Both entities are in the `certification` schema — intra-module; no cross-module violation |
| CSV header + rows via `[header, ...csvRows].join('\n')` | Simple, correct, no trailing newline; consistent across all 3 CSV methods |

---

## Definition of Done Compliance

| Criterion | Status |
|-----------|--------|
| All sprint stories implemented | ✅ 6/6 |
| Unit tests written for all new code | ✅ +25 tests |
| Zero test failures | ✅ 0 failures |
| lint passes | ✅ |
| typecheck passes | ✅ |
| Migrations written and applied to live DB | ✅ 015 + 016 applied |
| API contracts match design doc | ✅ All 12 endpoints match design.md |
| Route ordering (literal before param) | ✅ All new routes verified |
| No cross-module service imports | ✅ All new code is intra-module or common |
| PRODUCT-BACKLOG.md updated | ✅ 6 stories marked Done |
| VELOCITY-TRACKER.md updated | ✅ Sprint 11 row added |
| progress.md written | ✅ |

---

## Backlog Snapshot After Sprint 11

| Metric | Value |
|--------|-------|
| Total stories | 90 |
| Done | **91** |
| Remaining | **3** (US-053, US-058, US-027) |
| Remaining SP | ~31 |
| Sprints to v1 @ 22.9 avg | **~1.4 sprints** |

### Remaining Stories

| Story | Title | SP | Priority | Notes |
|-------|-------|----|----------|-------|
| US-053 | QR offline verification | 13 | Medium | Large — may split |
| US-058 | Track QR scan events | 5 | Low | 4th deferral; public hot path |
| US-027 | ONSSA lab integration | 13 | Low | Phase 2 — external API dependency |

**Sprint 12 recommendation:** US-053 (split into 2 sub-stories) + US-058 = ~18–21 SP. US-027 deferred to Phase 2.
