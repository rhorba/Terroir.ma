# Sprint 2 Implementation Plan

> **For Claude:** Use /execute to implement this plan task-by-task.

**Goal:** Implement the 12-step SDOQ certification chain (steps 1–8) using an event-sourced ledger with CQRS-lite projection, plus cooperative member management, product search, and notification history.

**Architecture:** Append-only `CertificationEvent` table per transition; `Certification.currentStatus` updated atomically in same transaction; Kafka event published inside transaction for each step; Step 7 driven purely by Kafka listener consuming `lab.test.completed`.

**Tech Stack:** NestJS, TypeScript, PostgreSQL, Redpanda, Keycloak, Redis

**Modules Affected:** certification, cooperative, product, notification

**Estimated Story Points:** 30

**Design Doc:** `docs/plans/2026-04-09-sprint-2/design.md`

---

## Batch 1 — Status Enum + CertificationEvent Entity

### Task 1 — Replace CertificationStatus type union with proper enum; add CertificationEventType enum

**File:** `src/modules/certification/entities/certification.entity.ts`

Replace the type union at the top with a proper `enum`. Also add `CertificationEventType` enum in the same file.

Remove:

```typescript
export type CertificationStatus =
  | 'pending'
  | 'inspection_scheduled'
  | 'inspection_completed'
  | 'granted'
  | 'denied'
  | 'revoked'
  | 'expired'
  | 'renewed';
```

Add:

```typescript
export enum CertificationStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  DOCUMENT_REVIEW = 'DOCUMENT_REVIEW',
  INSPECTION_SCHEDULED = 'INSPECTION_SCHEDULED',
  INSPECTION_IN_PROGRESS = 'INSPECTION_IN_PROGRESS',
  INSPECTION_COMPLETE = 'INSPECTION_COMPLETE',
  LAB_TESTING = 'LAB_TESTING',
  LAB_RESULTS_RECEIVED = 'LAB_RESULTS_RECEIVED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  GRANTED = 'GRANTED',
  DENIED = 'DENIED',
  REVOKED = 'REVOKED',
}

export enum CertificationEventType {
  REQUEST_SUBMITTED = 'REQUEST_SUBMITTED',
  REVIEW_STARTED = 'REVIEW_STARTED',
  INSPECTION_SCHEDULED = 'INSPECTION_SCHEDULED',
  INSPECTION_STARTED = 'INSPECTION_STARTED',
  INSPECTION_COMPLETED = 'INSPECTION_COMPLETED',
  LAB_REQUESTED = 'LAB_REQUESTED',
  LAB_RESULTS_RECEIVED = 'LAB_RESULTS_RECEIVED',
  DECISION_GRANTED = 'DECISION_GRANTED',
  DECISION_DENIED = 'DECISION_DENIED',
  CERTIFICATE_REVOKED = 'CERTIFICATE_REVOKED',
}
```

Also update the `status` column definition on the `Certification` entity to use the enum and rename to `currentStatus`:

- Rename property `status` → `currentStatus`
- Change `@Column({ name: 'status', type: 'varchar', ... default: 'pending' })` → `@Column({ name: 'current_status', type: 'enum', enum: CertificationStatus, default: CertificationStatus.DRAFT })`

Update `requestCertification` in `certification.service.ts`:

- Change `status: 'pending'` → `currentStatus: CertificationStatus.DRAFT`

Update `grantCertification`, `denyCertification`, `revokeCertification` in `certification.service.ts`:

- Replace all `certification.status` references with `certification.currentStatus`
- Replace string literals `'pending'`, `'inspection_completed'`, `'granted'` with enum values `CertificationStatus.LAB_RESULTS_RECEIVED`, `CertificationStatus.GRANTED`
- Replace `await this.certRepo.update({ id }, { status: 'granted' })` → `cert.currentStatus = CertificationStatus.GRANTED; await this.certRepo.save(cert)`

**Verification:** `npm run typecheck` — fix any remaining string references to old status values.

---

### Task 2 — Create CertificationEvent entity

**New file:** `src/modules/certification/entities/certification-event.entity.ts`

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { CertificationStatus, CertificationEventType } from './certification.entity';

/**
 * Append-only ledger of every state transition in the certification chain.
 * NEVER update or delete rows — this table is the source of truth for the audit trail.
 * Law 25-06 requires a full immutable record of all certification decisions.
 */
@Entity({ schema: 'certification', name: 'certification_events' })
export class CertificationEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The certification this event belongs to */
  @Column({ name: 'certification_id', type: 'uuid' })
  certificationId: string;

  /** The type of transition that occurred */
  @Column({ name: 'event_type', type: 'enum', enum: CertificationEventType })
  eventType: CertificationEventType;

  /** Status before this transition */
  @Column({ name: 'from_status', type: 'enum', enum: CertificationStatus })
  fromStatus: CertificationStatus;

  /** Status after this transition */
  @Column({ name: 'to_status', type: 'enum', enum: CertificationStatus })
  toStatus: CertificationStatus;

  /** Keycloak user ID of the actor who triggered this transition */
  @Column({ name: 'actor_id', type: 'uuid' })
  actorId: string;

  /** Keycloak role of the actor at the time of the transition */
  @Column({ name: 'actor_role', type: 'varchar', length: 50 })
  actorRole: string;

  /** DTO payload serialized — inspection details, lab IDs, remarks, etc. */
  @Column({ name: 'payload', type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null;

  /** Ties this DB event to its Kafka message for distributed tracing */
  @Column({ name: 'correlation_id', type: 'uuid' })
  correlationId: string;

  /** Immutable timestamp — no @UpdateDateColumn intentionally */
  @CreateDateColumn({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt: Date;
}
```

No `@UpdateDateColumn`. No `@DeleteDateColumn`. Structurally append-only.

---

### Task 3 — Register CertificationEvent in CertificationModule

**File:** `src/modules/certification/certification.module.ts`

Add `CertificationEvent` to the `TypeOrmModule.forFeature([...])` array so it can be injected as a repository.

```typescript
TypeOrmModule.forFeature([
  Certification,
  CertificationEvent, // ← add this
  Inspection,
  QrCode,
  ExportDocument,
]);
```

Import `CertificationEvent` from `./entities/certification-event.entity`.

**Verify Batch 1:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 2 — Migration + Kafka Interfaces + Idempotency

### Task 4 — Generate TypeORM migration for CertificationEvent + currentStatus

**Command:**

```bash
npm run migration:generate -- src/database/migrations/AddCertificationEventAndCurrentStatus
```

If the generator doesn't produce the correct migration, create it manually at `src/database/migrations/<timestamp>-AddCertificationEventAndCurrentStatus.ts`.

The migration must:

1. Create `certification.certification_events` table with all columns from Task 2
2. Create PostgreSQL enum types `certification_status_enum` and `certification_event_type_enum`
3. Add `current_status` column (enum, default `'DRAFT'`) to `certification.certification`
4. Drop old `status` column from `certification.certification` (data in Sprint 1 is test data; no migration of values needed)

**Verify migration runs:** `npm run migration:run` (against the running Docker DB).

---

### Task 5 — Add Kafka interfaces for chain events

**File:** `src/common/interfaces/events/certification.events.ts`

Append these interfaces (do not remove existing ones):

```typescript
export interface CertificationReviewStartedEvent extends BaseEvent {
  certificationId: string;
  cooperativeId: string;
  startedBy: string;
  remarks: string | null;
}

export interface CertificationInspectionStartedEvent extends BaseEvent {
  certificationId: string;
  inspectionId: string;
  cooperativeId: string;
  inspectorId: string;
  startedAt: string;
}

export interface CertificationLabRequestedEvent extends BaseEvent {
  certificationId: string;
  cooperativeId: string;
  batchId: string;
  requestedBy: string;
  labId: string | null;
  remarks: string | null;
}

export interface CertificationLabResultsReceivedEvent extends BaseEvent {
  certificationId: string;
  cooperativeId: string;
  batchId: string;
  labTestId: string;
  passed: boolean;
  receivedAt: string;
}
```

---

### Task 6 — Implement real isEventProcessed in CertificationService

**File:** `src/modules/certification/services/certification.service.ts`

Inject `CertificationEvent` repository:

```typescript
@InjectRepository(CertificationEvent)
private readonly eventRepo: Repository<CertificationEvent>,
```

Replace the stub `isEventProcessed`:

```typescript
/**
 * Idempotency guard — returns true if an event with this correlationId
 * has already been recorded, preventing duplicate processing.
 */
async isEventProcessed(correlationId: string): Promise<boolean> {
  const count = await this.eventRepo.count({ where: { correlationId } });
  return count > 0;
}
```

**Verify Batch 2:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 3 — assertStatus + applyTransition + Steps 1–3

### Task 7 — Add assertStatus guard + applyTransition helper to CertificationService

**File:** `src/modules/certification/services/certification.service.ts`

Add two private methods:

```typescript
/**
 * Guards a state transition — throws if the certification is not in the expected status.
 * Call this at the top of every transition method before any DB write.
 */
private assertStatus(
  cert: Certification,
  expected: CertificationStatus,
): void {
  if (cert.currentStatus !== expected) {
    throw new BadRequestException(
      `Invalid transition: certification ${cert.id} is in status ` +
      `${cert.currentStatus}, expected ${expected}`,
    );
  }
}

/**
 * Atomically: inserts a CertificationEvent row, updates currentStatus on Certification,
 * then publishes the matching Kafka event — all in one DB transaction.
 * If any step fails the whole transaction rolls back.
 */
private async applyTransition(
  cert: Certification,
  eventType: CertificationEventType,
  toStatus: CertificationStatus,
  actorId: string,
  actorRole: string,
  payload: Record<string, unknown> | null,
  correlationId: string,
): Promise<Certification> {
  return this.dataSource.transaction(async (em) => {
    await em.insert(CertificationEvent, {
      certificationId: cert.id,
      eventType,
      fromStatus: cert.currentStatus,
      toStatus,
      actorId,
      actorRole,
      payload,
      correlationId,
    });
    cert.currentStatus = toStatus;
    return em.save(cert);
  });
}
```

---

### Task 8 — Implement Steps 1–3 in CertificationService

**File:** `src/modules/certification/services/certification.service.ts`

Add three transition methods:

```typescript
/** Step 1: cooperative-admin submits a DRAFT certification request */
async submitRequest(
  id: string,
  actorId: string,
  actorRole: string,
  correlationId: string,
): Promise<Certification> {
  const cert = await this.findById(id);
  this.assertStatus(cert, CertificationStatus.DRAFT);
  const updated = await this.applyTransition(
    cert, CertificationEventType.REQUEST_SUBMITTED,
    CertificationStatus.SUBMITTED, actorId, actorRole, null, correlationId,
  );
  await this.producer.publishCertificationRequested(updated, correlationId);
  return updated;
}

/** Step 2: certification-body starts document review */
async startReview(
  id: string,
  remarks: string | null,
  actorId: string,
  actorRole: string,
  correlationId: string,
): Promise<Certification> {
  const cert = await this.findById(id);
  this.assertStatus(cert, CertificationStatus.SUBMITTED);
  return this.applyTransition(
    cert, CertificationEventType.REVIEW_STARTED,
    CertificationStatus.DOCUMENT_REVIEW, actorId, actorRole,
    { remarks }, correlationId,
  );
}

/** Step 3: certification-body schedules a field inspection */
async scheduleInspectionChain(
  id: string,
  dto: ScheduleInspectionDto,
  actorId: string,
  actorRole: string,
  correlationId: string,
): Promise<Certification> {
  const cert = await this.findById(id);
  this.assertStatus(cert, CertificationStatus.DOCUMENT_REVIEW);
  const updated = await this.applyTransition(
    cert, CertificationEventType.INSPECTION_SCHEDULED,
    CertificationStatus.INSPECTION_SCHEDULED, actorId, actorRole,
    { inspectorId: dto.inspectorId, scheduledDate: dto.scheduledDate, location: dto.location },
    correlationId,
  );
  await this.producer.publishInspectionScheduled(updated, dto, actorId, correlationId);
  return updated;
}
```

Import `ScheduleInspectionDto` from `../dto/schedule-inspection.dto`.

---

### Task 9 — Create DTOs for Steps 1–2 + wire controller endpoints

**New file:** `src/modules/certification/dto/submit-certification.dto.ts`

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Body for POST /certifications/:id/submit — no required fields */
export class SubmitCertificationDto {
  @ApiPropertyOptional({ description: 'Optional remarks from cooperative admin' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}
```

**New file:** `src/modules/certification/dto/start-review.dto.ts`

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class StartReviewDto {
  @ApiPropertyOptional({ description: 'Reviewer remarks' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}
```

**File:** `src/modules/certification/controllers/certification.controller.ts`

Add three endpoints:

```typescript
@Post(':id/submit')
@UseGuards(RolesGuard)
@Roles('cooperative-admin', 'cooperative-member')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Step 1: Submit a draft certification request' })
async submitRequest(
  @Param('id') id: string,
  @CurrentUser() user: CurrentUserPayload,
  @Headers('x-correlation-id') correlationId = '',
): Promise<Certification> {
  return this.certificationService.submitRequest(id, user.sub, user.role, correlationId);
}

@Post(':id/start-review')
@UseGuards(RolesGuard)
@Roles('certification-body')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Step 2: Certification body starts document review' })
async startReview(
  @Param('id') id: string,
  @Body() dto: StartReviewDto,
  @CurrentUser() user: CurrentUserPayload,
  @Headers('x-correlation-id') correlationId = '',
): Promise<Certification> {
  return this.certificationService.startReview(id, dto.remarks ?? null, user.sub, user.role, correlationId);
}

@Post(':id/schedule-inspection')
@UseGuards(RolesGuard)
@Roles('certification-body')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Step 3: Schedule a field inspection' })
async scheduleInspection(
  @Param('id') id: string,
  @Body() dto: ScheduleInspectionDto,
  @CurrentUser() user: CurrentUserPayload,
  @Headers('x-correlation-id') correlationId = '',
): Promise<Certification> {
  return this.certificationService.scheduleInspectionChain(id, dto, user.sub, user.role, correlationId);
}
```

Note: `CurrentUserPayload` must expose a `role: string` field — check the decorator definition and add if missing.

**Verify Batch 3:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 4 — Steps 4–7 + Remaining Endpoints

### Task 10 — Implement Steps 4–5 in CertificationService

**File:** `src/modules/certification/services/certification.service.ts`

```typescript
/** Step 4: inspector starts the field visit */
async startInspection(
  id: string,
  actorId: string,
  actorRole: string,
  correlationId: string,
): Promise<Certification> {
  const cert = await this.findById(id);
  this.assertStatus(cert, CertificationStatus.INSPECTION_SCHEDULED);
  return this.applyTransition(
    cert, CertificationEventType.INSPECTION_STARTED,
    CertificationStatus.INSPECTION_IN_PROGRESS, actorId, actorRole,
    { startedAt: new Date().toISOString() }, correlationId,
  );
}

/** Step 5: inspector files the inspection report */
async completeInspectionChain(
  id: string,
  dto: CompleteInspectionDto,
  actorId: string,
  actorRole: string,
  correlationId: string,
): Promise<Certification> {
  const cert = await this.findById(id);
  this.assertStatus(cert, CertificationStatus.INSPECTION_IN_PROGRESS);
  const updated = await this.applyTransition(
    cert, CertificationEventType.INSPECTION_COMPLETED,
    CertificationStatus.INSPECTION_COMPLETE, actorId, actorRole,
    { passed: dto.passed, summary: dto.summary }, correlationId,
  );
  await this.producer.publishInspectionCompleted(updated, dto, actorId, correlationId);
  return updated;
}
```

Import `CompleteInspectionDto` from `../dto/complete-inspection.dto`.

---

### Task 11 — Implement Step 6 + Step 7 Kafka listener

**File:** `src/modules/certification/services/certification.service.ts`

```typescript
/** Step 6: certification-body sends batch to lab testing */
async requestLab(
  id: string,
  labId: string | null,
  remarks: string | null,
  actorId: string,
  actorRole: string,
  correlationId: string,
): Promise<Certification> {
  const cert = await this.findById(id);
  this.assertStatus(cert, CertificationStatus.INSPECTION_COMPLETE);
  return this.applyTransition(
    cert, CertificationEventType.LAB_REQUESTED,
    CertificationStatus.LAB_TESTING, actorId, actorRole,
    { labId, remarks }, correlationId,
  );
}

/** Step 7 (internal — called from Kafka listener, not REST) */
async receiveLabResults(
  batchId: string,
  labTestId: string,
  passed: boolean,
  correlationId: string,
): Promise<void> {
  // Find the certification currently in LAB_TESTING for this batch
  const cert = await this.certRepo.findOne({
    where: { batchId, currentStatus: CertificationStatus.LAB_TESTING },
  });
  if (!cert) {
    this.logger.warn({ batchId }, 'No LAB_TESTING certification found for batch');
    return;
  }
  await this.applyTransition(
    cert, CertificationEventType.LAB_RESULTS_RECEIVED,
    CertificationStatus.LAB_RESULTS_RECEIVED,
    'system', 'service-account',
    { labTestId, passed, receivedAt: new Date().toISOString() },
    correlationId,
  );
}
```

**File:** `src/modules/certification/listeners/certification.listener.ts`

Replace the stub `handleLabTestCompleted`:

```typescript
@EventPattern('lab.test.completed')
async handleLabTestCompleted(
  @Payload() data: LabTestCompletedEvent,
  @Ctx() _context: KafkaContext,
): Promise<void> {
  try {
    if (await this.certificationService.isEventProcessed(data.eventId)) {
      return;
    }
    this.logger.log(
      { eventId: data.eventId, batchId: data.batchId, passed: data.passed },
      'Lab test completed — advancing certification to LAB_RESULTS_RECEIVED',
    );
    await this.certificationService.receiveLabResults(
      data.batchId,
      data.labTestId,
      data.passed,
      data.eventId,
    );
  } catch (error) {
    this.logger.error({ error, eventId: data.eventId }, 'Failed to process lab.test.completed');
  }
}
```

---

### Task 12 — Create remaining DTOs + controller endpoints for Steps 4–6

**New file:** `src/modules/certification/dto/start-inspection.dto.ts`

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class StartInspectionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}
```

**New file:** `src/modules/certification/dto/request-lab.dto.ts`

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class RequestLabDto {
  @ApiPropertyOptional({ description: 'UUID of the accredited laboratory' })
  @IsOptional()
  @IsUUID()
  labId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}
```

**File:** `src/modules/certification/controllers/certification.controller.ts`

Add three more endpoints:

```typescript
@Post(':id/start-inspection')
@UseGuards(RolesGuard)
@Roles('inspector')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Step 4: Inspector starts field visit' })
async startInspection(
  @Param('id') id: string,
  @CurrentUser() user: CurrentUserPayload,
  @Headers('x-correlation-id') correlationId = '',
): Promise<Certification> {
  return this.certificationService.startInspection(id, user.sub, user.role, correlationId);
}

@Post(':id/complete-inspection')
@UseGuards(RolesGuard)
@Roles('inspector')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Step 5: Inspector files inspection report' })
async completeInspection(
  @Param('id') id: string,
  @Body() dto: CompleteInspectionDto,
  @CurrentUser() user: CurrentUserPayload,
  @Headers('x-correlation-id') correlationId = '',
): Promise<Certification> {
  return this.certificationService.completeInspectionChain(id, dto, user.sub, user.role, correlationId);
}

@Post(':id/request-lab')
@UseGuards(RolesGuard)
@Roles('certification-body')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Step 6: Certification body sends batch to lab testing' })
async requestLab(
  @Param('id') id: string,
  @Body() dto: RequestLabDto,
  @CurrentUser() user: CurrentUserPayload,
  @Headers('x-correlation-id') correlationId = '',
): Promise<Certification> {
  return this.certificationService.requestLab(
    id, dto.labId ?? null, dto.remarks ?? null, user.sub, user.role, correlationId,
  );
}
```

**Verify Batch 4:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 5 — Cooperative Member Management

### Task 13 — Create UpdateMemberDto

**New file:** `src/modules/cooperative/dto/update-member.dto.ts`

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEmail, MaxLength } from 'class-validator';
import { IsMoroccanPhone } from '../../../common/validators/moroccan-phone.validator';

/**
 * Fields a cooperative-member can update on their own profile.
 * CIN and fullName are immutable — they are tied to the legal registration.
 */
export class UpdateMemberDto {
  @ApiPropertyOptional({ example: '+212612345678' })
  @IsOptional()
  @IsMoroccanPhone()
  phone?: string;

  @ApiPropertyOptional({ example: 'member@example.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  email?: string;
}
```

---

### Task 14 — Add getMembers + updateMember to CooperativeService

**File:** `src/modules/cooperative/services/cooperative.service.ts`

Add two methods:

```typescript
/**
 * Return paginated members of a cooperative.
 * Only returns members of the requested cooperativeId — scoped at service level.
 */
async getMembers(
  cooperativeId: string,
  page: number,
  limit: number,
): Promise<[Member[], number]> {
  return this.memberRepo.findAndCount({
    where: { cooperativeId, isActive: true },
    order: { createdAt: 'DESC' },
    take: limit,
    skip: (page - 1) * limit,
  });
}

/**
 * Update a member's mutable profile fields.
 * Enforces that requesterId === memberId (members update their own profile only).
 * @throws BadRequestException if requesterId !== memberId
 * @throws NotFoundException if member not found within the cooperative
 */
async updateMember(
  cooperativeId: string,
  memberId: string,
  dto: UpdateMemberDto,
  requesterId: string,
): Promise<Member> {
  if (requesterId !== memberId) {
    throw new BadRequestException({
      code: 'MEMBER_SELF_UPDATE_ONLY',
      message: 'Members may only update their own profile',
    });
  }
  const member = await this.memberRepo.findOne({
    where: { id: memberId, cooperativeId },
  });
  if (!member) {
    throw new NotFoundException({
      code: 'MEMBER_NOT_FOUND',
      message: `Member ${memberId} not found in cooperative ${cooperativeId}`,
    });
  }
  if (dto.phone !== undefined) member.phone = dto.phone;
  if (dto.email !== undefined) member.email = dto.email;
  return this.memberRepo.save(member);
}
```

Import `UpdateMemberDto` from `../dto/update-member.dto`.

---

### Task 15 — Add cooperative member endpoints to CooperativeController

**File:** `src/modules/cooperative/controllers/cooperative.controller.ts`

Add query DTO and two endpoints:

```typescript
// At top — add import
import { Query } from '@nestjs/common';
import { UpdateMemberDto } from '../dto/update-member.dto';
import { Member } from '../entities/member.entity';

// Add endpoints:

@Get(':id/members')
@UseGuards(RolesGuard)
@Roles('cooperative-admin', 'super-admin')
@ApiOperation({ summary: 'List all active members of a cooperative (US-009)' })
async getMembers(
  @Param('id') id: string,
  @Query('page') page = '1',
  @Query('limit') limit = '20',
): Promise<{ success: boolean; data: Member[]; meta: { page: number; limit: number; total: number } }> {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, parseInt(limit, 10) || 20);
  const [data, total] = await this.cooperativeService.getMembers(id, pageNum, limitNum);
  return { success: true, data, meta: { page: pageNum, limit: limitNum, total } };
}

@Patch(':id/members/:memberId')
@UseGuards(RolesGuard)
@Roles('cooperative-member')
@ApiOperation({ summary: 'Update own member profile (US-008)' })
async updateMember(
  @Param('id') id: string,
  @Param('memberId') memberId: string,
  @Body() dto: UpdateMemberDto,
  @CurrentUser() user: CurrentUserPayload,
): Promise<Member> {
  return this.cooperativeService.updateMember(id, memberId, dto, user.sub);
}
```

**Verify Batch 5:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 6 — Product Search + Notification History

### Task 16 — Add SearchProductDto + searchProducts to ProductService

**New file:** `src/modules/product/dto/search-product.dto.ts`

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchProductDto {
  @ApiPropertyOptional({ example: 'ARGAN_OIL', description: 'Exact SDOQ product type code' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  productTypeCode?: string;

  @ApiPropertyOptional({
    example: 'SOUSS-MASSA',
    description: 'Region code (matched via ProductType)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  regionCode?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
```

**File:** `src/modules/product/services/product.service.ts` (or create if it doesn't exist separately)

Locate the product service and add:

```typescript
/**
 * Search products by SDOQ type code and/or region code.
 * Region is matched via a join against ProductType (same schema, no cross-schema join).
 * Returns paginated results with total count.
 */
async searchProducts(dto: SearchProductDto): Promise<[Product[], number]> {
  const page = dto.page ?? 1;
  const limit = Math.min(dto.limit ?? 20, 100);
  const qb = this.productRepo
    .createQueryBuilder('p')
    .leftJoin(
      'product.product_type',
      'pt',
      'pt.code = p.product_type_code',
    )
    .where('p.deleted_at IS NULL');

  if (dto.productTypeCode) {
    qb.andWhere('p.product_type_code = :code', { code: dto.productTypeCode });
  }
  if (dto.regionCode) {
    qb.andWhere('pt.region_code = :region', { region: dto.regionCode });
  }

  qb.orderBy('p.created_at', 'DESC')
    .take(limit)
    .skip((page - 1) * limit);

  return qb.getManyAndCount();
}
```

Import `SearchProductDto`, `Product`, `ProductType`.
Inject `ProductType` repository if needed, or use the QueryBuilder join approach (no extra repo injection).

---

### Task 17 — Add GET /products search endpoint to ProductController

**File:** `src/modules/product/controllers/product.controller.ts`

Add:

```typescript
@Get()
@ApiOperation({ summary: 'Search products by SDOQ type and region (US-015)' })
async searchProducts(
  @Query() dto: SearchProductDto,
): Promise<{ success: boolean; data: Product[]; meta: { page: number; limit: number; total: number } }> {
  const [data, total] = await this.productService.searchProducts(dto);
  const page = dto.page ?? 1;
  const limit = Math.min(dto.limit ?? 20, 100);
  return { success: true, data, meta: { page, limit, total } };
}
```

Add `@ApiQuery` decorators for each filter param, import `SearchProductDto`, `Query`.

---

### Task 18 — Add GET /notifications/history endpoint

**New file:** `src/modules/notification/dto/notification-history-query.dto.ts`

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class NotificationHistoryQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
```

**File:** `src/modules/notification/controllers/notification.controller.ts` (create if not present)

```typescript
@Get('history')
@UseGuards(JwtAuthGuard)
@ApiOperation({ summary: 'Get notification history for the authenticated user (US-074)' })
async getHistory(
  @Query() dto: NotificationHistoryQueryDto,
  @CurrentUser() user: CurrentUserPayload,
): Promise<{ success: boolean; data: Notification[]; meta: { page: number; limit: number; total: number } }> {
  const page = dto.page ?? 1;
  const limit = Math.min(dto.limit ?? 20, 100);
  const [data, total] = await this.notificationService.findByRecipient(
    user.sub,
    limit,
    (page - 1) * limit,
  );
  return { success: true, data, meta: { page, limit, total } };
}
```

`NotificationService.findByRecipient` already exists — no service changes needed.

**Verify Batch 6:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 7 — Unit Tests

### Task 19 — Write certification-state-machine.spec.ts

**New file:** `test/unit/certification/certification-state-machine.spec.ts`

Test all 7 guard scenarios — each calls a service method with the wrong `currentStatus` and asserts `BadRequestException` is thrown. Also test that `applyTransition` writes the correct `CertificationEvent` shape.

Key test cases:

- `submitRequest` with `currentStatus = SUBMITTED` → throws
- `startReview` with `currentStatus = DRAFT` → throws
- `scheduleInspectionChain` with `currentStatus = SUBMITTED` → throws
- `startInspection` with `currentStatus = DOCUMENT_REVIEW` → throws
- `completeInspectionChain` with `currentStatus = INSPECTION_SCHEDULED` → throws
- `requestLab` with `currentStatus = INSPECTION_IN_PROGRESS` → throws
- `receiveLabResults` with no matching LAB_TESTING cert → logs warn, no throw

---

### Task 20 — Update certification.service.spec.ts for new transitions

**File:** `test/unit/certification/certification.service.spec.ts`

Add mock for `CertificationEvent` repository. Add tests for each of the 6 REST-triggered transitions — verify:

- `certRepo.findOne` called with correct `where`
- `dataSource.transaction` called
- `CertificationEvent` inserted with correct `eventType`, `fromStatus`, `toStatus`
- `currentStatus` updated on returned entity
- Kafka producer called with correct event type

---

### Task 21 — Update cooperative + product service unit tests

**File:** `test/unit/cooperative/cooperative.service.spec.ts`

Add:

- `getMembers` — mock `findAndCount`, assert pagination params
- `updateMember` — assert self-update guard (`requesterId !== memberId` → throws), assert save called

**File:** `test/unit/product/product.service.spec.ts`

Add:

- `searchProducts` with `productTypeCode` filter → assert QB `andWhere` called with code
- `searchProducts` with `regionCode` filter → assert QB `andWhere` called with region
- `searchProducts` with no filters → no `andWhere` calls

**Verify Batch 7:** `npm run test:unit -- --coverage` — assert 80%+ on modified files

---

## Batch 8 — Integration + E2E Tests

### Task 22 — Write certification-chain.integration.ts

**New file:** `test/integration/certification/certification-chain.integration.ts`

Uses Testcontainers (PostgreSQL). Seeds one Certification in DRAFT status. Walks all 7 transitions in sequence using the service directly (no HTTP). After each transition:

- Assert `cert.currentStatus` equals expected enum value
- Assert `certificationEvents` table has one more row
- Assert the latest event has correct `fromStatus`, `toStatus`, `eventType`

Final assertion: 7 rows in `certification_events` for the seeded certification ID.

---

### Task 23 — Write product-search.integration.ts

**New file:** `test/integration/product/product-search.integration.ts`

Seeds:

- 2 `ProductType` rows: `{ code: 'ARGAN_OIL', regionCode: 'SOUSS-MASSA' }`, `{ code: 'SAFFRON', regionCode: 'DRAA-TAFILALET' }`
- 4 `Product` rows: 2 ARGAN_OIL, 1 SAFFRON, 1 ARGAN_OIL

Tests:

- `searchProducts({ productTypeCode: 'ARGAN_OIL' })` → returns 3 products
- `searchProducts({ regionCode: 'DRAA-TAFILALET' })` → returns 1 product
- `searchProducts({})` → returns all 4 products
- `searchProducts({ page: 1, limit: 2 })` → `total = 4`, `data.length = 2`

---

### Task 24 — Write certification-chain.e2e.ts

**New file:** `test/e2e/certification/certification-chain.e2e.ts`

Creates a full NestJS test app via `createTestApp()`. Seeds a Certification in DRAFT. Makes HTTP calls in sequence using Supertest with role-appropriate JWT headers:

| Call                                           | JWT Role             | Expected Status |
| ---------------------------------------------- | -------------------- | --------------- |
| `POST /certifications/:id/submit`              | `cooperative-admin`  | 200             |
| `POST /certifications/:id/start-review`        | `certification-body` | 200             |
| `POST /certifications/:id/schedule-inspection` | `certification-body` | 200             |
| `POST /certifications/:id/start-inspection`    | `inspector`          | 200             |
| `POST /certifications/:id/complete-inspection` | `inspector`          | 200             |
| `POST /certifications/:id/request-lab`         | `certification-body` | 200             |

Out-of-order test: re-call `POST /certifications/:id/submit` on an already-SUBMITTED cert → assert `400 Bad Request`.

Wrong-role test: call `POST /certifications/:id/start-review` with `cooperative-admin` JWT → assert `403 Forbidden`.

**Verify Batch 8:** `npm run test:integration && npm run test:e2e`

---

## Final Verification

After all batches complete:

```bash
npm run lint
npm run typecheck
npm run test:unit -- --coverage
npm run test:integration
npm run test:e2e
```

Update `docs/project-management/PRODUCT-BACKLOG.md`:

- Mark US-008, US-009, US-015, US-074 as **Done**

Update `.sessions/current-state.json`:

- `chain_steps_implemented: 7` (steps 1–7; step 8 is LAB_RESULTS_RECEIVED terminal for sprint 2)
- `current_sprint.sprint_number: 2`

---

## Story Point Summary

| Batch                                   | Tasks        | Points     |
| --------------------------------------- | ------------ | ---------- |
| Batch 1: Enum + Entity                  | 1–3          | 5          |
| Batch 2: Migration + Interfaces         | 4–6          | 5          |
| Batch 3: Steps 1–3                      | 7–9          | 6          |
| Batch 4: Steps 4–7                      | 10–12        | 6          |
| Batch 5: Member Management              | 13–15        | 5          |
| Batch 6: Product Search + Notifications | 16–18        | 3          |
| Batch 7: Unit Tests                     | 19–21        | —          |
| Batch 8: Integration + E2E              | 22–24        | —          |
| **Total**                               | **24 tasks** | **30 pts** |
