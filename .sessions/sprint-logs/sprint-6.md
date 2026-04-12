# Sprint 6 Log — PDF Certificate, Stats, Export View & Notification Templates

**Sprint:** 6
**Dates:** 2026-04-12 → 2026-04-12 (single-session sprint)
**Goal:** PDF certificate (US-047), certification stats (US-048), export clearances view (US-067), notification template management (US-075), migration verification (TM-3)
**Status:** CLOSED
**Velocity:** 21/22 SP (95%) — TM-3 deferred (2nd sprint)

---

## Stories Delivered

| Story | Title | SP | Status |
|---|---|---|---|
| US-067 | Super-admin views all export clearances | 3 | ✅ Done |
| US-047 | Generate PDF certificate (PDFKit, trilingual) | 5 | ✅ Done |
| US-048 | Certification statistics by region/product (Redis cached) | 5 | ✅ Done |
| US-075 | Manage notification templates (DB-override + file fallback) | 8 | ✅ Done |
| TM-3 | Migration chain verification | 1 | ⏳ Deferred (2nd sprint) |

**Total delivered:** 21 SP / 22 planned

---

## New Endpoints

| Method + Path | Story | Role |
|---|---|---|
| `GET /export-documents?page=&limit=` | US-067 | super-admin |
| `GET /certifications/stats?from=&to=` | US-048 | super-admin |
| `GET /certifications/:id/certificate.pdf` | US-047 | cooperative-admin, certification-body, super-admin |
| `GET /notification-templates?code=&channel=&language=` | US-075 | super-admin |
| `GET /notification-templates/:id` | US-075 | super-admin |
| `POST /notification-templates` | US-075 | super-admin |
| `PUT /notification-templates/:id` | US-075 | super-admin |
| `DELETE /notification-templates/:id` | US-075 | super-admin |
| `POST /notification-templates/seed` | US-075 | super-admin |

---

## New Files

| File | Purpose |
|---|---|
| `src/modules/certification/interfaces/certification-stats.interface.ts` | Stats response types |
| `src/modules/certification/dto/stats-query.dto.ts` | Date range query params |
| `src/modules/certification/services/certification-pdf.service.ts` | PDFKit PDF generation (trilingual) |
| `src/modules/notification/dto/create-notification-template.dto.ts` | Create DTO |
| `src/modules/notification/dto/update-notification-template.dto.ts` | Update DTO (PartialType) |
| `src/modules/notification/services/notification-template.service.ts` | CRUD + Redis + file fallback |
| `src/modules/notification/controllers/notification-template.controller.ts` | Admin CRUD endpoints |
| `assets/fonts/README.md` | Font download instructions for PDF runtime |
| `test/unit/certification/certification-pdf.service.spec.ts` | 6 tests — PDFKit mock |
| `test/unit/notification/notification-template.service.spec.ts` | 9 tests — CRUD + cache |

---

## Modified Files

| File | Change |
|---|---|
| `src/modules/certification/services/export-document.service.ts` | Added `findAll()` |
| `src/modules/certification/controllers/export-document.controller.ts` | Added `GET /` (super-admin) |
| `src/modules/certification/services/certification.service.ts` | Added `getStats()`, injected `CACHE_MANAGER` |
| `src/modules/certification/controllers/certification.controller.ts` | Added `GET /stats`, `GET /:id/certificate.pdf`, injected `CertificationPdfService` |
| `src/modules/certification/certification.module.ts` | Registered `CertificationPdfService` |
| `src/modules/notification/services/notification.service.ts` | Updated `send()` with Redis→DB→file lookup, injected `CACHE_MANAGER` |
| `src/modules/notification/notification.module.ts` | Added `CacheModule`, registered `NotificationTemplateService` + controller |
| `docs/project-management/PRODUCT-BACKLOG.md` | Fixed summary table (Epic 4: 85→80 SP, Done counts corrected: 49→54 stories) |
| `test/unit/certification/certification.service.spec.ts` | Added `CACHE_MANAGER` mock + `getStats()` tests |
| `test/unit/certification/certification-state-machine.spec.ts` | Added `CACHE_MANAGER` mock |
| `test/unit/certification/export-document.service.spec.ts` | Added `findAll()` tests |
| `test/unit/notification/notification.service.spec.ts` | Added `CACHE_MANAGER` mock + Redis/fallback tests |

---

## Test Coverage Delta

| Metric | Sprint 5 | Sprint 6 | Delta |
|---|---|---|---|
| Suites | 23 | 25 | +2 |
| Tests | 245 | 271 | +26 |
| Statements | 98.41% | 96.1% | -2.31% |
| Branches | 85.79% | 86.44% | +0.65% |
| Functions | 96.96% | 96.72% | -0.24% |
| Lines | 98.31% | 96.24% | -2.07% |

**Coverage note:** Statement/line drop caused by `seedFromFiles()` internals and `fs.existsSync/readFileSync` file fallback paths — not exercisable without live `.hbs` fixture files in test environment. Core business logic paths fully covered.

---

## Key Decisions

1. **PDFKit over Puppeteer** — zero Docker changes, pure Node.js; full Arabic shaping via `pdfkit-arabic` is Phase 2
2. **Single multilingual PDF page** — official Moroccan admin documents carry AR + FR + ZGH designations
3. **Redis 5-min cache for stats** — `stats:certifications:{from|all}:{to|all}`, acceptable staleness for MAPMDREF reporting
4. **DB-override + file fallback for templates** — `onModuleInit` seeds DB from `.hbs` files; API updates persist to DB; rollback = `DELETE /:id`
5. **`jest.mock('fs')` anti-pattern** — blanket fs mock conflicts with TypeORM's `path-scurry` dependency; use real fs with non-existent paths in test env
6. **`CACHE_MANAGER` ripple** — injecting it into a service requires adding a mock to every test module that uses that service

---

## Deferred / Carry-forward to Sprint 7

- **TM-3** (1 SP): 2nd deferral — migration chain verification, requires PostgreSQL
- **Font assets**: `Amiri-Regular.ttf` + `DejaVuSans.ttf` needed in `assets/fonts/` for PDF runtime
- **Backlog update**: Mark US-047, US-048, US-067, US-075 as Done

---

## Sprint 7 Candidates

| Story | Title | SP | Priority |
|---|---|---|---|
| TM-3 | Migration chain verification (carry-over ×2) | 1 | High |
| US-058 | Track QR scan events (deferred from S6) | 5 | Low |
| US-010 | Super-admin deactivates cooperative | 3 | Low |
| US-016 | Manage SDOQ product types (super-admin) | 5 | Medium |
| US-044 | Assign inspectors to inspections | 3 | Medium |
| US-076 | View failed notification counts | 3 | Medium |
| US-086 | Manage user roles and permissions | 5 | High |

**Recommended Sprint 7 capacity:** 21–25 SP (rolling average: 23 SP)
