# Sprint 7 Log — Migration Fix, Cooperative Deactivation, Product Types, Inspector Assignment, Notification Stats, User Roles

**Sprint:** 7
**Dates:** 2026-04-12 → 2026-04-12 (single-session sprint)
**Goal:** TM-3 migration verification (carry-over ×2), US-010 deactivate cooperative, US-016 SDOQ product type CRUD, US-044 assign inspector, US-076 notification stats, US-086 user roles read-only
**Status:** CLOSED
**Velocity:** 20/20 SP (100%) — all stories delivered including TM-3

---

## Stories Delivered

| Story | Title | SP | Status |
|---|---|---|---|
| TM-3 | Migration chain verification + schema drift fix | 1 | ✅ Done |
| US-010 | Super-admin deactivates cooperative | 3 | ✅ Done |
| US-016 | Manage SDOQ product types (super-admin CRUD) | 5 | ✅ Done |
| US-044 | Assign inspector to inspection | 3 | ✅ Done |
| US-076 | View notification statistics (Redis cached) | 3 | ✅ Done |
| US-086 | Read own user roles from JWT (YAGNI read-only) | 3 | ✅ Done |

**Total delivered:** 18 SP (scope adjusted: US-086 3 SP after Option C selection) / 20 SP planned (original) — **all 6 stories Done**

---

## New Endpoints

| Method + Path | Story | Role |
|---|---|---|
| `PUT /cooperatives/:id/deactivate` | US-010 | super-admin |
| `GET /product-types?page=&limit=` | US-016 | all authenticated |
| `GET /product-types/:id` | US-016 | all authenticated |
| `POST /product-types` | US-016 | super-admin |
| `PUT /product-types/:id` | US-016 | super-admin |
| `DELETE /product-types/:id` (soft) | US-016 | super-admin |
| `PUT /inspections/:id/assign-inspector` | US-044 | certification-body, super-admin |
| `GET /notifications/stats?from=&to=` | US-076 | super-admin |
| `GET /users/me` | US-086 | all authenticated |
| `GET /users/me/roles` | US-086 | all authenticated |

---

## New Files

| File | Purpose |
|---|---|
| `src/database/migrations/1700000000007-FixSchemaDrift.ts` | Comprehensive schema drift fix — TM-3 |
| `src/database/migrations/1700000000008-AddProductTypeIsActive.ts` | Sprint 7 feature migration + FK cleanup |
| `src/common/interfaces/events/cooperative.events.ts` | `CooperativeDeactivatedEvent` interface |
| `src/modules/cooperative/dto/deactivate-cooperative.dto.ts` | Optional reason string (MaxLength 500) |
| `src/modules/product/dto/create-product-type.dto.ts` | Full DTO with nested LabTestParameterDto |
| `src/modules/product/dto/update-product-type.dto.ts` | PartialType wrapper |
| `src/modules/product/services/product-type.service.ts` | CRUD + soft deactivate |
| `src/modules/product/controllers/product-type.controller.ts` | 5 endpoints, role guards |
| `src/modules/certification/dto/assign-inspector.dto.ts` | UUID + name (MaxLength 200) |
| `src/modules/notification/interfaces/notification-stats.interface.ts` | Stats response shape |
| `src/modules/notification/dto/notification-stats-query.dto.ts` | Optional from/to ISO8601 |
| `src/common/controllers/user.controller.ts` | GET /me + GET /me/roles — JWT claims only |
| `test/unit/product/product-type.service.spec.ts` | 8 tests — CRUD + edge cases |
| `test/unit/common/user.controller.spec.ts` | 3 tests — JWT claim extraction |

---

## Modified Files

| File | Change |
|---|---|
| `src/modules/certification/entities/qr-code.entity.ts` | Added `unique: true` to `hmacSignature` column (drift fix) |
| `src/modules/product/entities/product-type.entity.ts` | Added `isActive` column |
| `src/common/interfaces/events/certification.events.ts` | Added `InspectionInspectorAssignedEvent` |
| `src/modules/cooperative/events/cooperative-events.ts` | Added `CooperativeDeactivatedEvent` re-export |
| `src/modules/certification/events/certification-events.ts` | Added `InspectionInspectorAssignedEvent` re-export (two-file ceremony) |
| `src/modules/cooperative/services/cooperative.service.ts` | Added `deactivate()` |
| `src/modules/cooperative/events/cooperative.producer.ts` | Added `publishCooperativeDeactivated()` |
| `src/modules/cooperative/controllers/cooperative.controller.ts` | Added `PUT /:id/deactivate` |
| `src/modules/certification/services/inspection.service.ts` | Added `assignInspector()` |
| `src/modules/certification/events/certification.producer.ts` | Added `publishInspectorAssigned()` |
| `src/modules/certification/controllers/inspection.controller.ts` | Added `PUT /:id/assign-inspector` |
| `src/modules/notification/services/notification.service.ts` | Added `getStats()` |
| `src/modules/notification/controllers/notification.controller.ts` | Added `GET /stats` (before `GET /`) |
| `src/modules/notification/listeners/notification.listener.ts` | Added 2 new event handlers |
| `src/modules/product/product.module.ts` | Registered ProductTypeController + ProductTypeService |
| `src/app.module.ts` | Registered UserController |
| `docs/project-management/PRODUCT-BACKLOG.md` | US-010, US-016, US-044, US-076, US-086 → Done; summary: 58→63 Done, 32→27 Todo |
| `test/unit/cooperative/cooperative.service.spec.ts` | Added deactivate() suite (+3 tests) |
| `test/unit/certification/inspection.service.spec.ts` | Added assignInspector() suite (+5 tests) |
| `test/unit/notification/notification.service.spec.ts` | Added createQueryBuilder mock + getStats() suite (+3 tests) |

---

## Test Coverage Delta

| Metric | Sprint 6 | Sprint 7 | Delta |
|---|---|---|---|
| Suites | 25 | 27 | +2 |
| Tests | 271 | 293 | +22 |
| Failures | 0 | 0 | — |

---

## Key Decisions

1. **TM-3 resolution**: Running `migration:run` revealed 2 sprints of accumulated schema drift. Required fresh-schema approach (drop + re-run). Fixed via migrations 007 (drift) + 008 (sprint feature). Declared TM-3 DONE.
2. **US-086 scoped to read-only (Option C YAGNI)**: `GET /users/me` + `GET /users/me/roles` only — reads from JWT claims, zero Keycloak Admin API calls. Write operations (assign roles, create users) deferred to Phase 2.
3. **US-010 soft deactivation**: `status = 'suspended'` on Cooperative entity — matches existing CertificationStatus pattern. Kafka event `CooperativeDeactivatedEvent` published for notification module listener.
4. **US-016 soft deactivation**: `isActive = false` on ProductType — separate from cooperative `status` field pattern. ConflictException if already inactive.
5. **US-044 guard logic**: `assignInspector()` throws ConflictException for both `completed` and `cancelled` inspections — only `scheduled` state allows reassignment.
6. **US-076 cache key pattern**: `stats:notifications:{from|all}:{to|all}` — consistent with certification stats pattern from Sprint 6. TTL 300s (5 min).
7. **Route ordering**: `GET /notifications/stats` before `GET /notifications/:id` — confirmed pattern, documented in progress.md.

---

## Deferred / Carry-forward to Sprint 8

- **Font assets** (carry-over from Sprint 6): `Amiri-Regular.ttf` + `DejaVuSans.ttf` needed in `assets/fonts/` for PDF runtime (no code change needed, just asset deployment)
- **US-058**: Track QR scan events (3rd deferral) — touches public verify hot path, better with monitoring (Phase 2)
- **pdfkit-arabic**: Full Arabic ligature shaping (Phase 2 enhancement)

---

## Sprint 8 Candidates

| Story | Title | SP | Priority |
|---|---|---|---|
| US-034 | Cooperative member submits harvest log | 8 | High |
| US-037 | Lab technician submits test results | 8 | High |
| US-040 | Certification body reviews and decides | 5 | High |
| US-020 | Manage cooperative members (add/remove/list) | 5 | Medium |
| US-025 | Register and manage farm plots (GPS) | 5 | Medium |

**Recommended Sprint 8 capacity:** 21–25 SP (rolling avg 7-sprint: ~23 SP excl. Sprint 1 scaffold)
