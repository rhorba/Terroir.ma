# Sprint 4 Production Readiness — Implementation Plan

> **For Claude:** Use /execute to implement this plan task-by-task.

**Goal:** Establish test coverage baseline ≥80%, wire Redis QR cache for the < 200ms SLA, and verify the TypeORM migration chain before production.
**Architecture:** CertificationModule (QrCodeService + cache), test suite (unit), database migrations
**Tech Stack:** NestJS, TypeScript, PostgreSQL + PostGIS, Redpanda, Keycloak, Redis
**Modules Affected:** certification (cache + tests), all modules (coverage baseline)
**Estimated Story Points:** 21

---

## Pre-flight Notes

- `synchronize: false` is already set in both `data-source.ts` and `app.module.ts` — no change needed there
- `cache-manager-redis-yet` is already in `package.json` — no new packages needed
- `qr-code.service.spec.ts` already imports `CACHE_MANAGER` as a provider (useFactory) but `QrCodeService` doesn't inject it yet — this will be fixed in Task 8+13
- `certification.service.spec.ts` mock producer is missing `publishFinalReviewStarted` and `publishCertificationRenewed` — fix in Task 5

---

## Batch 1: Coverage Baseline — Run + New Spec Files (Tasks 1–3)

### Task 1 — Run coverage baseline and record results

**Command:**

```bash
npm run test:cov 2>&1 | tee .sessions/coverage-baseline-2026-04-10.txt
```

**What to record:** Per-file coverage percentages for branches, functions, lines, statements. Note every file below 80% in any column. The build will likely fail — that's expected. Record the failure output.

**Expected gap files (based on Sprint 1–3 history):**

- `certification.listener.ts` — no unit spec exists
- `inspection.service.ts` — no unit spec exists
- Possibly: `notification.service.ts`, `export-document.service.ts`, `certification.service.ts`, `cooperative.service.ts`

**Verification:** Record output — do NOT fix yet. Move to Task 2.

---

### Task 2 — Write `test/unit/certification/certification.listener.spec.ts`

**File to create:** `test/unit/certification/certification.listener.spec.ts`

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { CertificationListener } from '../../../src/modules/certification/listeners/certification.listener';
import { CertificationService } from '../../../src/modules/certification/services/certification.service';

const mockCertificationService = {
  isEventProcessed: jest.fn(),
  receiveLabResults: jest.fn(),
};

describe('CertificationListener', () => {
  let listener: CertificationListener;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CertificationListener,
        { provide: CertificationService, useValue: mockCertificationService },
      ],
    }).compile();

    listener = module.get<CertificationListener>(CertificationListener);
  });

  describe('handleLabTestCompleted()', () => {
    const event = {
      eventId: 'evt-001',
      correlationId: 'corr-001',
      batchId: 'batch-001',
      labTestId: 'lab-001',
      passed: true,
      timestamp: new Date().toISOString(),
      version: '1',
    };

    it('calls receiveLabResults when event is not yet processed', async () => {
      mockCertificationService.isEventProcessed.mockResolvedValue(false);
      mockCertificationService.receiveLabResults.mockResolvedValue(undefined);

      await listener.handleLabTestCompleted(event, {} as never);

      expect(mockCertificationService.isEventProcessed).toHaveBeenCalledWith(event.eventId);
      expect(mockCertificationService.receiveLabResults).toHaveBeenCalledWith(
        event.batchId,
        event.labTestId,
        event.passed,
        event.eventId,
      );
    });

    it('skips processing when event is already processed (idempotency)', async () => {
      mockCertificationService.isEventProcessed.mockResolvedValue(true);

      await listener.handleLabTestCompleted(event, {} as never);

      expect(mockCertificationService.receiveLabResults).not.toHaveBeenCalled();
    });

    it('swallows errors without rethrowing', async () => {
      mockCertificationService.isEventProcessed.mockRejectedValue(new Error('DB down'));

      await expect(listener.handleLabTestCompleted(event, {} as never)).resolves.toBeUndefined();
    });
  });

  describe('handleCooperativeVerified()', () => {
    it('resolves without error', async () => {
      const event = {
        eventId: 'evt-002',
        cooperativeId: 'coop-001',
        timestamp: new Date().toISOString(),
        version: '1',
        correlationId: 'corr-002',
      };

      await expect(listener.handleCooperativeVerified(event, {} as never)).resolves.toBeUndefined();
    });
  });

  describe('handleFinalReviewStarted()', () => {
    it('resolves without error', async () => {
      const event = {
        eventId: 'evt-003',
        certificationId: 'cert-001',
        cooperativeId: 'coop-001',
        actorId: 'user-001',
        timestamp: new Date().toISOString(),
        version: '1',
        correlationId: 'corr-003',
      };

      await expect(listener.handleFinalReviewStarted(event, {} as never)).resolves.toBeUndefined();
    });
  });

  describe('handleCertificationRenewed()', () => {
    it('resolves without error', async () => {
      const event = {
        eventId: 'evt-004',
        oldCertificationId: 'cert-old',
        newCertificationId: 'cert-new',
        cooperativeId: 'coop-001',
        renewedBy: 'user-001',
        timestamp: new Date().toISOString(),
        version: '1',
        correlationId: 'corr-004',
      };

      await expect(
        listener.handleCertificationRenewed(event, {} as never),
      ).resolves.toBeUndefined();
    });
  });
});
```

**Verification:** `npm run test:unit -- --testPathPattern=certification.listener`

---

### Task 3 — Write `test/unit/certification/inspection.service.spec.ts`

**File to create:** `test/unit/certification/inspection.service.spec.ts`

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { InspectionService } from '../../../src/modules/certification/services/inspection.service';
import { Inspection } from '../../../src/modules/certification/entities/inspection.entity';
import { InspectionReport } from '../../../src/modules/certification/entities/inspection-report.entity';
import {
  Certification,
  CertificationStatus,
} from '../../../src/modules/certification/entities/certification.entity';
import { CertificationProducer } from '../../../src/modules/certification/events/certification.producer';

const makeRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  create: jest.fn().mockImplementation((dto) => ({ id: 'new-uuid', ...dto })),
  update: jest.fn().mockResolvedValue(undefined),
});

const mockProducer = {
  publishInspectionScheduled: jest.fn().mockResolvedValue(undefined),
};

describe('InspectionService', () => {
  let service: InspectionService;
  let inspectionRepo: ReturnType<typeof makeRepo>;
  let reportRepo: ReturnType<typeof makeRepo>;
  let certRepo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    jest.clearAllMocks();
    inspectionRepo = makeRepo();
    reportRepo = makeRepo();
    certRepo = makeRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InspectionService,
        { provide: getRepositoryToken(Inspection), useValue: inspectionRepo },
        { provide: getRepositoryToken(InspectionReport), useValue: reportRepo },
        { provide: getRepositoryToken(Certification), useValue: certRepo },
        { provide: CertificationProducer, useValue: mockProducer },
      ],
    }).compile();

    service = module.get<InspectionService>(InspectionService);
  });

  describe('scheduleInspection()', () => {
    const dto = {
      certificationId: 'cert-001',
      inspectorId: 'inspector-001',
      inspectorName: 'Hassan Benali',
      scheduledDate: '2026-05-01',
      farmIds: ['farm-001'],
    };

    it('creates and returns an inspection when cert exists', async () => {
      const cert = { id: 'cert-001', cooperativeId: 'coop-001' };
      const savedInspection = { id: 'insp-001', ...dto, status: 'scheduled' };
      certRepo.findOne.mockResolvedValue(cert);
      inspectionRepo.save.mockResolvedValue(savedInspection);

      const result = await service.scheduleInspection(dto, 'actor-001', 'corr-001');

      expect(certRepo.findOne).toHaveBeenCalledWith({ where: { id: dto.certificationId } });
      expect(inspectionRepo.save).toHaveBeenCalled();
      expect(certRepo.update).toHaveBeenCalledWith(
        { id: dto.certificationId },
        { currentStatus: CertificationStatus.INSPECTION_SCHEDULED },
      );
      expect(mockProducer.publishInspectionScheduled).toHaveBeenCalled();
      expect(result).toEqual(savedInspection);
    });

    it('throws NotFoundException when certification does not exist', async () => {
      certRepo.findOne.mockResolvedValue(null);

      await expect(service.scheduleInspection(dto, 'actor-001', 'corr-001')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('completeInspection()', () => {
    const dto = {
      passed: true,
      summary: 'All checks passed',
      farmFindings: [],
      nonConformities: [],
    };

    it('completes inspection and creates a report', async () => {
      const scheduledInspection = {
        id: 'insp-001',
        certificationId: 'cert-001',
        cooperativeId: 'coop-001',
        status: 'scheduled',
      };
      const savedReport = { id: 'report-001', ...dto };
      inspectionRepo.findOne.mockResolvedValue(scheduledInspection);
      reportRepo.save.mockResolvedValue(savedReport);

      const result = await service.completeInspection('insp-001', dto, 'inspector-001', 'corr-001');

      expect(inspectionRepo.update).toHaveBeenCalled();
      expect(reportRepo.save).toHaveBeenCalled();
      expect(certRepo.update).toHaveBeenCalledWith(
        { id: scheduledInspection.certificationId },
        { currentStatus: CertificationStatus.INSPECTION_COMPLETE },
      );
      expect(result).toEqual(savedReport);
    });

    it('throws NotFoundException when inspection does not exist', async () => {
      inspectionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.completeInspection('bad-id', dto, 'inspector-001', 'corr-001'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when inspection is already completed', async () => {
      inspectionRepo.findOne.mockResolvedValue({ id: 'insp-001', status: 'completed' });

      await expect(
        service.completeInspection('insp-001', dto, 'inspector-001', 'corr-001'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findById()', () => {
    it('returns inspection when found', async () => {
      const inspection = { id: 'insp-001', status: 'scheduled' };
      inspectionRepo.findOne.mockResolvedValue(inspection);

      const result = await service.findById('insp-001');

      expect(result).toEqual(inspection);
    });

    it('throws NotFoundException when not found', async () => {
      inspectionRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByCertification()', () => {
    it('returns all inspections for a certification', async () => {
      const inspections = [{ id: 'insp-001' }, { id: 'insp-002' }];
      inspectionRepo.find.mockResolvedValue(inspections);

      const result = await service.findByCertification('cert-001');

      expect(inspectionRepo.find).toHaveBeenCalledWith({
        where: { certificationId: 'cert-001' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('fileReport()', () => {
    it('delegates to completeInspection and returns inspection', async () => {
      const inspection = {
        id: 'insp-001',
        status: 'scheduled',
        certificationId: 'cert-001',
        cooperativeId: 'coop-001',
      };
      const report = { id: 'report-001', passed: true };
      const dto = { passed: true, reportSummary: 'Good', nonConformities: null };

      inspectionRepo.findOne
        .mockResolvedValueOnce(inspection) // completeInspection lookup
        .mockResolvedValueOnce(inspection); // findById at end
      reportRepo.save.mockResolvedValue(report);

      const result = await service.fileReport(
        'insp-001',
        dto as never,
        'inspector-001',
        'corr-001',
      );

      expect(result).toEqual(inspection);
    });
  });
});
```

**Verification:** `npm run test:unit -- --testPathPattern=inspection.service`

---

**Batch 1 checkpoint:**

```bash
npm run lint && npm run typecheck && npm run test:unit
```

---

## Batch 2: Coverage Gap Closure + CLAUDE.md Docs (Tasks 4–6)

### Task 4 — Fix mock producer in `certification.service.spec.ts`

**File to modify:** `test/unit/certification/certification.service.spec.ts`

The mock producer is missing `publishFinalReviewStarted` and `publishCertificationRenewed`. Add them so `startFinalReview` and `renewCertification` can be tested.

Find:

```ts
const mockProducer = () => ({
  publishCertificationRequested: jest.fn().mockResolvedValue(undefined),
  publishCertificationGranted: jest.fn().mockResolvedValue(undefined),
  publishCertificationDenied: jest.fn().mockResolvedValue(undefined),
  publishCertificationRevoked: jest.fn().mockResolvedValue(undefined),
});
```

Replace with:

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

Also add `evictQrCache` to `mockQrCodeService`:

```ts
const mockQrCodeService = () => ({
  generateQrCode: jest.fn().mockResolvedValue({ id: 'qr-uuid' }),
  deactivateByCertificationId: jest.fn().mockResolvedValue(undefined),
  evictQrCache: jest.fn().mockResolvedValue(undefined),
});
```

**Verification:** `npm run test:unit -- --testPathPattern=certification.service`

---

### Task 5 — Augment specs based on coverage baseline from Task 1

**After reviewing the Task 1 coverage output:**

For each file still below 80%, add targeted tests. Use the coverage output to identify exact uncovered lines. Common augmentations:

**`notification.service.spec.ts`** — likely missing:

- `send()` success path (email sent, status updated to 'sent')
- `send()` failure path (email throws, status updated to 'failed')
- `findByRecipient()` test
- `findById()` test

**`export-document.service.spec.ts`** — likely missing (if below 80%):

- `requestExportDocument()` success
- `requestExportDocument()` cert not found / not GRANTED throws
- `findById()` not found throws
- `validateDocument()` approves correctly
- `updateOnssaReference()` updates correctly

**`cooperative.service.spec.ts`** / **`product.service.spec.ts`** — add any method not covered.

> **NOTE:** Exact augmentation content depends on Task 1 output. Write only what's needed to reach 80%. Do not add tests for already-covered lines.

**Verification:** `npm run test:unit`

---

### Task 6 — Update CLAUDE.md with Sprint 3 retro documentation items

**File to modify:** `.claude/CLAUDE.md`

Add a new section "## Known Patterns and Pitfalls" (or append to existing Coding Standards section) with:

````markdown
## Known Patterns and Pitfalls

### Local Event Barrel Pattern (Certification module)

New Kafka event types for the certification module must be added in TWO places:

1. `src/common/interfaces/events/certification.events.ts` — the shared interface definition
2. `src/modules/certification/events/certification-events.ts` — the local re-export barrel used by `certification.producer.ts`

Forgetting step 2 causes import errors in the producer at runtime. This is a known two-file ceremony.

### TypeORM JSONB: use `em.create()` + `em.save()`, not `em.insert()`

TypeORM's `em.insert()` enforces strict JSONB typing and rejects `Record<string, unknown> | null`.
Always use the `em.create()` + `em.save()` pattern for entities with JSONB columns:

```ts
// ✅ Correct
const event = em.create(CertificationEvent, { payload: jsonbData });
await em.save(CertificationEvent, event);

// ❌ Avoid — will reject Record<string, unknown> | null
await em.insert(CertificationEvent, { payload: jsonbData });
```
````

### Test mock pattern: use `useValue` for mocks that need external control

Use `useValue` (not `useFactory`) when the test body needs to configure mock return values:

```ts
// ✅ Correct — repo is accessible in test body
const repo = makeRepo();
{ provide: getRepositoryToken(MyEntity), useValue: repo }
// ... in test: repo.findOne.mockResolvedValue(...)

// ❌ Avoid — creates isolated instance, impossible to control from test body
{ provide: getRepositoryToken(MyEntity), useFactory: makeRepo }
```

````

**Verification:** File saved, no lint/typecheck impact.

---

**Batch 2 checkpoint:**
```bash
npm run lint && npm run typecheck && npm run test:unit
````

---

## Batch 3: Redis Cache — Module + Service + verifyQrCode (Tasks 7–9)

### Task 7 — Update `certification.module.ts` to use Redis store

**File to modify:** `src/modules/certification/certification.module.ts`

Replace:

```ts
import { CacheModule } from '@nestjs/cache-manager';
```

With:

```ts
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-yet';
```

Replace:

```ts
CacheModule.register(),
```

With:

```ts
CacheModule.registerAsync({
  imports: [ConfigModule],
  useFactory: async (config: ConfigService) => ({
    store: redisStore,
    url: config.get<string>('redis.url'),
    ttl: 0,
  }),
  inject: [ConfigService],
}),
```

**Verification:** `npm run typecheck`

---

### Task 8 — Inject `CACHE_MANAGER` into `QrCodeService`

**File to modify:** `src/modules/certification/services/qr-code.service.ts`

Add imports at top:

```ts
import { Injectable, NotFoundException, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
```

Replace constructor signature:

```ts
constructor(
  @InjectRepository(QrCode)
  private readonly qrCodeRepo: Repository<QrCode>,
  @InjectRepository(Certification)
  private readonly certificationRepo: Repository<Certification>,
  private readonly configService: ConfigService,
  private readonly producer: CertificationProducer,
  @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
) {
```

**Verification:** `npm run typecheck`

---

### Task 9 — Implement cache read + write in `verifyQrCode()`

**File to modify:** `src/modules/certification/services/qr-code.service.ts`

At the top of `verifyQrCode()` method, after the method signature, insert cache read:

```ts
async verifyQrCode(hmacSignature: string, scannedFromIp?: string): Promise<QrVerificationResult> {
  const cacheKey = `qr:verify:${hmacSignature}`;
  const cached = await this.cacheManager.get<QrVerificationResult>(cacheKey);
  if (cached) {
    this.logger.debug({ hmacSignature }, 'QR verify cache hit');
    return cached;
  }

  // ... rest of existing method unchanged until return statements
```

Before each `return` statement that should be cached (GRANTED and RENEWED paths only), store result:

**GRANTED path** — the final return at the bottom of the method:

```ts
const result: QrVerificationResult = {
  valid: true,
  certification,
  qrCode: { ...qrCode, scansCount: qrCode.scansCount + 1 },
  message: 'Certification is valid and active',
};
await this.cacheManager.set(cacheKey, result, 300_000);
return result;
```

**RENEWED path** — inside the `if (certification.currentStatus === CertificationStatus.RENEWED)` block, replace the final return:

```ts
const result: QrVerificationResult = {
  valid: false,
  certification,
  qrCode: { ...qrCode, scansCount: qrCode.scansCount + 1 },
  newCertificationNumber: successor?.certificationNumber ?? null,
  message: successor?.certificationNumber
    ? `Certificate renewed. New certificate: ${successor.certificationNumber}`
    : 'Certificate has been renewed. New certificate pending issuance.',
};
await this.cacheManager.set(cacheKey, result, 300_000);
return result;
```

All other paths (not-found, expired, REVOKED, DENIED, etc.) return directly with no caching — no change needed.

**Verification:** `npm run typecheck`

---

**Batch 3 checkpoint:**

```bash
npm run lint && npm run typecheck && npm run test:unit
```

---

## Batch 4: Cache Eviction (Tasks 10–12)

### Task 10 — Evict cache in `deactivateByCertificationId()`

**File to modify:** `src/modules/certification/services/qr-code.service.ts`

Replace the existing `deactivateByCertificationId` method:

```ts
/**
 * Deactivate all QR codes for a certification.
 * Called when a certification is revoked so QR scans immediately return an error.
 * Evicts the Redis cache entry before deactivating so the next scan hits the DB.
 */
async deactivateByCertificationId(certificationId: string): Promise<void> {
  const qr = await this.qrCodeRepo.findOne({ where: { certificationId, isActive: true } });
  if (qr) {
    await this.cacheManager.del(`qr:verify:${qr.hmacSignature}`);
  }
  await this.qrCodeRepo.update(
    { certificationId, isActive: true },
    { isActive: false },
  );
  this.logger.log({ certificationId }, 'QR codes deactivated for revoked certification');
}
```

**Verification:** `npm run typecheck`

---

### Task 11 — Add `evictQrCache()` method to `QrCodeService`

**File to modify:** `src/modules/certification/services/qr-code.service.ts`

Add after `deactivateByCertificationId()`:

```ts
/**
 * Evict cached QR verification result for a certification.
 * Called when a certification transitions to RENEWED so the old token
 * immediately stops returning valid: true to consumers.
 */
async evictQrCache(certificationId: string): Promise<void> {
  const qr = await this.qrCodeRepo.findOne({ where: { certificationId, isActive: true } });
  if (qr) {
    await this.cacheManager.del(`qr:verify:${qr.hmacSignature}`);
    this.logger.debug({ certificationId }, 'QR cache evicted on renewal');
  }
}
```

**Verification:** `npm run typecheck`

---

### Task 12 — Call `evictQrCache` in `CertificationService.renewCertification()`

**File to modify:** `src/modules/certification/services/certification.service.ts`

Find the `renewCertification` method. After the call to `applyTransition` for the old cert (before creating the new draft), add:

```ts
await this.qrCodeService.evictQrCache(cert.id);
```

The relevant section should look like:

```ts
// Transition old cert to RENEWED
await this.applyTransition(cert, CertificationEventType.CERTIFICATE_RENEWED, CertificationStatus.RENEWED, actorId, actorRole, correlationId);

// Evict cached QR result — old cert is now RENEWED, cache must not serve valid: true
await this.qrCodeService.evictQrCache(cert.id);

// Create new DRAFT certification linked to old one
const newCert = this.certificationRepo.create({ ... });
```

Also update `mockQrCodeService` in `test/unit/certification/certification-state-machine.spec.ts` if it doesn't already have `evictQrCache` (Task 4 already adds it to certification.service.spec.ts):

```ts
// In certification-state-machine.spec.ts, find mockQrCodeService and add:
evictQrCache: jest.fn().mockResolvedValue(undefined),
```

**Verification:** `npm run typecheck && npm run test:unit`

---

**Batch 4 checkpoint:**

```bash
npm run lint && npm run typecheck && npm run test:unit
```

---

## Batch 5: Cache Unit Tests + Migration Verification (Tasks 13–15)

### Task 13 — Fix `useFactory` → `useValue` for CACHE_MANAGER and add cache behavior tests

**File to modify:** `test/unit/certification/qr-code.service.spec.ts`

**Step 1:** Fix the CACHE_MANAGER provider from `useFactory` to `useValue`:

Replace:

```ts
const mockCache = () => ({
  get: jest.fn(),
  set: jest.fn(),
});
```

With:

```ts
const makeCacheManager = () => ({
  get: jest.fn(),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
});
```

In `beforeEach`, add:

```ts
let cacheManager: ReturnType<typeof makeCacheManager>;

beforeEach(async () => {
  qrCodeRepo = makeRepo();
  certRepo = makeRepo();
  cacheManager = makeCacheManager();
  // ...
```

In the providers array, replace:

```ts
{ provide: CACHE_MANAGER, useFactory: mockCache },
```

With:

```ts
{ provide: CACHE_MANAGER, useValue: cacheManager },
```

**Step 2:** Add cache behavior describe block after the existing `verifyQrCode()` describe:

```ts
describe('cache behavior', () => {
  const sig = 'test-sig';
  const cacheKey = `qr:verify:${sig}`;
  const activeQr = {
    id: 'qr-uuid',
    certificationId: 'cert-uuid',
    hmacSignature: sig,
    isActive: true,
    scansCount: 0,
    expiresAt: null,
  };

  it('returns cached result without hitting DB on cache hit', async () => {
    const cachedResult = { valid: true, message: 'cached', certification: null, qrCode: null };
    cacheManager.get.mockResolvedValue(cachedResult);

    const result = await service.verifyQrCode(sig);

    expect(result).toEqual(cachedResult);
    expect(qrCodeRepo.findOne).not.toHaveBeenCalled();
  });

  it('caches GRANTED result for 300 seconds', async () => {
    cacheManager.get.mockResolvedValue(null);
    qrCodeRepo.findOne.mockResolvedValue(activeQr);
    qrCodeRepo.increment.mockResolvedValue(undefined);
    certRepo.findOne.mockResolvedValue({
      id: 'cert-uuid',
      currentStatus: CertificationStatus.GRANTED,
    });

    await service.verifyQrCode(sig);

    expect(cacheManager.set).toHaveBeenCalledWith(
      cacheKey,
      expect.objectContaining({ valid: true }),
      300_000,
    );
  });

  it('does NOT cache REVOKED result', async () => {
    cacheManager.get.mockResolvedValue(null);
    qrCodeRepo.findOne.mockResolvedValue(activeQr);
    certRepo.findOne.mockResolvedValue({
      id: 'cert-uuid',
      currentStatus: CertificationStatus.REVOKED,
    });

    await service.verifyQrCode(sig);

    expect(cacheManager.set).not.toHaveBeenCalled();
  });

  it('evicts cache in deactivateByCertificationId before deactivating', async () => {
    qrCodeRepo.findOne.mockResolvedValue(activeQr);

    await service.deactivateByCertificationId('cert-uuid');

    expect(cacheManager.del).toHaveBeenCalledWith(cacheKey);
    expect(qrCodeRepo.update).toHaveBeenCalledWith(
      { certificationId: 'cert-uuid', isActive: true },
      { isActive: false },
    );
    // del must be called BEFORE update
    const delOrder = cacheManager.del.mock.invocationCallOrder[0];
    const updateOrder = qrCodeRepo.update.mock.invocationCallOrder[0];
    expect(delOrder).toBeLessThan(updateOrder);
  });

  it('evictQrCache calls del with correct key', async () => {
    qrCodeRepo.findOne.mockResolvedValue(activeQr);

    await service.evictQrCache('cert-uuid');

    expect(cacheManager.del).toHaveBeenCalledWith(cacheKey);
  });

  it('evictQrCache is a no-op when no active QR exists', async () => {
    qrCodeRepo.findOne.mockResolvedValue(null);

    await service.evictQrCache('cert-uuid');

    expect(cacheManager.del).not.toHaveBeenCalled();
  });
});
```

**Verification:** `npm run test:unit -- --testPathPattern=qr-code.service`

---

### Task 14 — Run migration drift check

**Commands (run in sequence):**

```bash
# Ensure dev DB is running first (docker compose up -d postgres)
npm run migration:run
npm run migration:show
npm run migration:generate -- src/database/migrations/DriftCheck --check
```

**Expected outcome:** `migration:generate --check` outputs "No changes in database schema were found" and exits 0.

**If drift is found:** STOP. Review the generated SQL. If it adds a column or index that the entities define, create a new migration:

```bash
npm run migration:generate -- src/database/migrations/1700000000007-CorrectDrift
```

Review the file, commit it, then re-run `--check`.

**If no drift:** No code change needed. Record result in progress.md.

**Verification:** Command exits 0 with "No changes found".

---

### Task 15 — Run final coverage check

**Command:**

```bash
npm run test:cov
```

**Expected outcome:** All files ≥80% branches/functions/lines/statements. Build exits 0.

**If any file is still below 80%:** Check the coverage report for which specific branches/lines are uncovered. Add the minimum targeted tests to reach 80%. Repeat until `test:cov` exits 0.

**Verification:** `npm run test:cov` exits 0.

---

**Batch 5 checkpoint:**

```bash
npm run lint && npm run typecheck && npm run test:cov
```

---

## Testing Tasks (Summary)

| Test File                                                     | New / Modified | What it covers                                                                                  |
| ------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------- |
| `test/unit/certification/certification.listener.spec.ts`      | **New**        | All 4 event handlers, idempotency, error swallowing                                             |
| `test/unit/certification/inspection.service.spec.ts`          | **New**        | scheduleInspection, completeInspection, findById, findByCertification, fileReport               |
| `test/unit/certification/qr-code.service.spec.ts`             | Modified       | Cache hit, cache miss+write (GRANTED), no-cache (REVOKED), eviction on deactivate, evictQrCache |
| `test/unit/certification/certification.service.spec.ts`       | Modified       | Fix producer mock + add evictQrCache to QrCodeService mock                                      |
| `test/unit/certification/certification-state-machine.spec.ts` | Modified       | Add evictQrCache to QrCodeService mock                                                          |
| Existing specs (notification, export-doc, etc.)               | Augmented      | Gap closure to ≥80% per Task 5                                                                  |

---

## Definition of Done Checklist

- [ ] `npm run test:cov` exits 0, all files ≥80%
- [ ] `certification.listener.spec.ts` passes (8 tests)
- [ ] `inspection.service.spec.ts` passes (7 tests)
- [ ] `qr-code.service.spec.ts` cache tests pass (6 new tests)
- [ ] Second `verifyQrCode` call returns from cache (verified via cache hit test)
- [ ] REVOKED certs never cached (verified via unit test)
- [ ] `deactivateByCertificationId` evicts cache before deactivating (verified via test)
- [ ] `renewCertification` calls `evictQrCache` (verified via state machine test)
- [ ] `npm run migration:generate -- --check` exits 0 (no drift)
- [ ] CLAUDE.md updated with local barrel + JSONB + useValue patterns
- [ ] Zero TypeScript errors (`npm run typecheck`)
- [ ] Zero lint errors (`npm run lint`)
