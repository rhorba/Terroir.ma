# Certification Chain Steps 8–12 Implementation Plan

> **For Claude:** Use /execute to implement this plan task-by-task.

**Goal:** Complete the 12-step SDOQ certification state machine with full `CertificationEvent` ledger coverage, renewal flow, and QR "superseded" response.

**Architecture:** `CertificationService.applyTransition()` pattern (Sprint 2) extended to grant/deny/revoke/startFinalReview/renewCertification. Kafka events for all new transitions. `QrCodeService.verifyQrCode()` updated to handle `RENEWED` status.

**Tech Stack:** NestJS, TypeScript, PostgreSQL + PostGIS, Redpanda, Keycloak, Redis

**Modules Affected:** certification (primary), notification (new Kafka consumers)

**Estimated Story Points:** 21

---

## Batch 1 — Enum changes + Kafka interfaces + migration (Tasks 1–3)

### Task 1 — Add `RENEWED`, `FINAL_REVIEW_STARTED`, `CERTIFICATE_RENEWED` to enums

**File:** `src/modules/certification/entities/certification.entity.ts`

In `CertificationStatus`, add after `REVOKED`:

```ts
RENEWED = 'RENEWED',
```

In `CertificationEventType`, add after `CERTIFICATE_REVOKED`:

```ts
FINAL_REVIEW_STARTED = 'FINAL_REVIEW_STARTED',
CERTIFICATE_RENEWED  = 'CERTIFICATE_RENEWED',
```

**Verification:** `grep -n "RENEWED\|FINAL_REVIEW_STARTED\|CERTIFICATE_RENEWED" src/modules/certification/entities/certification.entity.ts`

---

### Task 2 — Add `CertificationFinalReviewStartedEvent` and `CertificationRenewedEvent` interfaces

**File:** `src/common/interfaces/events/certification.events.ts`

Append at bottom of file:

```ts
// Sprint 3 — steps 8 and 12

export interface CertificationFinalReviewStartedEvent extends BaseEvent {
  certificationId: string;
  cooperativeId: string;
  actorId: string;
}

export interface CertificationRenewedEvent extends BaseEvent {
  oldCertificationId: string;
  newCertificationId: string;
  cooperativeId: string;
  renewedBy: string;
}
```

**Verification:** `npm run typecheck` — no errors.

---

### Task 3 — Comment migration (documents RENEWED status for audit log)

**File:** `src/database/migrations/1700000000006-AddRenewedStatus.ts` (create new)

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Documents addition of RENEWED status to CertificationStatus enum.
 * No DDL change required — current_status is varchar(30), no DB-level enum.
 * Also documents FINAL_REVIEW_STARTED and CERTIFICATE_RENEWED event types.
 */
export class AddRenewedStatus1700000000006 implements MigrationInterface {
  name = 'AddRenewedStatus1700000000006';

  async up(_queryRunner: QueryRunner): Promise<void> {
    // No DDL required — varchar(30) column accepts new values without migration.
    // This migration documents the schema intent for the audit log.
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    // No DDL to revert.
  }
}
```

**Batch 1 verification:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 2 — Producer methods + Step 8 DTO + `startFinalReview` (Tasks 4–6)

### Task 4 — Add `publishFinalReviewStarted` and `publishCertificationRenewed` to producer

**File:** `src/modules/certification/events/certification.producer.ts`

Add import at top (merge into existing `import type { ... }` block):

```ts
import type {
  // ... existing imports ...
  CertificationFinalReviewStartedEvent,
  CertificationRenewedEvent,
} from '../../../common/interfaces/events/certification.events';
```

Append two new methods before the closing `}` of the class:

```ts
async publishFinalReviewStarted(
  certification: Certification,
  actorId: string,
  correlationId: string,
): Promise<void> {
  const event: CertificationFinalReviewStartedEvent = {
    eventId: uuidv4(),
    correlationId,
    timestamp: new Date().toISOString(),
    version: 1,
    source: 'certification',
    certificationId: certification.id,
    cooperativeId: certification.cooperativeId,
    actorId,
  };
  try {
    await this.kafkaClient.emit('certification.review.final-started', event).toPromise();
    this.logger.log({ eventId: event.eventId, certificationId: certification.id }, 'Final review started event published');
  } catch (error) {
    this.logger.error({ error, certificationId: certification.id }, 'Failed to publish final review started event');
  }
}

async publishCertificationRenewed(
  oldCertification: Certification,
  newCertificationId: string,
  renewedBy: string,
  correlationId: string,
): Promise<void> {
  const event: CertificationRenewedEvent = {
    eventId: uuidv4(),
    correlationId,
    timestamp: new Date().toISOString(),
    version: 1,
    source: 'certification',
    oldCertificationId: oldCertification.id,
    newCertificationId,
    cooperativeId: oldCertification.cooperativeId,
    renewedBy,
  };
  try {
    await this.kafkaClient.emit('certification.renewed', event).toPromise();
    this.logger.log({ eventId: event.eventId, oldCertificationId: oldCertification.id, newCertificationId }, 'Certification renewed event published');
  } catch (error) {
    this.logger.error({ error, oldCertificationId: oldCertification.id }, 'Failed to publish certification renewed event');
  }
}
```

**Verification:** `npm run typecheck` — no errors.

---

### Task 5 — Create `StartFinalReviewDto`

**File:** `src/modules/certification/dto/start-final-review.dto.ts` (create new)

```ts
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class StartFinalReviewDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}
```

**Verification:** file exists, `npm run typecheck` clean.

---

### Task 6 — Add `startFinalReview` to `CertificationService`

**File:** `src/modules/certification/services/certification.service.ts`

Add after the `receiveLabResults` method (Step 7), before the `// ─── Private Helpers` comment:

```ts
/**
 * Step 8: certification-body moves to final review.
 * LAB_RESULTS_RECEIVED → UNDER_REVIEW
 */
async startFinalReview(
  id: string,
  actorId: string,
  actorRole: string,
  correlationId: string,
): Promise<Certification> {
  const cert = await this.findById(id);
  this.assertStatus(cert, CertificationStatus.LAB_RESULTS_RECEIVED);
  const updated = await this.applyTransition(
    cert, CertificationEventType.FINAL_REVIEW_STARTED,
    CertificationStatus.UNDER_REVIEW, actorId, actorRole, null, correlationId,
  );
  await this.producer.publishFinalReviewStarted(updated, actorId, correlationId);
  return updated;
}
```

**Batch 2 verification:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 3 — Refactor `grantCertification`, `denyCertification`, `revokeCertification` (Tasks 7–9)

### Task 7 — Refactor `grantCertification` through `applyTransition`

**File:** `src/modules/certification/services/certification.service.ts`

Replace the full `grantCertification` method with:

```ts
async grantCertification(
  id: string,
  dto: GrantCertificationDto,
  grantedBy: string,
  actorRole: string,
  correlationId: string,
): Promise<Certification> {
  const cert = await this.findById(id);
  this.assertStatus(cert, CertificationStatus.UNDER_REVIEW);

  const certificationNumber = await this.generateCertificationNumber(cert);

  // Set audit fields on entity before applyTransition saves it atomically
  cert.certificationNumber = certificationNumber;
  cert.grantedBy = grantedBy;
  cert.grantedAt = new Date();
  cert.validFrom = dto.validFrom;
  cert.validUntil = dto.validUntil;

  const updated = await this.applyTransition(
    cert, CertificationEventType.DECISION_GRANTED,
    CertificationStatus.GRANTED, grantedBy, actorRole,
    { certificationNumber, validFrom: dto.validFrom, validUntil: dto.validUntil },
    correlationId,
  );

  const qrCode = await this.qrCodeService.generateQrCode(updated.id, correlationId);
  await this.producer.publishCertificationGranted(updated, qrCode.id, grantedBy, correlationId);

  this.logger.log({ certificationId: id, certificationNumber }, 'Certification granted');
  return updated;
}
```

Also update the **controller** `grantCertification` call to pass `actorRole`:

```ts
// In CertificationController.grantCertification():
const role = user.realm_access?.roles?.[0] ?? 'certification-body';
return this.certificationService.grantCertification(id, dto, user.sub, role, correlationId);
```

**Verification:** `npm run typecheck` — no errors on method signature change.

---

### Task 8 — Refactor `denyCertification` through `applyTransition`

**File:** `src/modules/certification/services/certification.service.ts`

Replace the full `denyCertification` method with:

```ts
async denyCertification(
  id: string,
  dto: DenyCertificationDto,
  deniedBy: string,
  actorRole: string,
  correlationId: string,
): Promise<Certification> {
  const cert = await this.findById(id);
  this.assertStatus(cert, CertificationStatus.UNDER_REVIEW);

  cert.deniedBy = deniedBy;
  cert.deniedAt = new Date();
  cert.denialReason = dto.reason;

  const updated = await this.applyTransition(
    cert, CertificationEventType.DECISION_DENIED,
    CertificationStatus.DENIED, deniedBy, actorRole,
    { reason: dto.reason }, correlationId,
  );

  await this.producer.publishCertificationDenied(updated, deniedBy, dto.reason, correlationId);
  return updated;
}
```

Also update the **controller** `denyCertification` call:

```ts
// In CertificationController.denyCertification():
const role = user.realm_access?.roles?.[0] ?? 'certification-body';
return this.certificationService.denyCertification(id, dto, user.sub, role, correlationId);
```

**Verification:** `npm run typecheck` — no errors.

---

### Task 9 — Refactor `revokeCertification` through `applyTransition`

**File:** `src/modules/certification/services/certification.service.ts`

Replace the full `revokeCertification` method with:

```ts
async revokeCertification(
  id: string,
  reason: string,
  revokedBy: string,
  actorRole: string,
  correlationId: string,
): Promise<Certification> {
  const cert = await this.findById(id);
  this.assertStatus(cert, CertificationStatus.GRANTED);

  cert.revokedBy = revokedBy;
  cert.revokedAt = new Date();
  cert.revocationReason = reason;

  const updated = await this.applyTransition(
    cert, CertificationEventType.CERTIFICATE_REVOKED,
    CertificationStatus.REVOKED, revokedBy, actorRole,
    { reason }, correlationId,
  );

  await this.qrCodeService.deactivateByCertificationId(updated.id);
  await this.producer.publishCertificationRevoked(updated, revokedBy, reason, correlationId);
  return updated;
}
```

Also update the **controller** `revokeCertification` call:

```ts
// In CertificationController.revokeCertification():
const role = user.realm_access?.roles?.[0] ?? 'certification-body';
return this.certificationService.revokeCertification(id, reason, user.sub, role, correlationId);
```

**Batch 3 verification:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 4 — `renewCertification` + QR update + controller endpoints (Tasks 10–12)

### Task 10 — Add `renewCertification` to `CertificationService`

**File:** `src/modules/certification/services/certification.service.ts`

Add after `startFinalReview` (Step 8), before `// ─── Private Helpers`:

```ts
/**
 * Step 12: cooperative-admin renews a granted certification.
 * Old cert: GRANTED → RENEWED (appends CERTIFICATE_RENEWED event, QR stays active).
 * New cert: created in DRAFT with renewedFromId pointing to old cert.
 * Returns the new DRAFT certification.
 */
async renewCertification(
  id: string,
  actorId: string,
  actorRole: string,
  correlationId: string,
): Promise<Certification> {
  const oldCert = await this.findById(id);
  this.assertStatus(oldCert, CertificationStatus.GRANTED);

  // Move old cert to RENEWED (QR stays active — returns "superseded" to consumers)
  await this.applyTransition(
    oldCert, CertificationEventType.CERTIFICATE_RENEWED,
    CertificationStatus.RENEWED, actorId, actorRole, null, correlationId,
  );

  // Create new DRAFT cert linked to old cert
  const newCert = this.certRepo.create({
    cooperativeId: oldCert.cooperativeId,
    cooperativeName: oldCert.cooperativeName,
    batchId: oldCert.batchId,
    productTypeCode: oldCert.productTypeCode,
    certificationType: oldCert.certificationType,
    regionCode: oldCert.regionCode,
    requestedBy: actorId,
    requestedAt: new Date(),
    currentStatus: CertificationStatus.DRAFT,
    createdBy: actorId,
    renewedFromId: oldCert.id,
  });
  const saved = await this.certRepo.save(newCert);

  await this.producer.publishCertificationRenewed(oldCert, saved.id, actorId, correlationId);

  this.logger.log(
    { oldCertId: oldCert.id, newCertId: saved.id },
    'Certification renewal initiated',
  );
  return saved;
}
```

**Verification:** `npm run typecheck` — no errors.

---

### Task 11 — Update `QrVerificationResult` + `verifyQrCode` for `RENEWED` status

**File:** `src/modules/certification/services/qr-code.service.ts`

1. Add `newCertificationNumber` to `QrVerificationResult` interface:

```ts
export interface QrVerificationResult {
  valid: boolean;
  certification: Certification | null;
  qrCode: QrCode | null;
  message: string;
  newCertificationNumber?: string | null; // populated when certification is RENEWED
}
```

2. In `verifyQrCode()`, replace the block:

```ts
if (!certification || certification.currentStatus !== CertificationStatus.GRANTED) {
  return {
    valid: false,
    certification,
    qrCode,
    message: `Certification is not active (status: ${certification?.currentStatus ?? 'not found'})`,
  };
}
```

With:

```ts
if (!certification) {
  return {
    valid: false,
    certification: null,
    qrCode,
    message: 'Certification not found',
  };
}

if (certification.currentStatus === CertificationStatus.RENEWED) {
  // Find the successor cert to surface its number to the consumer
  const successor = await this.certificationRepo.findOne({
    where: { renewedFromId: certification.id },
  });
  await this.qrCodeRepo.increment({ id: qrCode.id }, 'scansCount', 1);
  return {
    valid: false,
    certification,
    qrCode: { ...qrCode, scansCount: qrCode.scansCount + 1 },
    newCertificationNumber: successor?.certificationNumber ?? null,
    message: successor?.certificationNumber
      ? `Certificate renewed. New certificate: ${successor.certificationNumber}`
      : 'Certificate has been renewed. New certificate pending issuance.',
  };
}

if (certification.currentStatus !== CertificationStatus.GRANTED) {
  return {
    valid: false,
    certification,
    qrCode,
    message: `Certification is not active (status: ${certification.currentStatus})`,
  };
}
```

**Verification:** `npm run typecheck` — no errors.

---

### Task 12 — Add `POST :id/start-final-review` and `POST :id/renew` to controller

**File:** `src/modules/certification/controllers/certification.controller.ts`

Add import for new DTOs:

```ts
import { StartFinalReviewDto } from '../dto/start-final-review.dto';
```

Add two new endpoint methods after the `requestLab` method:

```ts
/** Step 8: Certification body starts final review after lab results received */
@Post(':id/start-final-review')
@UseGuards(RolesGuard)
@Roles('certification-body')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Step 8: Start final review of lab results' })
@ApiParam({ name: 'id', description: 'Certification UUID' })
async startFinalReview(
  @Param('id') id: string,
  @Body() _dto: StartFinalReviewDto,
  @CurrentUser() user: CurrentUserPayload,
  @Headers('x-correlation-id') correlationId = '',
): Promise<Certification> {
  const role = user.realm_access?.roles?.[0] ?? 'certification-body';
  return this.certificationService.startFinalReview(id, user.sub, role, correlationId);
}

/** Step 12: Cooperative admin renews a granted certification */
@Post(':id/renew')
@UseGuards(RolesGuard)
@Roles('cooperative-admin')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Step 12: Renew a granted certification' })
@ApiParam({ name: 'id', description: 'Certification UUID' })
async renewCertification(
  @Param('id') id: string,
  @CurrentUser() user: CurrentUserPayload,
  @Headers('x-correlation-id') correlationId = '',
): Promise<Certification> {
  const role = user.realm_access?.roles?.[0] ?? 'cooperative-admin';
  return this.certificationService.renewCertification(id, user.sub, role, correlationId);
}
```

**Batch 4 verification:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 5 — Notification listener + unit tests (Tasks 13–15)

### Task 13 — Add Kafka listeners for new events

**File:** `src/modules/certification/listeners/certification.listener.ts`

Add to the import:

```ts
import type {
  LabTestCompletedEvent,
  CooperativeRegistrationVerifiedEvent,
  CertificationFinalReviewStartedEvent,
  CertificationRenewedEvent,
} from '../../../common/interfaces/events';
```

Append two new handler methods inside the class:

```ts
@EventPattern('certification.review.final-started')
async handleFinalReviewStarted(
  @Payload() data: CertificationFinalReviewStartedEvent,
  @Ctx() _context: KafkaContext,
): Promise<void> {
  this.logger.log(
    { eventId: data.eventId, certificationId: data.certificationId },
    'Certification moved to final review — notification module will handle email',
  );
}

@EventPattern('certification.renewed')
async handleCertificationRenewed(
  @Payload() data: CertificationRenewedEvent,
  @Ctx() _context: KafkaContext,
): Promise<void> {
  this.logger.log(
    { eventId: data.eventId, oldCertId: data.oldCertificationId, newCertId: data.newCertificationId },
    'Certification renewed — notification module will handle email',
  );
}
```

Also check `src/common/interfaces/events/index.ts` — ensure `CertificationFinalReviewStartedEvent` and `CertificationRenewedEvent` are re-exported.

**File:** `src/common/interfaces/events/index.ts` — add if missing:

```ts
export type {
  CertificationFinalReviewStartedEvent,
  CertificationRenewedEvent,
} from './certification.events';
```

**Verification:** `npm run typecheck` — no errors.

---

### Task 14 — Unit tests: state machine guards for Steps 8–12

**File:** `test/unit/certification/certification-state-machine.spec.ts`

Update the `mockProducer` factory to include the new producer methods:

```ts
const mockProducer = () => ({
  publishCertificationRequested: jest.fn().mockResolvedValue(undefined),
  publishCertificationGranted: jest.fn().mockResolvedValue(undefined),
  publishCertificationDenied: jest.fn().mockResolvedValue(undefined),
  publishCertificationRevoked: jest.fn().mockResolvedValue(undefined),
  publishFinalReviewStarted: jest.fn().mockResolvedValue(undefined),
  publishCertificationRenewed: jest.fn().mockResolvedValue(undefined),
});
```

Also update `mockDataSource` to include a working transaction mock for Steps 8–12:

```ts
const mockDataSource = () => ({
  transaction: jest.fn().mockImplementation(async (cb) =>
    cb({
      create: jest.fn().mockReturnValue({}),
      save: jest.fn().mockImplementation((_, entity) => Promise.resolve(entity)),
    }),
  ),
  query: jest.fn(),
});
```

Add the following `describe` blocks (append before the closing `}` of the outer `describe`):

```ts
describe('startFinalReview — LAB_RESULTS_RECEIVED only', () => {
  it('throws when status is UNDER_REVIEW (not LAB_RESULTS_RECEIVED)', async () => {
    certRepo.findOne.mockResolvedValue(makeCert(CertificationStatus.UNDER_REVIEW));
    await expect(
      service.startFinalReview('cert-uuid', 'actor-id', 'certification-body', 'corr-id'),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('grantCertification — UNDER_REVIEW only (tightened from Sprint 2)', () => {
  it('throws when status is LAB_RESULTS_RECEIVED (guard now strict to UNDER_REVIEW)', async () => {
    certRepo.findOne.mockResolvedValue(makeCert(CertificationStatus.LAB_RESULTS_RECEIVED));
    await expect(
      service.grantCertification(
        'cert-uuid',
        { validFrom: '2026-01-01', validUntil: '2027-01-01' } as any,
        'actor-id',
        'certification-body',
        'corr-id',
      ),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('denyCertification — UNDER_REVIEW only (tightened from Sprint 2)', () => {
  it('throws when status is LAB_RESULTS_RECEIVED (guard now strict to UNDER_REVIEW)', async () => {
    certRepo.findOne.mockResolvedValue(makeCert(CertificationStatus.LAB_RESULTS_RECEIVED));
    await expect(
      service.denyCertification(
        'cert-uuid',
        { reason: 'Failed lab' } as any,
        'actor-id',
        'certification-body',
        'corr-id',
      ),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('renewCertification — GRANTED only', () => {
  it('throws when status is UNDER_REVIEW (not GRANTED)', async () => {
    certRepo.findOne.mockResolvedValue(makeCert(CertificationStatus.UNDER_REVIEW));
    await expect(
      service.renewCertification('cert-uuid', 'actor-id', 'cooperative-admin', 'corr-id'),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws when status is RENEWED (cannot renew twice without re-granting)', async () => {
    certRepo.findOne.mockResolvedValue(makeCert(CertificationStatus.RENEWED));
    await expect(
      service.renewCertification('cert-uuid', 'actor-id', 'cooperative-admin', 'corr-id'),
    ).rejects.toThrow(BadRequestException);
  });
});
```

**Verification:** `npm run test:unit` — all tests pass.

---

### Task 15 — Unit test: `verifyQrCode` returns `superseded` for `RENEWED` cert

**File:** `test/unit/certification/qr-code.service.spec.ts`

Find the existing `verifyQrCode` describe block and add:

```ts
it('returns superseded with newCertificationNumber when cert is RENEWED', async () => {
  const renewedCert = { id: 'cert-uuid', currentStatus: CertificationStatus.RENEWED };
  const successorCert = {
    id: 'new-cert-uuid',
    certificationNumber: 'TERROIR-IGP-SFI-2026-001',
    currentStatus: CertificationStatus.DRAFT,
  };
  const activeQr = {
    id: 'qr-uuid',
    certificationId: 'cert-uuid',
    isActive: true,
    scansCount: 0,
    expiresAt: null,
  };

  qrCodeRepo.findOne.mockResolvedValue(activeQr);
  certRepo.findOne
    .mockResolvedValueOnce(renewedCert) // main cert lookup
    .mockResolvedValueOnce(successorCert); // successor lookup
  qrCodeRepo.increment.mockResolvedValue(undefined);

  const result = await service.verifyQrCode('valid-sig');
  expect(result.valid).toBe(false);
  expect(result.newCertificationNumber).toBe('TERROIR-IGP-SFI-2026-001');
  expect(result.message).toContain('TERROIR-IGP-SFI-2026-001');
});

it('returns valid true for a GRANTED cert (regression)', async () => {
  const grantedCert = { id: 'cert-uuid', currentStatus: CertificationStatus.GRANTED };
  const activeQr = {
    id: 'qr-uuid',
    certificationId: 'cert-uuid',
    isActive: true,
    scansCount: 5,
    expiresAt: null,
  };

  qrCodeRepo.findOne.mockResolvedValue(activeQr);
  certRepo.findOne.mockResolvedValue(grantedCert);
  qrCodeRepo.increment.mockResolvedValue(undefined);

  const result = await service.verifyQrCode('valid-sig');
  expect(result.valid).toBe(true);
});
```

**Batch 5 verification:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 6 — Integration + E2E tests + final verification (Tasks 16–18)

### Task 16 — Extend integration test with Steps 8–12

**File:** `test/integration/certification/certification-chain.integration.ts`

Add a second `it` block inside the existing `describe`:

```ts
it('walks UNDER_REVIEW → RENEWED and creates a new DRAFT with renewedFromId', async () => {
  // Seed at LAB_RESULTS_RECEIVED (shortcut for test speed)
  const cert = certRepo.create({
    cooperativeId: 'coop-uuid',
    cooperativeName: 'Test Cooperative',
    batchId: 'batch-uuid-steps8to12',
    productTypeCode: 'ARGAN_OIL',
    certificationType: 'IGP',
    regionCode: 'SFI',
    requestedBy: 'user-uuid',
    requestedAt: new Date(),
    currentStatus: CertificationStatus.LAB_RESULTS_RECEIVED,
    createdBy: 'user-uuid',
  });
  const saved = await certRepo.save(cert);
  const id = saved.id;

  // Step 8: LAB_RESULTS_RECEIVED → UNDER_REVIEW
  let updated = await service.startFinalReview(id, 'reviewer-uuid', 'certification-body', 'corr-8');
  expect(updated.currentStatus).toBe(CertificationStatus.UNDER_REVIEW);

  // Step 9: UNDER_REVIEW → GRANTED
  updated = await service.grantCertification(
    id,
    { validFrom: '2026-05-01', validUntil: '2027-05-01' },
    'reviewer-uuid',
    'certification-body',
    'corr-9',
  );
  expect(updated.currentStatus).toBe(CertificationStatus.GRANTED);
  expect(updated.certificationNumber).toMatch(/^TERROIR-IGP-SFI-\d{4}-\d{3}$/);

  // Step 12: GRANTED → RENEWED (old cert) + new DRAFT
  const newCert = await service.renewCertification(id, 'user-uuid', 'cooperative-admin', 'corr-12');
  expect(newCert.currentStatus).toBe(CertificationStatus.DRAFT);
  expect(newCert.renewedFromId).toBe(id);

  const oldCert = await certRepo.findOneBy({ id });
  expect(oldCert!.currentStatus).toBe(CertificationStatus.RENEWED);

  // Verify CertificationEvent rows: 3 events (steps 8, 9, 12)
  const events = await eventRepo.find({
    where: { certificationId: id },
    order: { occurredAt: 'ASC' },
  });
  expect(events).toHaveLength(3);
  expect(events[0]!.eventType).toBe(CertificationEventType.FINAL_REVIEW_STARTED);
  expect(events[1]!.eventType).toBe(CertificationEventType.DECISION_GRANTED);
  expect(events[2]!.eventType).toBe(CertificationEventType.CERTIFICATE_RENEWED);
}, 30_000);

it('walks UNDER_REVIEW → DENIED (Step 10)', async () => {
  const cert = certRepo.create({
    cooperativeId: 'coop-uuid',
    cooperativeName: 'Test Cooperative',
    batchId: 'batch-uuid-deny',
    productTypeCode: 'ARGAN_OIL',
    certificationType: 'IGP',
    regionCode: 'SFI',
    requestedBy: 'user-uuid',
    requestedAt: new Date(),
    currentStatus: CertificationStatus.UNDER_REVIEW,
    createdBy: 'user-uuid',
  });
  const saved = await certRepo.save(cert);

  const denied = await service.denyCertification(
    saved.id,
    { reason: 'Lab results below threshold' },
    'reviewer-uuid',
    'certification-body',
    'corr-10',
  );
  expect(denied.currentStatus).toBe(CertificationStatus.DENIED);
  expect(denied.denialReason).toBe('Lab results below threshold');

  const events = await eventRepo.find({ where: { certificationId: saved.id } });
  expect(events).toHaveLength(1);
  expect(events[0]!.eventType).toBe(CertificationEventType.DECISION_DENIED);
}, 30_000);
```

**Verification:** integration tests run with `npm run test:integration` (requires Docker).

---

### Task 17 — E2E tests for Steps 8–12

**File:** `test/e2e/certification/certification-chain.e2e.ts`

Add a new `describe` block at the bottom of the file (before the closing `}`):

```ts
describe('Steps 8–12: final review, grant, renew', () => {
  it('walks start-final-review → grant → renew in correct order and roles', async () => {
    const certId = await seedDraftCertification();

    // Advance to LAB_RESULTS_RECEIVED via DB (skip steps 1–7 for speed)
    const repo = dataSource.getRepository(Certification);
    await repo.update(certId, { currentStatus: CertificationStatus.LAB_RESULTS_RECEIVED });

    // Step 8: LAB_RESULTS_RECEIVED → UNDER_REVIEW (certification-body)
    await request(app.getHttpServer())
      .post(`/certifications/${certId}/start-final-review`)
      .set(bearerHeader(certBodyToken))
      .send({})
      .expect(200)
      .expect((res) => {
        expect(res.body.currentStatus).toBe(CertificationStatus.UNDER_REVIEW);
      });

    // Step 9: UNDER_REVIEW → GRANTED (certification-body)
    await request(app.getHttpServer())
      .post(`/certifications/${certId}/grant`) // NOTE: PATCH → POST if controller uses @Post
      .set(bearerHeader(certBodyToken))
      .send({ validFrom: '2026-05-01', validUntil: '2027-05-01' })
      .expect((res) => {
        expect([200, 204]).toContain(res.status);
        expect(res.body.currentStatus).toBe(CertificationStatus.GRANTED);
      });

    // Step 12: GRANTED → RENEWED + new DRAFT (cooperative-admin)
    await request(app.getHttpServer())
      .post(`/certifications/${certId}/renew`)
      .set(bearerHeader(cooperativeAdminToken))
      .send({})
      .expect(200)
      .expect((res) => {
        expect(res.body.currentStatus).toBe(CertificationStatus.DRAFT);
        expect(res.body.renewedFromId).toBe(certId);
      });
  });

  it('returns 403 when cooperative-admin calls start-final-review', async () => {
    const certId = await seedDraftCertification();
    await dataSource.getRepository(Certification).update(certId, {
      currentStatus: CertificationStatus.LAB_RESULTS_RECEIVED,
    });
    await request(app.getHttpServer())
      .post(`/certifications/${certId}/start-final-review`)
      .set(bearerHeader(cooperativeAdminToken))
      .send({})
      .expect(403);
  });

  it('returns 400 when grant is called before start-final-review (UNDER_REVIEW guard)', async () => {
    const certId = await seedDraftCertification();
    await dataSource.getRepository(Certification).update(certId, {
      currentStatus: CertificationStatus.LAB_RESULTS_RECEIVED,
    });
    // Grant directly on LAB_RESULTS_RECEIVED → should 400 (guard now strict)
    await request(app.getHttpServer())
      .patch(`/certifications/${certId}/grant`)
      .set(bearerHeader(certBodyToken))
      .send({ validFrom: '2026-05-01', validUntil: '2027-05-01' })
      .expect(400);
  });
});
```

Also add `certBodyToken` back to the E2E test setup (it was removed in Sprint 2 cleanup but is needed here):

```ts
// In beforeAll:
certBodyToken = buildMockJwt(buildJwtPayload('certification-body'));
// In class-level declarations:
let certBodyToken: string;
```

**Verification:** `npm run test:e2e` (requires Docker + createTestApp).

---

### Task 18 — Final verification pass

Run the full suite:

```bash
npm run lint && npm run typecheck && npm run test:unit
```

Confirm:

- No lint errors (except pre-existing `app.module.ts` suppressed with eslint-disable)
- Zero TypeScript errors
- All unit tests green (target: ~85 tests)
- Update `.sessions/current-state.json`: `chain_steps_implemented: 12`
- Update `docs/plans/2026-04-10-certification-chain-steps-8-12/progress.md`

---

## Summary

| Batch | Tasks | Scope                                  |
| ----- | ----- | -------------------------------------- |
| 1     | 1–3   | Enum + interfaces + migration          |
| 2     | 4–6   | Producer + DTO + startFinalReview      |
| 3     | 7–9   | Refactor grant/deny/revoke             |
| 4     | 10–12 | renewCertification + QR + controller   |
| 5     | 13–15 | Listener + unit tests                  |
| 6     | 16–18 | Integration + E2E + final verification |

**Story Points: 21**
