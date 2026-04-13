# Sprint 8 Design — Inspector Reads, Post-Harvest, Lab History, Validity Periods, MAPMDREF Export, DLQ Stats

**Date:** 2026-04-12
**Sprint:** 8
**Target SP:** 24
**Rolling Avg:** 22.5 SP

---

## Stories in Scope

| ID     | Story                                                    | SP  | Priority | Module        |
| ------ | -------------------------------------------------------- | --- | -------- | ------------- |
| US-018 | Inspector views product SDOQ spec                        | 2   | High     | product       |
| US-019 | Record post-harvest processing steps                     | 5   | Medium   | product       |
| US-025 | Configure lab test parameters (folded)                   | 1   | Medium   | product       |
| US-028 | View lab test history for all batches                    | 3   | Medium   | product       |
| US-029 | Inspector views lab results during inspection            | 2   | High     | product       |
| US-045 | Configure certification validity periods by product type | 3   | Medium   | product       |
| US-084 | MAPMDREF exports periodic certification reports          | 5   | High     | certification |
| US-087 | View Kafka DLQ message counts                            | 3   | Medium   | common/admin  |

**Total: 24 SP**

---

## US-018 — Inspector Views Product SDOQ Spec

**Goal:** Inspector role can access `GET /products/:id` to read the full SDOQ specification before/during inspection.

**Decision:** The product module already has `GET /products/:id`. This story adds the `inspector` role to the existing endpoint's `@Roles()` guard. No new entity, no new endpoint.

**Actor:** inspector

**Change:**

- `ProductController.findOne()` — add `inspector` to `@Roles()`
- Unit test: inspector JWT returns 200; non-inspector consumer JWT returns 403

---

## US-019 — Post-Harvest Processing Steps

**Goal:** cooperative-admin/cooperative-member records processing steps (sorting, washing, pressing, etc.) for a batch after harvest and before certification request.

**Decision (Q2):** New `ProcessingStep` entity in product module + Kafka event `product.batch.processing_step_added`. Clean module boundary — no JSONB hack, no bleed into certification ledger.

### Data Model

New table: `product.processing_step`

```
id               UUID PK
batch_id         UUID NOT NULL
cooperative_id   UUID NOT NULL
step_type        VARCHAR(30) NOT NULL  -- enum: SORTING, WASHING, PRESSING, DRYING, PACKAGING, STORAGE, TRANSPORT, OTHER
done_at          TIMESTAMPTZ NOT NULL
done_by          UUID NOT NULL
notes            TEXT NULL
created_at       TIMESTAMPTZ DEFAULT NOW()
```

**No updated_at** — processing steps are immutable records (append-only, mirrors CertificationEvent pattern).

### Step Type Enum

```typescript
export enum ProcessingStepType {
  SORTING = 'SORTING',
  WASHING = 'WASHING',
  PRESSING = 'PRESSING',
  DRYING = 'DRYING',
  PACKAGING = 'PACKAGING',
  STORAGE = 'STORAGE',
  TRANSPORT = 'TRANSPORT',
  OTHER = 'OTHER',
}
```

### API

```
POST /batches/:id/processing-steps   — cooperative-admin, cooperative-member
GET  /batches/:id/processing-steps   — cooperative-admin, cooperative-member, inspector, certification-body
```

### Kafka Event

Topic: `product.batch.processing_step_added`

```typescript
interface BatchProcessingStepAddedEvent {
  eventId: string; // UUID
  correlationId: string;
  timestamp: string; // ISO 8601
  version: number; // 1
  batchId: string;
  cooperativeId: string;
  stepType: ProcessingStepType;
  doneAt: string;
  doneBy: string;
  notes: string | null;
}
```

### Migration

New migration: `1700000000009-AddProcessingStep`

- CREATE TABLE product.processing_step (...)

---

## US-025 — Configure Lab Test Parameters

**Decision (Q3):** YAGNI — fold into existing `PUT /product-types/:id`. `UpdateProductTypeDto` already extends `PartialType(CreateProductTypeDto)`, and `CreateProductTypeDto` contains `labTestParameters: LabTestParameterDto[]`. Zero new code needed at the endpoint or DTO level.

**Change:**

- Verify `UpdateProductTypeDto` inherits `labTestParameters` — it does via `PartialType`
- Add 2 unit tests to `product-type.service.spec.ts`: update with valid `labTestParameters` succeeds; empty array clears parameters
- Mark US-025 Done

**SP: 1**

---

## US-028 — View Lab Test History

**Goal:** cooperative-admin views all lab tests for their batches. super-admin/certification-body see all.

**Decision:** New `findAll()` method on `LabTestService` + paginated list endpoint on `LabTestController`.

### API

```
GET /lab-tests?batchId=&cooperativeId=&status=&page=&limit=
```

**Role scoping:**

- `cooperative-admin`: can only query their own `cooperativeId` (enforce server-side from JWT)
- `super-admin`, `certification-body`, `inspector`: can query any cooperative

### LabTestService.findAll()

```typescript
async findAll(
  cooperativeId: string | null,
  batchId: string | null,
  status: LabTestStatus | null,
  page: number,
  limit: number,
): Promise<PagedResult<LabTest>>
```

Uses `FindOptionsWhere<LabTest>` (not `Partial<LabTest>`) for TypeORM strict typing.

---

## US-029 — Inspector Views Lab Results During Inspection

**Goal:** Inspector can read a specific lab test (and its results) during or after an inspection.

**Decision:** Add `inspector` role to existing `GET /lab-tests/:id` endpoint in `LabTestController`. Also check `lab-test-result.entity.ts` — if the detail endpoint already joins results, no additional change needed.

**Change:**

- `LabTestController.findOne()` — add `inspector` to `@Roles()`
- If no `GET /lab-tests/:id` exists: create it in `LabTestService.findById()` + `LabTestController`
- Unit test: inspector can read; consumer cannot

---

## US-045 — Certification Validity Periods by Product Type

**Goal:** super-admin configures how long a certificate is valid for each product type. Used by certification body officers as a reference when filling `validFrom`/`validUntil` in grant requests.

**Decision:** Add `validityDays: number | null` to `ProductType`. No cross-module enforcement in v1 — the frontend uses the field to pre-fill the grant form. No change to `CertificationService` (YAGNI — avoid cross-module lookup).

**Change:**

- `ProductType` entity: add `@Column({ name: 'validity_days', type: 'int', nullable: true }) validityDays: number | null`
- `UpdateProductTypeDto`: add `@IsOptional() @IsInt() @Min(1) @Max(3650) validityDays?: number`
- Migration: `1700000000010-AddProductTypeValidityDays`
  - `ALTER TABLE product.product_type ADD COLUMN validity_days INT NULL`

---

## US-084 — MAPMDREF Periodic Certification Reports

**Goal:** super-admin and certification-body officers export all certifications as a downloadable JSON file for MAPMDREF regulatory reporting.

**Decision (Q4):** JSON array export with `Content-Disposition: attachment` header and optional date range filter.

### API

```
GET /certifications/export?from=YYYY-MM-DD&to=YYYY-MM-DD&status=GRANTED
```

**Route ordering:** Register `GET /certifications/export` BEFORE `GET /certifications/:id` in `CertificationController` (literal-before-param rule).

**Response headers:**

```
Content-Type: application/json
Content-Disposition: attachment; filename="certifications-export-YYYYMMDD.json"
```

**Response body:**

```json
[
  {
    "certificationId": "uuid",
    "certificationNumber": "TERROIR-IGP-SFI-2025-042",
    "cooperativeId": "uuid",
    "cooperativeName": "...",
    "batchId": "uuid",
    "productTypeCode": "ARGAN_OIL",
    "certificationType": "IGP",
    "regionCode": "SOUSS_MASSA",
    "currentStatus": "GRANTED",
    "requestedAt": "2025-10-01T...",
    "grantedAt": "2025-11-15T...",
    "validFrom": "2025-11-15",
    "validUntil": "2026-11-15"
  }
]
```

**Roles:** super-admin, certification-body

### ExportQueryDto

```typescript
class ExportQueryDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsEnum(CertificationStatus) status?: CertificationStatus;
}
```

### CertificationService.exportForMapmdref()

Uses `FindOptionsWhere<Certification>` with optional date/status filters. Returns plain array (no pagination — export is a full data dump). Cap at 10,000 rows for safety.

---

## US-087 — Kafka DLQ Message Counts

**Goal:** super-admin views message counts on all DLQ topics to detect processing failures.

**Decision (Q3/implied):** New `GET /admin/kafka/dlq-stats` endpoint in a new `AdminController` in `src/common/controllers/`. Calls Redpanda Admin HTTP API (`http://redpanda:9644`) to list topics and their partition offsets.

### Redpanda Admin API calls

```
GET http://{REDPANDA_ADMIN_URL}/v1/topics
  → filters topics matching *.dlq pattern

GET http://{REDPANDA_ADMIN_URL}/v1/topics/{topicName}/partitions
  → for each DLQ topic: partition count + high watermark (= message count)
```

### API

```
GET /admin/kafka/dlq-stats    — super-admin only
```

**Response:**

```json
{
  "success": true,
  "data": [
    { "topic": "certification.decision.granted.dlq", "totalMessages": 3 },
    { "topic": "notification.email.send.dlq", "totalMessages": 0 }
  ]
}
```

### Implementation

- New `AdminController` in `src/common/controllers/admin.controller.ts`
- New `KafkaAdminService` in `src/common/services/kafka-admin.service.ts`
- Uses `@nestjs/axios` (`HttpModule`) or Node.js native `fetch` to call Redpanda HTTP API
- `REDPANDA_ADMIN_URL` from `ConfigService` (default: `http://redpanda:9644`)
- Register `AdminController` in `AppModule`

---

## New Kafka Events

| Topic                                 | Event Interface                 | Producer          | Consumer                         |
| ------------------------------------- | ------------------------------- | ----------------- | -------------------------------- |
| `product.batch.processing_step_added` | `BatchProcessingStepAddedEvent` | `ProductProducer` | (notification module, if needed) |

---

## Migrations Needed

| Migration | File                                       | Change                                                             |
| --------- | ------------------------------------------ | ------------------------------------------------------------------ |
| 009       | `1700000000009-AddProcessingStep`          | CREATE TABLE product.processing_step                               |
| 010       | `1700000000010-AddProductTypeValidityDays` | ALTER TABLE product.product_type ADD COLUMN validity_days INT NULL |

---

## Route Ordering Rules (NestJS literal-before-param)

- `GET /certifications/export` before `GET /certifications/:id` — already have `stats` before `:id`, add `export` in same cluster
- `GET /batches/:id/processing-steps` — new sub-resource, no collision risk
- `GET /lab-tests` (list) before `GET /lab-tests/:id` — standard ordering

---

## What is NOT in This Sprint (YAGNI)

- PDF export for MAPMDREF (Phase 2 — US-050 handles compliance PDF separately)
- Server-side enforcement of `validityDays` in `CertificationService` (requires cross-module lookup — Phase 2)
- Kafka consumer in notification module for `processing_step_added` (no notification template exists for this event)
- ONSSA lab accreditation flag on `ProcessingStep` (US-030 is separate)
- Offline QR verification (US-053 — 13 SP, Phase 2)
- DLQ consumer lag (requires consumer group offset tracking — Redpanda Admin API v2 feature, Phase 2)
