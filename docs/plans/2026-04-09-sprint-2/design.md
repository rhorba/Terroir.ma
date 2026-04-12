# Sprint 2 Design — Certification Chain Core + Vertical Slice

**Date:** 2026-04-09
**Sprint:** 2 (2026-04-12 → 2026-04-25)
**Capacity:** ~34 story points (single developer)
**Planned:** 30 story points

---

## Sprint Goal

Implement the first 8 steps of the 12-step SDOQ certification chain using an event-sourced ledger with CQRS-lite status projection, and deliver a working vertical slice across cooperative, product, and notification modules.

---

## Design Decisions

| Decision                  | Choice                                                                        | Rationale                                                                   |
| ------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Chain architecture        | Event-sourced `CertificationEvent` ledger                                     | CLAUDE.md: chain events are IMMUTABLE — append-only, never update/delete    |
| Status projection         | CQRS-lite materialized `current_status` column on `Certification`             | Fast list queries without cache invalidation complexity of Redis projection |
| State machine enforcement | `assertStatus()` guard + `applyTransition()` helper in `CertificationService` | YAGNI — no FSM library, no XState dependency for v1                         |
| Step 7 trigger            | Kafka consumer only (`product.lab.test.completed`)                            | No REST endpoint — lab results come from the product module                 |
| Product search            | Exact match QueryBuilder (no ILIKE fuzzy)                                     | YAGNI — full-text search deferred to Phase 2                                |

---

## Section 1: Data Model

### New Entity: `CertificationEvent`

File: `src/modules/certification/entities/certification-event.entity.ts`

```typescript
@Entity({ schema: 'certification', name: 'certification_events' })
export class CertificationEvent {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column('uuid') certificationId: string;

  @Column({ type: 'enum', enum: CertificationEventType })
  eventType: CertificationEventType;

  @Column({ type: 'enum', enum: CertificationStatus })
  fromStatus: CertificationStatus;

  @Column({ type: 'enum', enum: CertificationStatus })
  toStatus: CertificationStatus;

  @Column('uuid') actorId: string;
  @Column('text') actorRole: string;
  @Column('jsonb', { nullable: true }) payload: Record<string, unknown>;
  @Column('uuid') correlationId: string;
  @CreateDateColumn() occurredAt: Date;
}
```

**Constraints:** No `@UpdateDateColumn`. No DELETE permission on this table. Append-only enforced structurally.

### Updated `Certification` Entity

Add one column:

```typescript
@Column({ type: 'enum', enum: CertificationStatus, default: CertificationStatus.DRAFT })
currentStatus: CertificationStatus;
```

### Full Status Enum (all 12 states)

```
DRAFT → SUBMITTED → DOCUMENT_REVIEW → INSPECTION_SCHEDULED →
INSPECTION_IN_PROGRESS → INSPECTION_COMPLETE → LAB_TESTING →
LAB_RESULTS_RECEIVED → UNDER_REVIEW → GRANTED | DENIED
                                              ↓ (from GRANTED)
                                           REVOKED
```

Sprint 2 implements: **DRAFT → LAB_RESULTS_RECEIVED** (8 states, 7 transitions).
Sprint 3 picks up: **LAB_RESULTS_RECEIVED → GRANTED/DENIED/REVOKED**.

---

## Section 2: State Transitions + Kafka Wiring

### Transition Table

| Step | Transition                                    | Actor Role           | REST Endpoint                                  | Kafka Event Published                |
| ---- | --------------------------------------------- | -------------------- | ---------------------------------------------- | ------------------------------------ |
| 1    | DRAFT → SUBMITTED                             | `cooperative-admin`  | `POST /certifications/:id/submit`              | `certification.request.submitted`    |
| 2    | SUBMITTED → DOCUMENT_REVIEW                   | `certification-body` | `POST /certifications/:id/start-review`        | `certification.review.started`       |
| 3    | DOCUMENT_REVIEW → INSPECTION_SCHEDULED        | `certification-body` | `POST /certifications/:id/schedule-inspection` | `certification.inspection.scheduled` |
| 4    | INSPECTION_SCHEDULED → INSPECTION_IN_PROGRESS | `inspector`          | `POST /certifications/:id/start-inspection`    | `certification.inspection.started`   |
| 5    | INSPECTION_IN_PROGRESS → INSPECTION_COMPLETE  | `inspector`          | `POST /certifications/:id/complete-inspection` | `certification.inspection.completed` |
| 6    | INSPECTION_COMPLETE → LAB_TESTING             | `certification-body` | `POST /certifications/:id/request-lab`         | `certification.lab.requested`        |
| 7    | LAB_TESTING → LAB_RESULTS_RECEIVED            | _Kafka consumer_     | _(driven by `product.lab.test.completed`)_     | `certification.lab.results.received` |

### Transition Guard

```typescript
// src/modules/certification/services/certification.service.ts
private assertStatus(cert: Certification, expected: CertificationStatus): void {
  if (cert.currentStatus !== expected) {
    throw new BadRequestException(
      `Invalid transition: expected ${expected}, got ${cert.currentStatus}`,
    );
  }
}
```

### Atomic Write Helper

```typescript
private async applyTransition(
  cert: Certification,
  eventType: CertificationEventType,
  toStatus: CertificationStatus,
  actor: CurrentUser,
  payload: Record<string, unknown>,
  correlationId: string,
): Promise<Certification> {
  return this.dataSource.transaction(async (em) => {
    await em.insert(CertificationEvent, {
      certificationId: cert.id,
      eventType,
      fromStatus: cert.currentStatus,
      toStatus,
      actorId: actor.id,
      actorRole: actor.role,
      payload,
      correlationId,
    });
    cert.currentStatus = toStatus;
    const saved = await em.save(cert);
    await this.producer.publish(eventType, { certificationId: cert.id, correlationId });
    return saved;
  });
}
```

---

## Section 3: Vertical Slice Features

### US-008 + US-009 — Cooperative Member Management

**New endpoints on `CooperativeController`:**

| Method  | Path                                  | Role                 | Story  |
| ------- | ------------------------------------- | -------------------- | ------ |
| `GET`   | `/cooperatives/:id/members`           | `cooperative-admin`  | US-009 |
| `PATCH` | `/cooperatives/:id/members/:memberId` | `cooperative-member` | US-008 |

- `PATCH` accepts `UpdateMemberDto` — phone, address, farming plot GPS only
- Uses `@IsMoroccanPhone()` and `@IsWithinMorocco()` existing validators
- Guard: `req.user.sub === memberId` — members update own profile only
- `GET` scoped: cooperative-admin can only retrieve members of their own cooperative
- Both return standard `{ success, data, meta }` response envelope

### US-015 — Product Search

**New query endpoint on `ProductController`:**

```
GET /products?sdoqType=AOP&region=SOUSS-MASSA&page=1&limit=20
```

- TypeORM `QueryBuilder` with optional `WHERE` clauses
- Exact match on `sdoqType` and `region` — no ILIKE (deferred to Phase 2)
- Roles: `cooperative-admin`, `inspector`, `certification-body`
- Returns paginated `Product[]` with `meta: { page, limit, total }`

### US-074 — Notification History

**New endpoint on `NotificationController`:**

```
GET /notifications/history?page=1&limit=20
```

- Reads from existing `Notification` entity
- Filters by `userId` from JWT — users see only their own notifications
- Returns: `channel`, `subject`, `status`, `sentAt`, `templateKey`
- Role: all authenticated users

---

## Section 4: Sprint Scope & Test Plan

### Story Point Budget

| Feature                                              | Stories        | Points     |
| ---------------------------------------------------- | -------------- | ---------- |
| `CertificationEvent` entity + TypeORM migration      | —              | 3          |
| `assertStatus` guard + `applyTransition` helper      | —              | 2          |
| Steps 1–3: submit, start-review, schedule-inspection | US-031, US-032 | 5          |
| Steps 4–5: start-inspection, complete-inspection     | US-033         | 4          |
| Step 6: request-lab                                  | —              | 2          |
| Step 7: Kafka-driven LAB_RESULTS_RECEIVED            | —              | 3          |
| Member profile update                                | US-008         | 3          |
| View cooperative members                             | US-009         | 2          |
| Product search by SDOQ type + region                 | US-015         | 3          |
| Notification history                                 | US-074         | 3          |
| **Total**                                            |                | **30 pts** |

### Test Plan

**Unit tests** (`test/unit/`):

| File                                                | Coverage                                                                      |
| --------------------------------------------------- | ----------------------------------------------------------------------------- |
| `certification/certification-state-machine.spec.ts` | All 7 guard checks — wrong-status → `BadRequestException`                     |
| `certification/certification.service.spec.ts`       | Each transition — correct `CertificationEvent` shape, correct `currentStatus` |
| `cooperative/cooperative.service.spec.ts`           | Member PATCH (own only), GET members (own cooperative only)                   |
| `product/product.service.spec.ts`                   | Search with sdoqType filter, region filter, both, neither                     |
| `notification/notification.service.spec.ts`         | History query scoped to `userId`                                              |

**Integration tests** (`test/integration/`) — Testcontainers PostgreSQL + Redpanda:

| File                                                | Coverage                                                                   |
| --------------------------------------------------- | -------------------------------------------------------------------------- |
| `certification/certification-chain.integration.ts`  | Full walk DRAFT → LAB_RESULTS_RECEIVED; verify 7 `CertificationEvent` rows |
| `certification/certification-events.integration.ts` | `fromStatus`/`toStatus`/`actorId` correct per transition                   |
| `product/product-search.integration.ts`             | QueryBuilder filters return correct rows                                   |

**E2E tests** (`test/e2e/`):

| File                                       | Coverage                                                                           |
| ------------------------------------------ | ---------------------------------------------------------------------------------- |
| `certification/certification-chain.e2e.ts` | Walk all 7 REST endpoints with correct role JWTs; assert 400 on out-of-order calls |

### Definition of Done

- [ ] `CertificationEvent` table exists in migration, no `@UpdateDateColumn`
- [ ] Every transition returns updated `Certification` with correct `currentStatus`
- [ ] Kafka event published inside transaction for every REST-triggered step
- [ ] Step 7 driven purely by `product.lab.test.completed` — no REST endpoint
- [ ] Wrong-order calls return `400 Bad Request` with current status in message
- [ ] `GET /cooperatives/:id/members` scoped to own cooperative
- [ ] `PATCH /cooperatives/:id/members/:memberId` blocked if `req.user.sub !== memberId`
- [ ] `GET /products` pagination returns correct `meta.total`
- [ ] `GET /notifications/history` scoped to requesting user's `userId`
- [ ] All new endpoints have Swagger decorators
- [ ] 80%+ unit test coverage on new code
- [ ] TypeScript compiles with no errors (`tsc --noEmit`)
- [ ] ESLint passes with no warnings
