# Sprint 11 Log — System Config, Reports, Preferences

**Sprint:** 11  
**Dates:** 2026-04-14 – 2026-04-27  
**Goal:** US-090 system settings config, US-050 compliance CSV export, US-077 notification preferences, US-020 product export, US-070 clearances report, US-069 HS code assignments  
**Planned SP:** 24  
**Status:** IN PROGRESS  

---

## Stories

| Story | Title | SP | Status |
|---|---|---|---|
| US-090 | System settings config (campaign/certification/platform) | 8 | Todo |
| US-050 | Export certification compliance report | 5 | Todo |
| US-077 | Notification preferences | 3 | Todo |
| US-020 | Export product registry data | 3 | Todo |
| US-070 | Export clearances by destination country | 3 | Todo |
| US-069 | View HS code assignments | 2 | Todo |
| **Total** | | **24** | |

---

## Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| Sprint velocity | 24 SP (full) | 3-sprint streak at 24 SP; conservative would leave low-priority stories piling up |
| 5 SP story | US-050 (compliance report) | Thematic fit — report-heavy sprint with US-020 + US-070; US-058 QR scan events deferred again |
| US-090 settings design | Grouped domain endpoints (C) | Explicit typed DTOs over magic key strings; 3 endpoint pairs is YAGNI for known settings |
| US-077 storage | `notification.notification_preference` table (A) | Zero cross-module dependency; Keycloak Admin API is Phase 2 |
| CSV generation | Manual string templates | No new npm packages; regulatory export volumes are small |

---

## New Migrations

| # | Name | Description |
|---|---|---|
| 015 | AddSystemSetting | `common.system_setting (group, key, value TEXT, updated_by, updated_at)` PK(group, key) + seed 7 default rows |
| 016 | AddNotificationPreference | `notification.notification_preference (user_id PK, channels TEXT[], language VARCHAR(5), updated_at)` |

---

## Task Checklist (19 tasks)

### US-090 — System Settings (8 SP)
- [ ] Task 1: Migration 015 `AddSystemSetting` + seeded defaults
- [ ] Task 2: `SystemSetting` entity + `SystemSettingsService` (read group → DTO, bulk upsert, Redis invalidate)
- [ ] Task 3: `CampaignSettingsDto` + `CertificationSettingsDto` + `PlatformSettingsDto`
- [ ] Task 4: `GET/PATCH /admin/settings/campaign` + `GET/PATCH /admin/settings/certification`
- [ ] Task 5: `GET/PATCH /admin/settings/platform` + Redis 300 s cache
- [ ] Task 6: Unit tests — `SystemSettingsService`

### US-050 — Compliance Export (5 SP)
- [ ] Task 7: `CertificationService.exportComplianceReport(filters)` → CSV string
- [ ] Task 8: `GET /certifications/compliance-export` endpoint (before `/:id`)
- [ ] Task 9: Unit tests — filter logic, CSV columns, empty result

### US-077 — Notification Preferences (3 SP)
- [ ] Task 10: Migration 016 `AddNotificationPreference` + `NotificationPreference` entity
- [ ] Task 11: `NotificationPreferenceDto` + `GET/PUT /notifications/preferences/me`
- [ ] Task 12: `getPreferences()` + `upsertPreferences()` + channel filter in `send()`
- [ ] Task 13: Unit tests — upsert, defaults, channel skip

### US-020 — Product Export (3 SP)
- [ ] Task 14: `ProductService.exportProductRegistry(from?, to?)` → CSV string
- [ ] Task 15: `GET /products/export?format=csv` + unit tests

### US-070 — Clearances Report (3 SP)
- [ ] Task 16: `ExportDocumentService.exportClearancesReport(from?, to?, destinationCountry?)` → CSV
- [ ] Task 17: `GET /export-documents/clearances-report` + unit tests

### US-069 — HS Code Assignments (2 SP)
- [ ] Task 18: `ExportDocumentService.getHsCodeAssignments(cooperativeId?, from?, to?)`
- [ ] Task 19: `GET /export-documents/hs-codes` + unit tests

---

## Carry-forward from Sprint 10

- **Font assets still needed:** `assets/fonts/Amiri-Regular.ttf` + `assets/fonts/DejaVuSans.ttf` (carry-forward since Sprint 8; runtime-only, no code change)
- **Migration run:** `npm run migration:run` after `docker compose up` — migrations 009–014 already applied this session

---

## Velocity History

| Sprint | Planned | Completed | % |
|---|---|---|---|
| Sprint 8 | 24 | 24 | 100% |
| Sprint 9 | 22 | 22 | 100% |
| Sprint 10 | 24 | 24 | 100% |
| **Sprint 11** | **24** | **0** | — |

Rolling avg (S8–S10): **23.3 SP**

---

## End-of-Sprint Targets

- 91/96 stories Done (6 new Done)
- ~36 SP remaining after Sprint 11
- ~1.6 sprints to v1 completion
- Unit test count: ~357 + estimated +25–30 new tests
