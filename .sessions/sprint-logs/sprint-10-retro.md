# Sprint 10 Retrospective — 2026-04-13

## Metrics

| Metric | Value |
|--------|-------|
| Committed | 24 SP |
| Completed | 24 SP |
| Velocity % | **100%** |
| Duration | 2026-04-13 (single-session sprint) |
| Unit test suites | 33 → **35** (+2) |
| Unit tests | 342 → **357** (+15) |
| Test failures | **0** |
| TypeScript errors | **0** |
| Lint errors | **0** |
| New migration | 1700000000014-AddAuditLog |
| New endpoints | 3 (GET /admin/dashboard, GET /admin/audit-logs, GET /certifications/analytics) |
| Stories delivered | 4 (US-081, US-082, US-085, US-088) |
| Backlog state | 85 / 90 Done (9 Todo remaining) |

---

## What Went Well

- **AuditInterceptor global approach paid off immediately** — a single `APP_INTERCEPTOR` covers all 400+ routes automatically; zero per-module ceremony, skips unauthenticated requests cleanly via `req.user` guard, fire-and-forget tap() never blocks responses
- **DashboardService raw SQL via DataSource preserved module isolation** — querying all 4 schemas directly without importing any module service is the correct architectural pattern; this scales cleanly to microservice extraction (DashboardService becomes its own API that calls 4 service APIs)
- **US-088 delivered in ~5 minutes** — extending the existing `getStats()` with a second `createQueryBuilder` + `deliveryRate` arithmetic added real business value with minimal code; the 3 SP estimate was accurate
- **`Promise.all([regionQuery, productQuery])` in getAnalytics()** — both GROUP BY queries run in parallel, not sequentially; small optimization but the right pattern for analytics that will grow
- **Zero cross-module service imports** — all 4 stories delivered with DashboardService using raw DataSource SQL and AuditInterceptor writing to `common.audit_log`; architecture integrity maintained
- **100% velocity, 10th sprint in a row at ≥95%** — the `/brainstorm → /plan → /execute` workflow continues to produce consistent, predictable delivery

---

## What Didn't Go Well

- **DashboardService created out of order** — AdminController imported `DashboardService` in Batch 2 before the service file existed (Batch 3). TypeScript caught it immediately (TS2307), but it caused a mid-batch fix. Root cause: the plan had AdminController and DashboardService in separate batches but the controller imported the service. Plan should have ordered service creation before controller update.
- **admin.controller.spec.ts needed immediate update** — extending the AdminController constructor (2 new services) broke the existing spec. This is expected but the plan did not explicitly include "update admin.controller.spec.ts" as a task. Should have been a named task.
- **VELOCITY-TRACKER.md is significantly stale** — it only contains data through Sprint 5. Sprints 6–10 velocity was never written back to the tracker. This is a persistent process gap.
- **Font assets still outstanding** — `assets/fonts/Amiri-Regular.ttf` + `assets/fonts/DejaVuSans.ttf` have been a carry-forward item since Sprint 8. PDF certificate and export endpoints cannot serve real output until these are placed. No code change needed, but it keeps appearing as a blocker.

---

## Action Items

| Item | Owner | Sprint |
|------|-------|--------|
| Update VELOCITY-TRACKER.md with Sprints 6–10 data (done in this retro) | Developer | Done ✅ |
| Place font assets: `assets/fonts/Amiri-Regular.ttf` + `assets/fonts/DejaVuSans.ttf` | Developer | Sprint 11 carry-forward |
| Run migrations 009–013 (`npm run migration:run` after `docker compose up`) | Developer | Runtime — whenever Docker is available |
| Plan rule: always create service file in the same batch (or earlier) as the controller that imports it | Developer | Ongoing |
| Add "update affected spec files" as explicit tasks whenever a constructor changes | Developer | Ongoing |

---

## Decisions Made This Sprint

| Decision | Rationale |
|---|---|
| `AuditInterceptor` as global `APP_INTERCEPTOR` | Zero per-module work; fires on every request; tap() is async fire-and-forget so it never delays responses |
| Skip unauthenticated requests in AuditInterceptor | No `userId` to record; public endpoints (QR verify, health) generate noise without value |
| `DashboardService` raw SQL via `DataSource` | No cross-module service imports; queries all 4 schemas directly; architecturally correct for a monolith that will split |
| `AuditLog` in `common` schema | Cross-cutting infrastructure; not owned by any single domain module; parallels how `common.audit_log` would work post-extraction |
| `AuditLog` no `updatedAt` | Append-only immutability — mirrors `CertificationEvent` pattern; audit records must never be mutated |
| US-088 extends `GET /notifications/stats` (not new endpoint) | 3 SP story — deliveryRate is pure arithmetic; adding a second endpoint would be over-engineering |
| `getAnalytics()` parallel `Promise.all` | Two independent GROUP BY queries; no dependency between them; parallel is correct |
| `getAnalytics()` cache key: `analytics:certifications:{from\|all}:{to\|all}` | Consistent with existing stats cache key pattern; TTL 300s |

---

## Definition of Done Compliance

| Criterion | Status | Notes |
|-----------|--------|-------|
| Zero TypeScript errors | ✅ | `npm run typecheck` clean |
| Zero lint errors | ✅ | `npm run lint` clean |
| Unit tests passing | ✅ | 357/357 passing, 0 failures |
| New services have unit tests | ✅ | AuditLogService (4 tests), DashboardService (3 tests) |
| Existing tests updated for changed signatures | ✅ | admin.controller.spec.ts, notification.service.spec.ts |
| New endpoints registered in correct route order | ✅ | /certifications/analytics before /:id confirmed |
| Redis cache applied to new aggregation methods | ✅ | dashboard:admin (300s), analytics:certifications:* (300s) |
| Migration created for new entity | ✅ | 1700000000014-AddAuditLog |
| PRODUCT-BACKLOG.md updated | ✅ | US-081, US-082, US-085, US-088 → Done; table corrected for Sprints 9+10 |
| No cross-module service imports | ✅ | DashboardService uses DataSource only; AuditInterceptor is common-only |
| Migration run on live DB | ⚠️ | Requires `docker compose up` — deferred to runtime |
| Font assets placed for PDF | ⚠️ | Carry-forward since Sprint 8 — no code change needed |

---

## Cumulative Velocity (Sprints 1–10)

| Sprint | Goal | Planned | Completed | % |
|--------|------|---------|-----------|---|
| 1 | Scaffold | ~89 | 89 | 100% |
| 2 | Certification Chain Steps 1–7 | 30 | 30 | 100% |
| 3 | Certification Chain Steps 8–12 | 21 | 21 | 100% |
| 4 | Production Readiness | 21 | 21 | 100% |
| 5 | List Endpoints, QR, i18n | 23 | 22 | 96% |
| 6 | PDF Certificate, Stats, Export Clearances | 22 | 21 | 95% |
| 7 | Schema Drift, Deactivation, Product Types | 20 | 20 | 100% |
| 8 | Inspector Reads, Processing Steps, MAPMDREF | 24 | 24 | 100% |
| 9 | MinIO, Lab Registry, File Uploads, Reports | 22 | 22 | 100% |
| 10 | Dashboard, Analytics, Audit, Delivery Rates | 24 | 24 | 100% |
| **Total (feature, Sp 2–10)** | | **207** | **205** | **99.0%** |

**Rolling average (Sp 2–10):** 22.8 SP/session
**Sprint 11 planning target:** 21–25 SP

---

## Sprint 11 Recommendations

With 9 stories (60 SP) remaining, completion is ~2–3 sprints away.

**Top priority for Sprint 11:**

| ID | Story | SP | Priority | Notes |
|----|-------|----|----------|-------|
| US-090 | System settings (campaign year, HS codes) | 8 | **High** | Last remaining High-priority story |
| US-053 | QR offline verification | 13 | Medium | Large story — may need splitting or deferral |
| US-058 | Track QR scan events | 5 | Low | 4th deferral — low priority |
| US-069 | View HS code assignments | 2 | Low | Small filler |
| US-070 | Export clearances by destination | 3 | Low | Small report |
| US-077 | Notification preferences | 3 | Low | Small preference API |
| US-020 | Export product registry data | 3 | Low | Regulatory export |
| US-050 | Export certification compliance report | 5 | Low | Reporting |
| US-027 | ONSSA lab integration | 13 | Low | Phase 2 (electronic submission) |

**Recommended Sprint 11:** US-090 + US-069 + US-070 + US-077 + US-020 = **19 SP** (conservative, clears small stories)
**Alternative Sprint 11:** US-090 + US-058 + US-077 + US-020 + US-050 = **24 SP** (full velocity)
