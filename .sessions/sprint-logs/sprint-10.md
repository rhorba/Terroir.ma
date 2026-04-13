# Sprint 10 Log — Admin Dashboard, Analytics, Audit Logs, Delivery Rates

**Sprint:** 10
**Dates:** 2026-04-13 → 2026-04-13
**Status:** CLOSED ✅
**Velocity:** 24/24 SP (100%)

---

## Goal

Deliver the super-admin dashboard (counts across all 4 modules), certification analytics by region and product type, HTTP request audit logging, and notification delivery rates — completing the core admin observability layer.

---

## Stories Delivered

| ID | Story | SP | Result |
|---|---|---|---|
| US-081 | Super-admin platform metrics dashboard | 8 | ✅ Done — DashboardService (raw SQL × 5 queries, Redis 300s), GET /admin/dashboard |
| US-082 | Certification analytics by region and product type | 8 | ✅ Done — getAnalytics() (parallel GROUP BY, Redis 300s), GET /certifications/analytics |
| US-085 | User activity audit logs | 5 | ✅ Done — AuditLog entity (common.audit_log), AuditInterceptor (global APP_INTERCEPTOR), GET /admin/audit-logs |
| US-088 | Notification delivery rates | 3 | ✅ Done — byChannel + deliveryRate % added to GET /notifications/stats |

**Total: 24 SP**

---

## New Files

| File | Purpose |
|---|---|
| `src/common/entities/audit-log.entity.ts` | AuditLog entity — append-only, schema: common |
| `src/common/services/audit-log.service.ts` | record() fire-and-forget, findAll() paginated |
| `src/common/services/dashboard.service.ts` | getDashboard() — raw SQL × 5 schemas, Redis cached |
| `src/common/interceptors/audit.interceptor.ts` | Global APP_INTERCEPTOR — logs every authenticated request |
| `src/common/dto/audit-log-query.dto.ts` | userId, from, to, page, limit query params |
| `src/common/interfaces/dashboard.interface.ts` | DashboardMetrics + per-module metric interfaces |
| `src/database/migrations/1700000000014-AddAuditLog.ts` | CREATE TABLE common.audit_log + 2 indexes |
| `test/unit/common/audit-log.service.spec.ts` | 4 tests |
| `test/unit/common/dashboard.service.spec.ts` | 3 tests |

---

## Modified Files

| File | Change |
|---|---|
| `src/common/controllers/admin.controller.ts` | + DashboardService + AuditLogService; + GET /admin/dashboard, GET /admin/audit-logs |
| `src/app.module.ts` | + TypeOrmModule.forFeature([AuditLog]), + DashboardService, AuditLogService, APP_INTERCEPTOR |
| `src/modules/certification/interfaces/certification-stats.interface.ts` | + RegionAnalyticsRow, ProductTypeAnalyticsRow, CertificationAnalytics |
| `src/modules/certification/services/certification.service.ts` | + getAnalytics() |
| `src/modules/certification/controllers/certification.controller.ts` | + GET /certifications/analytics (before /:id) |
| `src/modules/notification/interfaces/notification-stats.interface.ts` | + ChannelDeliveryStats, byChannel field on NotificationStats |
| `src/modules/notification/services/notification.service.ts` | getStats() extended — 2nd createQueryBuilder for channel breakdown + deliveryRate |
| `test/unit/common/admin.controller.spec.ts` | + DashboardService + AuditLogService mocks; + 2 controller tests |
| `test/unit/certification/certification.service.spec.ts` | + 2 getAnalytics() tests |
| `test/unit/notification/notification.service.spec.ts` | Updated for dual getRawMany; + 2 byChannel/deliveryRate tests |
| `docs/project-management/PRODUCT-BACKLOG.md` | US-081, US-082, US-085, US-088 → Done; summary table updated |
| `docs/project-management/VELOCITY-TRACKER.md` | Sprints 6–10 added; rolling averages updated |

---

## New Endpoints (3 total)

| Method | Path | Roles | Story |
|---|---|---|---|
| GET | /admin/dashboard | super-admin | US-081 |
| GET | /admin/audit-logs | super-admin | US-085 |
| GET | /certifications/analytics | super-admin, certification-body | US-082 |

US-088: extends existing `GET /notifications/stats` — no new endpoint.

---

## New Redis Cache Keys

| Key | TTL | Story |
|---|---|---|
| `dashboard:admin` | 300s | US-081 |
| `analytics:certifications:{from\|all}:{to\|all}` | 300s | US-082 |

---

## Test Results

| Metric | Sprint 9 | Sprint 10 | Delta |
|---|---|---|---|
| Suites | 33 | **35** | +2 |
| Tests | 342 | **357** | +15 |
| Failures | 0 | **0** | — |
| lint | ✅ | ✅ | — |
| typecheck | ✅ | ✅ | — |

---

## Key Decisions

1. **AuditInterceptor as APP_INTERCEPTOR** — single global registration covers all routes; per-module registration was never considered
2. **AuditInterceptor skips unauthenticated requests** — `if (!req.user) return next.handle()` — public endpoints have no userId to record
3. **AuditLog.record() fire-and-forget** — `void this.auditLogService.record(...)` in tap() — never throws, never delays response
4. **DashboardService raw SQL only** — `DataSource.query()` across all 4 schemas without importing any domain service — modular boundary respected
5. **getAnalytics() positional params** — uses `$1`, `$2` PostgreSQL positional params (consistent with existing `onssaReport()` pattern)
6. **Batches 2+3 merged mid-execution** — AdminController imported DashboardService before it was created; service had to be created early. Plan ordering lesson logged in retro.

---

## Pending Before Sprint 11

- [ ] Place font assets: `assets/fonts/Amiri-Regular.ttf` + `assets/fonts/DejaVuSans.ttf` (carry-forward since Sprint 8)
- [ ] Run migrations 009–014 (`npm run migration:run` after `docker compose up`)

---

## Backlog State After Sprint 10

- Stories Done: **85 / 90**
- Remaining: **9 stories, ~60 SP**
- Sprints to completion (@ 22.8 SP avg): **~2.6 sprints**
