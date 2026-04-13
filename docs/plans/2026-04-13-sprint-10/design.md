# Sprint 10 Design — Admin Dashboard, Analytics & Audit

**Date:** 2026-04-13
**Sprint:** 10
**Stories:** US-081, US-082, US-085, US-088
**Story Points:** 24 SP
**Theme:** Admin Dashboard, Certification Analytics, User Audit Logs, Notification Delivery Rates

---

## Scope Decision

Option B selected: US-081 + US-082 + US-085 + US-088 = 24 SP
US-090 (system settings, 8 SP, High priority) deferred to Sprint 11.

---

## Story Designs

### US-081 — Super-admin Dashboard (8 SP)

**As a super-admin, I want a dashboard showing key platform metrics so that I have an operational overview.**

**Approach:** Counts-only, single endpoint, Redis-cached.

**Endpoint:** `GET /admin/dashboard`
**Roles:** super-admin only

**Response shape:**

```ts
{
  success: true,
  data: {
    cooperatives: { total: number, verified: number, pending: number, suspended: number },
    products: { total: number },
    certifications: { total: number, granted: number, pending: number, denied: number, revoked: number },
    labTests: { total: number, passed: number, failed: number },
    notifications: { total: number, sent: number, failed: number }
  }
}
```

**Implementation:**

- New `DashboardService` in `src/common/services/dashboard.service.ts`
- Raw SQL via `DataSource` — one query per module schema, no cross-module service imports
- Redis cache key: `dashboard:admin`, TTL 300s
- New method `getDashboard()` on existing `AdminController` (`src/common/controllers/admin.controller.ts`)
- `DashboardService` registered in `AppModule`

**SQL pattern (per module):**

```sql
SELECT COUNT(*) AS total,
  COUNT(*) FILTER (WHERE status = 'VERIFIED') AS verified,
  COUNT(*) FILTER (WHERE status = 'PENDING') AS pending,
  COUNT(*) FILTER (WHERE status = 'SUSPENDED') AS suspended
FROM cooperative.cooperative
```

---

### US-082 — Certification Analytics by Region/Product Type (8 SP)

**As a super-admin, I want certification analytics broken down by region and product type so that I can identify geographic trends.**

**Approach:** New endpoint extending existing `CertificationService` stats pattern.

**Endpoint:** `GET /certifications/analytics?from=&to=`
**Roles:** super-admin, certification-body
**Route position:** registered before `GET /certifications/:id` (literal-before-param rule)

**Response shape:**

```ts
{
  success: true,
  data: {
    byRegion: [
      { region: string, granted: number, denied: number, revoked: number, total: number }
    ],
    byProductType: [
      { productType: string, granted: number, denied: number, revoked: number, total: number }
    ]
  }
}
```

**Implementation:**

- New method `getAnalytics(from?: Date, to?: Date)` in `CertificationService`
- Two raw SQL `GROUP BY` queries (region, product_type) with optional `created_at` date range
- Redis cache key: `analytics:certifications:{from|all}:{to|all}`, TTL 300s
- New `GET /analytics` route in `CertificationController` (before `/:id`)
- Reuse existing `ReportQueryDto` for `?from=&to=` parsing

**SQL pattern:**

```sql
SELECT region,
  COUNT(*) FILTER (WHERE current_status = 'GRANTED') AS granted,
  COUNT(*) FILTER (WHERE current_status = 'DENIED') AS denied,
  COUNT(*) FILTER (WHERE current_status = 'REVOKED') AS revoked,
  COUNT(*) AS total
FROM certification.certification
WHERE (:from IS NULL OR created_at >= :from)
  AND (:to IS NULL OR created_at <= :to)
GROUP BY region
ORDER BY total DESC
```

---

### US-085 — User Activity Logs (5 SP)

**As a super-admin, I want to view user activity logs so that platform usage is auditable.**

**Approach:** NestJS HTTP interceptor in `common` — logs every authenticated request to `common.audit_log` table.

**New entity:** `AuditLog` (`src/common/entities/audit-log.entity.ts`)

- Schema: `common`, table: `audit_log`
- Columns: `id` (UUID PK), `userId` (varchar 36), `userEmail` (varchar 255 nullable), `userRole` (varchar 100), `method` (varchar 10), `path` (varchar 500), `statusCode` (int), `ip` (varchar 45), `createdAt` (timestamp UTC)
- No `updatedAt` — append-only, mirrors `CertificationEvent` immutability pattern

**New migration:** `1700000000014-AddAuditLog`

- `CREATE TABLE common.audit_log (...)`
- Index on `user_id` for lookup by user
- Index on `created_at` for date-range pagination

**New interceptor:** `AuditInterceptor` (`src/common/interceptors/audit.interceptor.ts`)

- Implements `NestInterceptor`
- Reads `userId`, `email`, `roles[0]` from JWT `user` object on request
- Fires on `callHandler.handle().pipe(tap(...))` — captures `statusCode` from response
- Skips unauthenticated requests (no `req.user`) — public endpoints (QR verify, health) not logged
- Registered globally in `AppModule` via `APP_INTERCEPTOR`
- Writes async (fire-and-forget) — does not block response

**New endpoint:** `GET /admin/audit-logs`

- **Roles:** super-admin only
- **Query params:** `userId?`, `from?`, `to?`, `page?` (default 1), `limit?` (default 20, max 100)
- **Response:** paginated list with `meta: { page, limit, total }`
- Served by `AdminController` via new `AuditLogService`

**CNDP note:** `userId` + `userEmail` stored for regulatory audit trail — lawful basis is platform security and legal compliance obligation.

---

### US-088 — Notification Delivery Rates (3 SP)

**As a super-admin, I want to view notification delivery rates so that communication effectiveness is monitored.**

**Approach:** Extend existing `GET /notifications/stats` — no new endpoint, no new migration.

**Change:** Add `deliveryRate: number` (0–100 integer) to each channel entry in the stats response.

**Formula:**

```ts
const deliveryRate = sent + failed === 0 ? 0 : Math.round((sent / (sent + failed)) * 100);
```

**Updated response shape:**

```ts
{
  data: {
    total: number,
    byStatus: { sent: number, failed: number, pending: number },
    byChannel: [
      { channel: 'email' | 'sms', sent: number, failed: number, deliveryRate: number }
    ]
  }
}
```

**Files changed:** `NotificationService.getStats()` + `notification-stats.interface.ts` + existing unit tests extended.

---

## Architecture Notes

### No cross-module service imports

- `DashboardService` uses raw SQL via `DataSource` — queries multiple schemas directly. This is acceptable in a modular monolith where the monolith owns all schemas. No service from another module is imported.
- `AuditInterceptor` writes to `common.audit_log` — entirely within `common`, no module boundary crossed.

### Route ordering (confirmed pattern)

- `GET /certifications/analytics` registered before `GET /certifications/:id`
- `GET /admin/audit-logs` is a distinct path — no param collision

### Redis cache keys (Sprint 10 additions)

| Key                                              | TTL  | Invalidation    |
| ------------------------------------------------ | ---- | --------------- |
| `dashboard:admin`                                | 300s | TTL expiry only |
| `analytics:certifications:{from\|all}:{to\|all}` | 300s | TTL expiry only |

### New migration

| ID            | Name        | Change                                    |
| ------------- | ----------- | ----------------------------------------- |
| 1700000000014 | AddAuditLog | CREATE TABLE common.audit_log + 2 indexes |

---

## Out of Scope (YAGNI)

- US-090 system settings — deferred to Sprint 11 (High priority, 8 SP)
- US-058 QR scan tracking — Low priority, deferred
- Sparkline time-series for dashboard — Phase 2
- Per-template delivery rates — Phase 2
- Audit log export to CSV/PDF — Phase 2
- Real-time dashboard via WebSockets — Phase 3

---

## Decisions Made

| Decision                                            | Rationale                                                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| AuditInterceptor fire-and-forget write              | Audit log must never block the response path                                                |
| AuditInterceptor skips unauthenticated requests     | Public endpoints (QR verify, health checks) generate noise and have no userId               |
| DashboardService raw SQL (not cross-module imports) | Modular monolith rule: no cross-module service imports; DataSource is shared infrastructure |
| US-088 extends stats (not new endpoint)             | 3 SP story — arithmetic on existing data; new endpoint is over-engineering                  |
| AuditLog no updatedAt                               | Append-only immutability mirrors CertificationEvent pattern                                 |
