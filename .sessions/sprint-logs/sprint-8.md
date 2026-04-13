# Sprint 8 Log — Inspector Reads, Post-Harvest Steps, Lab History, Validity Periods, MAPMDREF Export, DLQ Stats

**Sprint:** 8
**Dates:** 2026-04-12 → 2026-04-12
**Status:** CLOSED ✅
**Velocity:** 24/24 SP (100%)

---

## Goal

Deliver inspector read-path completions, post-harvest processing steps, lab test history, SDOQ validity period configuration, MAPMDREF regulatory export, and Kafka DLQ monitoring — closing the remaining high-priority gaps in the product, certification, and admin layers.

---

## Stories Delivered

| ID | Story | SP | Result |
|---|---|---|---|
| US-018 | Inspector views product SDOQ spec | 2 | ✅ Done — JwtAuthGuard only on GET /products/:id; inspector already had access; traceability test added |
| US-019 | Record post-harvest processing steps | 5 | ✅ Done — new ProcessingStep entity, POST/GET /batches/:id/processing-steps, Kafka event product.batch.processing_step_added, migration 010 |
| US-025 | Configure lab test parameters | 1 | ✅ Done — UpdateProductTypeDto via PartialType already inherited labTestParameters; validityDays added as new field |
| US-028 | View lab test history for all batches | 3 | ✅ Done — GET /lab-tests paginated list, cooperative-admin scoped by JWT |
| US-029 | Inspector views lab results during inspection | 2 | ✅ Done — JwtAuthGuard only on GET /lab-tests/:id; inspector already had access; traceability test added |
| US-045 | Configure certification validity periods | 3 | ✅ Done — validityDays column on ProductType, migration 009, UpdateProductTypeDto field |
| US-084 | MAPMDREF exports periodic certification reports | 5 | ✅ Done — GET /certifications/export JSON attachment, 10k cap, date range + status filters |
| US-087 | View Kafka DLQ message counts | 3 | ✅ Done — GET /admin/kafka/dlq-stats, KafkaAdminService, Redpanda Admin HTTP API |

**Total: 24 SP**

---

## Test Results

| Metric | Before | After | Delta |
|---|---|---|---|
| Suites | 27 | 29 | +2 |
| Tests | 293 | 312 | +19 |
| Failures | 0 | 0 | 0 |
| lint | ✅ | ✅ | — |
| typecheck | ✅ | ✅ | — |

### New test files
- `test/unit/product/processing-step.service.spec.ts` — 5 tests
- `test/unit/common/admin.controller.spec.ts` — 2 tests (+ 1 defined)

---

## New Migrations

| # | File | Change |
|---|---|---|
| 009 | `1700000000009-AddProductTypeValidityDays.ts` | ALTER TABLE product.product_type ADD COLUMN validity_days INT NULL |
| 010 | `1700000000010-AddProcessingStep.ts` | CREATE TABLE product.processing_step |

**Status: PENDING** — run `npm run migration:run` after `docker compose up`

---

## New Kafka Events

| Topic | Interface | Publisher |
|---|---|---|
| `product.batch.processing_step_added` | `ProductBatchProcessingStepAddedEvent` | `ProductProducer` |

---

## New API Endpoints

| Method | Path | Roles | Story |
|---|---|---|---|
| POST | /batches/:id/processing-steps | cooperative-admin, cooperative-member | US-019 |
| GET | /batches/:id/processing-steps | cooperative-admin, cooperative-member, inspector, certification-body, super-admin | US-019 |
| GET | /lab-tests | cooperative-admin (scoped), inspector, certification-body, super-admin | US-028 |
| GET | /certifications/export | super-admin, certification-body | US-084 |
| GET | /admin/kafka/dlq-stats | super-admin | US-087 |

---

## Key Decisions

1. **US-018 + US-029 were already satisfied**: Existing endpoints used `JwtAuthGuard` only (no `RolesGuard`). All authenticated users including inspectors already had access. Closed with traceability tests, no code change to guards.
2. **ProcessingStep immutability**: No `updatedAt` — append-only, mirrors `CertificationEvent` pattern. Processing steps are immutable facts.
3. **US-045 YAGNI**: `validityDays` stored as reference data only. No server-side enforcement in `CertificationService` — would require cross-module lookup. Frontend uses it to pre-fill the grant form.
4. **US-084 JSON not CSV**: MAPMDREF can consume JSON via Power Query. CSV conversion can be Phase 2 if requested.
5. **KafkaAdminService graceful fallback**: Returns `[]` instead of throwing if Redpanda Admin API unreachable. Admin dashboard stays functional during broker restart.
6. **Story ID mismatch in session state**: Sprint 7's `next_actions` listed US-034/037/040 as Sprint 8 candidates but those IDs in PRODUCT-BACKLOG.md were already Done with different descriptions. Corrected during brainstorm by reading the live backlog.

---

## Carry-forward to Sprint 9

- **Font assets** (no code): Place `assets/fonts/Amiri-Regular.ttf` + `assets/fonts/DejaVuSans.ttf`
- **US-058** (4th deferral): Track QR scan events — public hot path, defer until monitoring layer exists
- **Migrations**: Run migrations 009 + 010 when Docker is available

---

## Backlog After Sprint 8

| Metric | Value |
|---|---|
| Done stories | 71 / 90 |
| Remaining SP | ~106 |
| Sprints to completion (@ 22 SP avg) | ~4.8 |

### Sprint 9 Top Candidates (~22 SP)

| ID | Story | SP | Priority |
|---|---|---|---|
| US-017 | Upload supporting documents for product | 3 | Medium |
| US-026 | Upload PDF lab report | 3 | Medium |
| US-068 | Generate PDF export certificate | 5 | Medium |
| US-081 | Super-admin dashboard metrics | 8 | Medium |
| US-083 | Cooperative compliance report | 5 | Medium |
| US-089 | Active certifications report for ONSSA | 3 | Medium |

---

## Velocity History (Sprints 2–8)

| Sprint | Planned | Completed | % |
|---|---|---|---|
| 2 | 30 | 30 | 100% |
| 3 | 21 | 21 | 100% |
| 4 | 21 | 21 | 100% |
| 5 | 23 | 22 | 96% |
| 6 | 22 | 21 | 95% |
| 7 | 20 | 20 | 100% |
| 8 | 24 | 24 | 100% |
| **Rolling avg** | | **22.4 SP** | **98.7%** |
