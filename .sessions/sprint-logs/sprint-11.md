# Sprint 11 Log — System Config, Reports, Preferences

**Sprint:** 11  
**Dates:** 2026-04-14 – 2026-04-27  
**Goal:** US-090 system settings config, US-050 compliance CSV export, US-077 notification preferences, US-020 product export, US-070 clearances report, US-069 HS code assignments  
**Planned SP:** 24  
**Completed SP:** 24  
**Status:** DONE (completed Day 1)

---

## Stories

| Story | Title | SP | Status |
|---|---|---|---|
| US-090 | System settings config (campaign/certification/platform) | 8 | ✅ Done |
| US-050 | Export certification compliance report | 5 | ✅ Done |
| US-077 | Notification preferences | 3 | ✅ Done |
| US-020 | Export product registry data | 3 | ✅ Done |
| US-070 | Export clearances by destination country | 3 | ✅ Done |
| US-069 | View HS code assignments | 2 | ✅ Done |
| **Total** | | **24** | **24/24** |

---

## Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| Sprint velocity | 24 SP (full) | 3-sprint streak at 24 SP |
| US-090 settings design | Grouped domain endpoints GET/PATCH /admin/settings/{group} | Explicit typed DTOs over magic key strings |
| US-077 storage | `notification.notification_preference` table | Zero cross-module dependency |
| CSV generation | Manual string templates | No new npm packages |
| Zero Kafka events | All 6 stories are read/config operations | No inter-module state changes needed |

---

## New Migrations Applied

| # | Name | Description | Status |
|---|---|---|---|
| 015 | AddSystemSetting | `common.system_setting` PK(group, key) + 7 seeded defaults | ✅ Applied |
| 016 | AddNotificationPreference | `notification.notification_preference (user_id PK, channels TEXT[], language)` | ✅ Applied |

---

## New Endpoints

| Method | Route | Story | Roles |
|--------|-------|-------|-------|
| GET | /admin/settings/campaign | US-090 | super-admin |
| PATCH | /admin/settings/campaign | US-090 | super-admin |
| GET | /admin/settings/certification | US-090 | super-admin |
| PATCH | /admin/settings/certification | US-090 | super-admin |
| GET | /admin/settings/platform | US-090 | super-admin |
| PATCH | /admin/settings/platform | US-090 | super-admin |
| GET | /certifications/compliance-export | US-050 | super-admin, certification-body |
| GET | /notifications/preferences/me | US-077 | any authenticated |
| PUT | /notifications/preferences/me | US-077 | any authenticated |
| GET | /products/export | US-020 | super-admin |
| GET | /export-documents/clearances-report | US-070 | super-admin, customs-agent |
| GET | /export-documents/hs-codes | US-069 | cooperative-admin, customs-agent, super-admin |

---

## Test Results

| Metric | Before | After |
|--------|--------|-------|
| Suites | 35 | 36 |
| Tests | 357 | 382 (+25) |
| Failures | 0 | 0 |
| lint | ✅ | ✅ |
| typecheck | ✅ | ✅ |

---

## Velocity History

| Sprint | Planned | Completed | % |
|---|---|---|---|
| Sprint 8 | 24 | 24 | 100% |
| Sprint 9 | 22 | 22 | 100% |
| Sprint 10 | 24 | 24 | 100% |
| **Sprint 11** | **24** | **24** | **100%** |

Rolling avg (S8–S11): **23.5 SP**

---

## Carry-forward to Sprint 12

- **Font assets still needed at runtime:** `assets/fonts/Amiri-Regular.ttf` + `assets/fonts/DejaVuSans.ttf` (carry-forward since Sprint 8)
- **Remaining backlog:** US-053 (QR offline, 13 SP), US-058 (QR scan events, 5 SP), US-027 (ONSSA lab integration, 13 SP Phase 2)
- **~31 SP remaining → ~1.4 sprints to v1**
