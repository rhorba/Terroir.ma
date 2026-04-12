# Sprint 7 Design — Terroir.ma

**Date:** 2026-04-12
**Sprint:** 7 — Cooperative Deactivation, Product Type CRUD, Inspector Assignment, Notification Stats, User Roles View
**Story Points:** 20 SP (TM-3 carry-over + 5 stories)

---

## Stories in Scope

| ID     | Title                               | Module         | SP  | Priority   |
| ------ | ----------------------------------- | -------------- | --- | ---------- |
| TM-3   | Migration chain verification        | infrastructure | 1   | carry-over |
| US-010 | Super-admin deactivates cooperative | cooperative    | 3   | Low        |
| US-016 | Manage SDOQ product types           | product        | 5   | Medium     |
| US-044 | Assign inspectors to inspections    | certification  | 3   | Medium     |
| US-076 | View failed notification counts     | notification   | 3   | Medium     |
| US-086 | Manage user roles (read-only)       | common         | 5   | High       |

**Total: 20 SP**

---

## Design Decisions (Q&A)

| Question           | Decision                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Sprint scope       | Option B: TM-3 + US-086 + US-016 + US-044 + US-076 + US-010 = 20 SP                                                 |
| US-086 approach    | Option C (YAGNI): read-only `GET /users/me` + `GET /users/me/roles` — reads JWT claims, no Keycloak Admin API       |
| US-016 approach    | Option A: proper `product.product_type` table (entity already exists, add `is_active` column + CRUD)                |
| US-044 side-effect | Option A: publish `certification.inspection.inspector-assigned` Kafka event → notification sends email to inspector |
| US-010 cascade     | Option B: soft flag (`status = 'suspended'`) + Kafka event, no Keycloak call in v1                                  |
| US-076 shape       | Option A: `GET /notifications/stats` aggregate counts, Redis 300s cache, same pattern as certification stats        |

---

## TM-3 — Migration Chain Verification (1 SP)

**Goal:** Confirm all 6 migrations run cleanly on a fresh PostgreSQL instance and no schema drift exists.

**Steps (shell, no code changes):**

```bash
docker compose --profile core up -d postgres
npm run migration:run
npm run migration:generate -- --check   # must output "No changes detected"
```

**Success criteria:** `migration:generate --check` exits 0 with no diff output.

**Note:** This is the 3rd attempt. If Docker is unavailable, document blockers and defer to a dedicated infra session.

---

## US-010 — Deactivate Cooperative (3 SP)

**Module:** `cooperative`

**Entity change:** None — `Cooperative.status: CooperativeStatus` already has `'suspended'` as a valid value. Deactivation = set `status = 'suspended'`.

**New endpoint:**

```
PUT /cooperatives/:id/deactivate   [super-admin]
Body: { reason?: string }
Response: { success: true, data: Cooperative }
```

**Service logic (`CooperativeService.deactivate()`):**

1. Find cooperative by id — throw `NotFoundException` if not found
2. Guard: if `status === 'suspended'` already, throw `ConflictException`
3. Set `status = 'suspended'`, save
4. Publish `cooperative.cooperative.deactivated` Kafka event

**New Kafka event interface** (`src/common/interfaces/events/cooperative.events.ts`):

```ts
export interface CooperativeDeactivatedEvent extends BaseEvent {
  cooperativeId: string;
  cooperativeName: string;
  ice: string;
  regionCode: string;
  deactivatedBy: string;
  reason: string | null;
}
```

**Topic:** `cooperative.cooperative.deactivated`

**Notification side-effect:** Notification module already listens to cooperative events. Add handler for this new topic → send `COOPERATIVE_DEACTIVATED` email template to cooperative-admin.

**No migration required.**

---

## US-016 — SDOQ Product Types CRUD (5 SP)

**Module:** `product`

**Entity:** `ProductType` already exists at `src/modules/product/entities/product-type.entity.ts` and is registered in `ProductModule`. **Missing:** `isActive` column.

**Migration needed:** `1700000000007-AddProductTypeIsActive.ts`

```sql
ALTER TABLE product.product_type ADD COLUMN is_active boolean NOT NULL DEFAULT true;
```

**Entity update:** Add `@Column({ name: 'is_active', type: 'boolean', default: true }) isActive: boolean;` to `ProductType`.

**New files:**

- `src/modules/product/dto/create-product-type.dto.ts` — `code`, `nameFr`, `nameAr`, `nameZgh?`, `certificationType`, `regionCode`, `labTestParameters`, `hsCode?`, `onssaCategory?`
- `src/modules/product/dto/update-product-type.dto.ts` — `PartialType(CreateProductTypeDto)`
- `src/modules/product/services/product-type.service.ts`
- `src/modules/product/controllers/product-type.controller.ts`

**Endpoints:**

```
GET  /product-types          [authenticated — all roles]  paginated list (active only by default)
GET  /product-types/:id      [authenticated]
POST /product-types          [super-admin]
PUT  /product-types/:id      [super-admin]
DELETE /product-types/:id    [super-admin] → sets isActive = false (soft deactivate)
```

**ProductTypeService methods:**

- `findAll(page, limit): Promise<[ProductType[], number]>` — `WHERE is_active = true`
- `findById(id): Promise<ProductType>` — throws `NotFoundException`
- `create(dto, createdBy): Promise<ProductType>`
- `update(id, dto): Promise<ProductType>` — throws `NotFoundException`
- `deactivate(id): Promise<ProductType>` — sets `isActive = false`

**Note on Product FK:** `Product.productTypeCode` is a plain string (no DB FK), so deactivating a product type does not cascade to products. Guards validating `productTypeCode` on product creation should check `isActive = true`.

**ProductModule update:** Register `ProductTypeController` in controllers + `ProductTypeService` in providers.

---

## US-044 — Assign Inspector to Inspection (3 SP)

**Module:** `certification`

**Entity:** `Inspection` already has `inspectorId: string` and `inspectorName: string | null`. No migration needed.

**New endpoint:**

```
PUT /certifications/inspections/:id/assign-inspector   [super-admin]
Body: { inspectorId: string; inspectorName: string }
Response: { success: true, data: Inspection }
```

**Service logic (`InspectionService.assignInspector()`):**

1. Find inspection by id — throw `NotFoundException` if not found
2. Guard: if `status === 'completed'` or `'cancelled'`, throw `ConflictException`
3. Update `inspectorId` + `inspectorName`, save
4. Publish `certification.inspection.inspector-assigned` Kafka event

**New Kafka event interface** (`src/common/interfaces/events/certification.events.ts`):

```ts
export interface InspectionInspectorAssignedEvent extends BaseEvent {
  inspectionId: string;
  certificationId: string;
  cooperativeId: string;
  inspectorId: string;
  inspectorName: string;
  scheduledDate: string;
  assignedBy: string;
}
```

**Topic:** `certification.inspection.inspector-assigned`

**Local barrel** (`src/modules/certification/events/certification-events.ts`): re-export `InspectionInspectorAssignedEvent` (known two-file ceremony).

**Notification side-effect:** Notification module subscribes to `certification.inspection.inspector-assigned` → sends `INSPECTION_ASSIGNED` email template to inspector (`inspectorId` as recipient).

**DTO:** `AssignInspectorDto { @IsUUID() inspectorId: string; @IsString() @MaxLength(200) inspectorName: string; }`

---

## US-076 — Notification Stats (3 SP)

**Module:** `notification`

**No new entity.** Uses existing `Notification` entity with `status: 'pending' | 'sent' | 'failed'`.

**New interface** (`src/modules/notification/interfaces/notification-stats.interface.ts`):

```ts
export interface NotificationStats {
  total: number;
  byStatus: { sent: number; failed: number; pending: number };
  from: string | null;
  to: string | null;
  generatedAt: string;
}
```

**New DTO:** `StatsQueryDto { @IsOptional() @IsISO8601() from?: string; @IsOptional() @IsISO8601() to?: string; }`

**New endpoint:**

```
GET /notifications/stats?from=&to=   [super-admin]
```

**Service logic (`NotificationService.getStats()`):**

1. Check Redis cache key `stats:notifications:{from|all}:{to|all}`
2. On miss: run raw SQL `SELECT status, COUNT(*) FROM notification.notification WHERE created_at BETWEEN $1 AND $2 GROUP BY status`
3. Cache result 300s, return `NotificationStats`

**Register before** `GET /notifications/:id` to avoid route collision (same `GET /notifications/...` prefix pattern).

**Redis cache key:** `stats:notifications:{from ?? 'all'}:{to ?? 'all'}`
**TTL:** 300s (same as certification stats)

---

## US-086 — User Roles Read-only (5 SP)

**Module:** `common`

**Approach (YAGNI):** Expose two endpoints that read role claims from the authenticated user's own JWT — no Keycloak Admin API call, no DB storage.

**New file:** `src/common/controllers/user.controller.ts`

**Endpoints:**

```
GET /users/me          [authenticated — any role]  → full JWT payload (id, email, roles, cooperative_id)
GET /users/me/roles    [authenticated — any role]  → roles array only
```

**Service logic (inline in controller — thin enough):**

- `GET /users/me` — return `CurrentUser` decorator payload as-is
- `GET /users/me/roles` — return `user.realm_access?.roles ?? []`

**CurrentUserPayload** (already in `src/common/decorators/current-user.decorator.ts`) contains `realm_access.roles` from the decoded Keycloak JWT.

**Why 5 SP for a thin endpoint?** The story description says "manage user roles and permissions" — the SP includes checking if a write path is feasible, deciding it isn't for v1, implementing the read view, and documenting the Phase 2 path (Keycloak Admin API).

**Register in `AppModule`** or a lightweight `CommonController` registered alongside existing guards.

---

## New Kafka Topics Summary

| Topic                                         | Published by  | Consumed by  | New? |
| --------------------------------------------- | ------------- | ------------ | ---- |
| `cooperative.cooperative.deactivated`         | cooperative   | notification | YES  |
| `certification.inspection.inspector-assigned` | certification | notification | YES  |

---

## New Migration

| File                                      | Change                                                                                |
| ----------------------------------------- | ------------------------------------------------------------------------------------- |
| `1700000000007-AddProductTypeIsActive.ts` | `ALTER TABLE product.product_type ADD COLUMN is_active boolean NOT NULL DEFAULT true` |

---

## API Surface Summary

| Method | Endpoint                                           | Role          | Story  |
| ------ | -------------------------------------------------- | ------------- | ------ |
| PUT    | `/cooperatives/:id/deactivate`                     | super-admin   | US-010 |
| GET    | `/product-types`                                   | authenticated | US-016 |
| GET    | `/product-types/:id`                               | authenticated | US-016 |
| POST   | `/product-types`                                   | super-admin   | US-016 |
| PUT    | `/product-types/:id`                               | super-admin   | US-016 |
| DELETE | `/product-types/:id`                               | super-admin   | US-016 |
| PUT    | `/certifications/inspections/:id/assign-inspector` | super-admin   | US-044 |
| GET    | `/notifications/stats`                             | super-admin   | US-076 |
| GET    | `/users/me`                                        | authenticated | US-086 |
| GET    | `/users/me/roles`                                  | authenticated | US-086 |

---

## Test Strategy

- Unit tests for each new service method (mock repos, mock Kafka producer, mock CACHE_MANAGER)
- `ProductTypeService`: findAll, findById, create, update, deactivate (5 cases)
- `CooperativeService.deactivate()`: happy path, already-suspended guard, not-found (3 cases)
- `InspectionService.assignInspector()`: happy path, completed-guard, cancelled-guard, not-found (4 cases)
- `NotificationService.getStats()`: cache hit, DB+cache, date range filter (3 cases)
- `UserController`: roles read from JWT claims (2 cases)
- Target: +20 unit tests, keeping suite ≥ 291 total

---

## Modular Monolith Constraints (verified)

- No cross-module service imports
- `cooperative` → Kafka → `notification` (not direct)
- `certification` → Kafka → `notification` (not direct)
- `product.product_type` is within the `product` schema — no cross-schema join
- `notification.notification` stats query stays within `notification` schema
