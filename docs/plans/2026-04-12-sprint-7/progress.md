# Sprint 7 Execution Progress

**Plan:** `docs/plans/2026-04-12-sprint-7/plan.md`
**Last updated:** 2026-04-12

---

## Status

| Task | Title                                                                       | Status       |
| ---- | --------------------------------------------------------------------------- | ------------ |
| 1    | TM-3 — Run migration:run and verify chain                                   | ✅ completed |
| 2    | Fix schema drift — migration 007 (FixSchemaDrift)                           | ✅ completed |
| 3    | Migration 008 — AddProductTypeIsActive                                      | ✅ completed |
| 4    | US-010 — CooperativeDeactivatedEvent interface                              | ✅ completed |
| 5    | US-010 — DeactivateCooperativeDto                                           | ✅ completed |
| 6    | US-010 — CooperativeService.deactivate()                                    | ✅ completed |
| 7    | US-010 — CooperativeProducer.publishCooperativeDeactivated()                | ✅ completed |
| 8    | US-010 — PUT /:id/deactivate endpoint                                       | ✅ completed |
| 9    | US-010 — Notification listener handlers (deactivated + inspector assigned)  | ✅ completed |
| 10   | US-016 — ProductType entity column isActive                                 | ✅ completed |
| 11   | US-016 — CreateProductTypeDto + UpdateProductTypeDto                        | ✅ completed |
| 12   | US-016 — ProductTypeService (findAll, findById, create, update, deactivate) | ✅ completed |
| 13   | US-016 — ProductTypeController (5 endpoints)                                | ✅ completed |
| 14   | US-016 — Register in ProductModule                                          | ✅ completed |
| 15   | US-044 — InspectionInspectorAssignedEvent interface + barrel                | ✅ completed |
| 16   | US-044 — AssignInspectorDto                                                 | ✅ completed |
| 17   | US-044 — InspectionService.assignInspector()                                | ✅ completed |
| 18   | US-044 — CertificationProducer.publishInspectorAssigned()                   | ✅ completed |
| 19   | US-044 — PUT /:id/assign-inspector endpoint                                 | ✅ completed |
| 20   | US-076 — NotificationStats interface                                        | ✅ completed |
| 21   | US-076 — NotificationStatsQueryDto                                          | ✅ completed |
| 22   | US-076 — NotificationService.getStats()                                     | ✅ completed |
| 23   | US-076 — GET /notifications/stats endpoint                                  | ✅ completed |
| 24   | US-086 — UserController (GET /users/me + GET /users/me/roles)               | ✅ completed |
| 25   | US-086 — Register UserController in AppModule                               | ✅ completed |
| 26   | Tests — cooperative.service.spec.ts (deactivate suite)                      | ✅ completed |
| 27   | Tests — product-type.service.spec.ts (new file, 8 tests)                    | ✅ completed |
| 28   | Tests — inspection.service.spec.ts (assignInspector suite)                  | ✅ completed |
| 29   | Tests — notification.service.spec.ts (getStats suite)                       | ✅ completed |
| 30   | Tests — user.controller.spec.ts (new file, 3 tests)                         | ✅ completed |

---

## Batch Log

### Batch 1 (Tasks 1–3) — TM-3 Migration Verification — 2026-04-12

- ✅ Task 1: Ran `migration:run` against live PostgreSQL (docker compose up -d postgresql)
- ✅ Task 2: **MAJOR FIND** — schema drift detected across migrations 001–006 (old `certification_types` JSONB vs new `certification_type` varchar, inspection_report restructured, export_document restructured, `hmac_signature` missing unique constraint, etc.). Created `1700000000007-FixSchemaDrift.ts` — comprehensive drift correction
- ✅ Task 3: Created `1700000000008-AddProductTypeIsActive.ts` — adds `is_active boolean NOT NULL DEFAULT true` to `product.product_type`. Also fixed remaining FK constraint naming
- Verification: lint ✅ typecheck ✅ test ✅ (271 tests passing)

**TM-3 note:** Required dropping all 4 domain schemas + migration table and re-running fresh due to pre-existing schema state. Also fixed `QrCode.hmacSignature` missing `unique: true` in entity decorator. **TM-3 officially DONE after 2 sprints of deferral.**

---

### Batch 2 (Tasks 4–9) — US-010 Deactivate Cooperative — 2026-04-12

- ✅ Task 4: Added `CooperativeDeactivatedEvent` to `src/common/interfaces/events/cooperative.events.ts` and barrel `src/modules/cooperative/events/cooperative-events.ts`
- ✅ Task 5: Created `src/modules/cooperative/dto/deactivate-cooperative.dto.ts` — `{ reason?: string }` with `@IsOptional @IsString @MaxLength(500)`
- ✅ Task 6: Added `deactivate(id, deactivatedBy, reason, correlationId)` to `CooperativeService` — sets `status = 'suspended'`, throws `ConflictException` if already suspended
- ✅ Task 7: Added `publishCooperativeDeactivated()` to `CooperativeProducer`
- ✅ Task 8: Added `PUT /:id/deactivate` to `CooperativeController`
- ✅ Task 9: Added `handleCooperativeDeactivated()` and `handleInspectorAssigned()` to `NotificationListener` (pre-loaded InspectionInspectorAssignedEvent from certification events)
- Verification: lint ✅ typecheck ✅ test ✅

---

### Batch 3 (Tasks 10–14) — US-016 SDOQ Product Types — 2026-04-12

- ✅ Task 10: Added `@Column({ name: 'is_active', type: 'boolean', default: true }) isActive: boolean` to `ProductType` entity
- ✅ Task 11: Created `CreateProductTypeDto` (full with nested `LabTestParameterDto`, trilingual names, certificationType enum) + `UpdateProductTypeDto` (PartialType)
- ✅ Task 12: Created `ProductTypeService` — `findAll()`, `findById()`, `create()`, `update()`, `deactivate()` (soft — `isActive = false`)
- ✅ Task 13: Created `ProductTypeController` — 5 endpoints (GET list, GET by id, POST, PUT, DELETE/deactivate) all with correct role guards
- ✅ Task 14: Registered `ProductTypeController` + `ProductTypeService` in `ProductModule`
- Verification: lint ✅ typecheck ✅ test ✅

---

### Batch 4 (Tasks 15–19) — US-044 Assign Inspector — 2026-04-12

- ✅ Task 15: Added `InspectionInspectorAssignedEvent` to `src/common/interfaces/events/certification.events.ts` AND `src/modules/certification/events/certification-events.ts` (two-file ceremony)
- ✅ Task 16: Created `src/modules/certification/dto/assign-inspector.dto.ts` — `{ inspectorId: string (UUID), inspectorName: string (MaxLength 200) }`
- ✅ Task 17: Added `assignInspector()` to `InspectionService` — guards against completed/cancelled status (ConflictException), updates inspectorId/Name, publishes Kafka event
- ✅ Task 18: Added `publishInspectorAssigned()` to `CertificationProducer`
- ✅ Task 19: Added `PUT /:id/assign-inspector` to `InspectionController` (registered BEFORE `GET /:id` to prevent NestJS route collision)
- Verification: lint ✅ typecheck ✅ test ✅

---

### Batch 5 (Tasks 20–25) — US-076 + US-086 — 2026-04-12

- ✅ Task 20: Created `src/modules/notification/interfaces/notification-stats.interface.ts` — `NotificationStats { total, byStatus, from, to, generatedAt }`
- ✅ Task 21: Created `src/modules/notification/dto/notification-stats-query.dto.ts` — `{ from?: string (ISO8601), to?: string (ISO8601) }`
- ✅ Task 22: Added `getStats(from?, to?)` to `NotificationService` — Redis cache (key `stats:notifications:{from|all}:{to|all}`, TTL 300s), QueryBuilder aggregate with optional date filter
- ✅ Task 23: Added `GET /notifications/stats` to `NotificationController` (registered BEFORE `GET /:id` — same route-ordering pattern as certifications)
- ✅ Task 24: Created `src/common/controllers/user.controller.ts` — `GET /users/me` returns full JWT payload, `GET /users/me/roles` returns `realm_access.roles` array (no Keycloak Admin API calls)
- ✅ Task 25: Registered `UserController` in `AppModule.controllers[]`
- Verification: lint ✅ typecheck ✅ test ✅

---

### Batch 6 (Tasks 26–30) — Tests — 2026-04-12

- ✅ Task 26: `test/unit/cooperative/cooperative.service.spec.ts` — added `deactivate() — US-010` suite: happy path (status → suspended + Kafka event), ConflictException (already suspended), NotFoundException (unknown id) — **+3 tests**
- ✅ Task 27: `test/unit/product/product-type.service.spec.ts` — NEW FILE: `findAll()`, `findById()` (found + not-found), `create()` (success + duplicate ConflictException), `update()` (success + not-found), `deactivate()` (success + already-inactive ConflictException) — **+8 tests**
- ✅ Task 28: `test/unit/certification/inspection.service.spec.ts` — added `assignInspector() — US-044` suite: happy path (update + Kafka publish), ConflictException (completed), ConflictException (cancelled), NotFoundException (unknown id). Also added `fileReport()` test — **+5 tests**
- ✅ Task 29: `test/unit/notification/notification.service.spec.ts` — added `createQueryBuilder: jest.fn()` to mockRepo factory, added `getStats() — US-076` suite: cache hit, DB+cache miss, date range filter — **+3 tests**
- ✅ Task 30: `test/unit/common/user.controller.spec.ts` — NEW FILE: `getMe()` returns full payload, `getMyRoles()` extracts roles, `getMyRoles()` empty array when no roles — **+3 tests**
- Verification: lint ✅ typecheck ✅ test ✅ (**293 tests, 0 failures**)

---

## Final Test Results

| Metric   | Sprint 6 | Sprint 7 | Delta |
| -------- | -------- | -------- | ----- |
| Suites   | 25       | **27**   | +2    |
| Tests    | 271      | **293**  | +22   |
| Failures | 0        | **0**    | —     |

---

## Significant Findings

### TM-3 — Schema Drift (Critical)

Running `migration:run` for the first time revealed major divergence between migrations 001–006 and the current entity definitions. Root cause: entities evolved during Sprints 2–6 without corresponding migrations. Two migrations created to resolve:

- `1700000000007-FixSchemaDrift.ts` — drops obsolete columns, adds current columns, renames FK constraints
- `1700000000008-AddProductTypeIsActive.ts` — Sprint 7 feature + remaining FK cleanup

All migrations now pass cleanly on a fresh schema. `npm run migration:generate -- --check` produces no drift after migration 008.

### Route Ordering Pattern (Confirmed)

`GET /notifications/stats` must be registered before `GET /notifications/:id` — same pattern confirmed for certifications in Sprint 6. NestJS matches route segments greedily; literal segments must precede parameterized ones.

### Two-File Ceremony (Certification Events)

`InspectionInspectorAssignedEvent` required adding to both:

1. `src/common/interfaces/events/certification.events.ts` (shared interface)
2. `src/modules/certification/events/certification-events.ts` (local barrel for producer)

This is documented in CLAUDE.md Known Patterns.
