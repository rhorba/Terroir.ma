# Sprint 11 Design — "System Config, Reports, Preferences"

**Date:** 2026-04-13  
**Sprint:** 11  
**Velocity target:** 24 SP  
**Sprint dates:** 2026-04-14 – 2026-04-27

---

## Stories in Scope

| Story     | Title                                    | Module        | SP     | New entities                           |
| --------- | ---------------------------------------- | ------------- | ------ | -------------------------------------- |
| US-090    | System settings config                   | common        | 8      | `common.system_setting`                |
| US-050    | Export certification compliance report   | certification | 5      | none                                   |
| US-077    | Notification preferences                 | notification  | 3      | `notification.notification_preference` |
| US-020    | Export product registry data             | product       | 3      | none                                   |
| US-070    | Export clearances by destination country | certification | 3      | none                                   |
| US-069    | View HS code assignments                 | certification | 2      | none                                   |
| **Total** |                                          |               | **24** |                                        |

---

## Architecture Decisions

- **No Kafka events needed** — all 6 stories are read/config operations; no inter-module state changes.
- **US-090 backing store:** single `common.system_setting` key-value table, grouped by domain. Three typed DTOs map groups to typed fields. PATCH does bulk upsert; Redis 300 s cache per group, invalidated on PATCH.
- **US-077 storage:** `notification.notification_preference` table keyed by `user_id` (Keycloak `sub` claim). No Keycloak Admin API dependency. GET returns stored row or in-memory defaults if missing.
- **CSV exports (US-050, US-020, US-070):** manual template-string row generation — no new npm packages. `Content-Type: text/csv`, `Content-Disposition: attachment`.
- **US-069 scoping:** `cooperative-admin` JWT claim `cooperativeId` used to scope query. `customs-agent` and `super-admin` see all.
- **Module isolation preserved:** no cross-module service imports. All new endpoints are pure reads or settings writes within their own module.

---

## API Contracts

### US-090 — System Settings (super-admin only)

```
GET  /admin/settings/campaign         → CampaignSettingsDto
PATCH /admin/settings/campaign        ← CampaignSettingsDto

GET  /admin/settings/certification    → CertificationSettingsDto
PATCH /admin/settings/certification   ← CertificationSettingsDto

GET  /admin/settings/platform         → PlatformSettingsDto
PATCH /admin/settings/platform        ← PlatformSettingsDto
```

**CampaignSettingsDto**

```typescript
currentCampaignYear: string; // e.g. "2025-2026"
campaignStartMonth: number; // 1–12, default 10 (October)
campaignEndMonth: number; // 1–12, default 9 (September)
```

**CertificationSettingsDto**

```typescript
defaultValidityDays: number; // default 365
maxRenewalGraceDays: number; // default 90
```

**PlatformSettingsDto**

```typescript
maintenanceMode: boolean; // default false
supportEmail: string; // default "support@terroir.ma"
```

---

### US-050 — Compliance Export (super-admin, certification-body)

```
GET /certifications/compliance-export?format=csv&from=&to=&status=
→ Content-Type: text/csv
→ Content-Disposition: attachment; filename="compliance-{YYYY-MM-DD}.csv"
```

CSV columns: `certificationNumber, cooperativeName, productTypeCode, regionCode, certificationType, currentStatus, validFrom, validUntil, grantedAt`

Must be registered **before** `GET /certifications/:id` in the controller.

---

### US-077 — Notification Preferences (any authenticated role)

```
GET /notifications/preferences/me   → NotificationPreferenceDto
PUT /notifications/preferences/me   ← { channels: ('email'|'sms')[], language: 'ar'|'fr'|'zgh' }
```

- GET returns stored row or defaults (`channels: ['email'], language: 'fr'`) if no row exists.
- PUT does upsert (INSERT … ON CONFLICT DO UPDATE).
- `NotificationService.send()` checks preferences before dispatching — channel not in user's list is skipped.

---

### US-020 — Product Export (super-admin)

```
GET /products/export?format=csv&from=&to=
→ Content-Type: text/csv
→ Content-Disposition: attachment; filename="products-{YYYY-MM-DD}.csv"
```

CSV columns: `productId, name, productTypeCode, cooperativeId, regionCode, status, registeredAt`

---

### US-070 — Clearances Report (super-admin, customs-agent)

```
GET /export-documents/clearances-report?format=csv&from=&to=&destinationCountry=
→ Content-Type: text/csv
→ Content-Disposition: attachment; filename="clearances-{YYYY-MM-DD}.csv"
```

CSV columns: `exportDocId, cooperativeName, productTypeCode, destinationCountry, hsCode, clearedAt, status`

---

### US-069 — HS Code Assignments (cooperative-admin, customs-agent, super-admin)

```
GET /export-documents/hs-codes?cooperativeId=&from=&to=
→ { data: [{ exportDocId, certificationId, productTypeCode, hsCode, destinationCountry, assignedAt }] }
```

`cooperative-admin` sees only their own exports (scoped by JWT `cooperativeId` claim).  
Must be registered **before** `GET /export-documents/:id`.

---

## Migrations

### Migration 015 — AddSystemSetting

```sql
CREATE TABLE common.system_setting (
  setting_group  VARCHAR(50)   NOT NULL,
  setting_key    VARCHAR(100)  NOT NULL,
  setting_value  TEXT          NOT NULL,
  updated_by     UUID,
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  PRIMARY KEY (setting_group, setting_key)
);

INSERT INTO common.system_setting VALUES
  ('campaign',      'current_campaign_year',  '2025-2026',           NULL, NOW()),
  ('campaign',      'campaign_start_month',   '10',                  NULL, NOW()),
  ('campaign',      'campaign_end_month',     '9',                   NULL, NOW()),
  ('certification', 'default_validity_days',  '365',                 NULL, NOW()),
  ('certification', 'max_renewal_grace_days', '90',                  NULL, NOW()),
  ('platform',      'maintenance_mode',       'false',               NULL, NOW()),
  ('platform',      'support_email',          'support@terroir.ma',  NULL, NOW());
```

### Migration 016 — AddNotificationPreference

```sql
CREATE TABLE notification.notification_preference (
  user_id    UUID         PRIMARY KEY,
  channels   TEXT[]       NOT NULL DEFAULT '{email}',
  language   VARCHAR(5)   NOT NULL DEFAULT 'fr',
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

---

## Task Breakdown (19 tasks)

### US-090 — System Settings (8 SP)

1. Migration 015: `AddSystemSetting` + seeded defaults
2. `SystemSetting` TypeORM entity (`src/common/entities/system-setting.entity.ts`) + `SystemSettingsService` (read group → typed DTO, bulk upsert, Redis invalidate)
3. Three DTOs: `CampaignSettingsDto`, `CertificationSettingsDto`, `PlatformSettingsDto` (`src/common/dto/settings/`)
4. `GET/PATCH /admin/settings/campaign` + `GET/PATCH /admin/settings/certification` in `AdminController`
5. `GET/PATCH /admin/settings/platform` + Redis 300 s cache per group (key: `settings:{group}`)
6. Unit tests: `SystemSettingsService` (mock repo + mock Redis)

### US-050 — Compliance Export (5 SP)

7. `CertificationService.exportComplianceReport(filters)` → CSV string
8. `GET /certifications/compliance-export` controller endpoint — register before `/:id`
9. Unit tests: filter logic, CSV column order, empty result

### US-077 — Notification Preferences (3 SP)

10. Migration 016: `AddNotificationPreference` + `NotificationPreference` entity (`src/modules/notification/entities/`)
11. `NotificationPreferenceDto` + `GET/PUT /notifications/preferences/me` endpoints
12. `NotificationService.getPreferences(userId)` + `upsertPreferences(userId, dto)` + channel filter in `send()`
13. Unit tests: upsert, defaults on missing row, channel skip logic

### US-020 — Product Export (3 SP)

14. `ProductService.exportProductRegistry(from?, to?)` → CSV string
15. `GET /products/export?format=csv` (role: `super-admin`) + unit tests

### US-070 — Clearances Report (3 SP)

16. `ExportDocumentService.exportClearancesReport(from?, to?, destinationCountry?)` → CSV string
17. `GET /export-documents/clearances-report` (roles: `super-admin`, `customs-agent`) + unit tests

### US-069 — HS Code Assignments (2 SP)

18. `ExportDocumentService.getHsCodeAssignments(cooperativeId?, from?, to?)` — cooperative-admin scoping
19. `GET /export-documents/hs-codes` (roles: `cooperative-admin`, `customs-agent`, `super-admin`) + unit tests — register before `/:id`

---

## Known Risks

| Risk                                                                        | Mitigation                                                                                                 |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `common.system_setting` accessed by multiple modules                        | Only `SystemSettingsService` reads it; other modules call it via `AdminController` REST, not direct import |
| CSV streaming for large datasets                                            | In v1, collect all rows in memory then stream — acceptable for regulatory export volumes                   |
| `NotificationService.send()` preference check adds DB call per notification | Cache preference lookup in Redis (TTL 300 s, invalidated on PUT)                                           |
| Route ordering for new endpoints                                            | Register `/compliance-export`, `/hs-codes`, `/clearances-report` before `/:id` param routes                |
