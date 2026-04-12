# Sprint 4 Design — Production Readiness

**Date:** 2026-04-10
**Sprint:** 4
**Goal:** Fix the foundation before adding features — coverage baseline, Redis QR cache, and TypeORM migrations.

---

## Scope Decision (Q&A Summary)

| Question            | Choice                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| Scope               | All three pillars: coverage baseline + Redis QR cache + TypeORM migrations                        |
| Cache strategy      | Full `QrVerificationResult` keyed by `token`, TTL 5 min for GRANTED/RENEWED, no cache for REVOKED |
| Cache invalidation  | Inside `QrCodeService` directly — no Kafka needed, same-process call                              |
| Migration strategy  | Schema diff only (`--check`); disable `synchronize` in app config if clean                        |
| Coverage gap policy | Run it, write tests to reach ≥80%. DoD requires ≥80% at sprint end.                               |

---

## Story Point Estimate

| Pillar             | SP     |
| ------------------ | ------ |
| Coverage baseline  | 10     |
| Redis QR cache     | 8      |
| TypeORM migrations | 3      |
| **Total**          | **21** |

Buffer: 4–9 SP within 25–30 SP capacity (for coverage surprises or migration drift).

---

## Pillar 1 — Coverage Baseline

**DoD:** `npm run test:cov` exits 0 with ≥80% branches/functions/lines/statements on all files.

### Gap Analysis Plan

Run `npm run test:cov` first to get per-file numbers. Based on what was scaffolded vs tested, highest-risk gaps are:

| File                                  | Status                       | Risk                                          |
| ------------------------------------- | ---------------------------- | --------------------------------------------- |
| `certification-state-machine.spec.ts` | Comprehensive                | Low                                           |
| `qr-code.service.spec.ts`             | Rewritten Sprint 3 (5 cases) | Low                                           |
| `certification.service.spec.ts`       | Partial                      | Medium                                        |
| `cooperative.service.spec.ts`         | Partial                      | Medium                                        |
| `notification.service.spec.ts`        | Exists                       | Medium — EmailService/SmsService mocks needed |
| `export-document.service.spec.ts`     | Exists                       | Low — 5 thin methods                          |
| `product.service.spec.ts`             | Exists                       | Medium                                        |
| `lab-test.service.spec.ts`            | Exists                       | Medium                                        |
| `certification.listener.spec.ts`      | **Missing**                  | High — 4 handlers, 0 tests                    |
| `inspection.service.spec.ts`          | **Missing**                  | High                                          |
| Common utility specs                  | Complete                     | Low                                           |

### New Spec Files to Write

**`test/unit/certification/certification.listener.spec.ts`**

- Mock `CertificationService` with all methods
- Test `handleLabTestCompleted`: happy path (calls `receiveLabResults`), idempotency skip (`isEventProcessed` returns true), error swallowed
- Test `handleCooperativeVerified`: logs and returns without error
- Test `handleFinalReviewStarted`: logs and returns
- Test `handleCertificationRenewed`: logs and returns

**`test/unit/certification/inspection.service.spec.ts`**

- Mock `InspectionRepo`, `CertificationRepo`, `InspectionReportRepo`
- Test `scheduleInspection`, `submitReport`, `findById` (happy + not-found paths)

### Augment Existing Specs

After running `test:cov`, augment whichever files are below 80% (exact list TBD from coverage report).

---

## Pillar 2 — Redis QR Cache

**DoD:** Second `verifyQrCode` call for the same token hits Redis, not Postgres. Cache evicts immediately on revoke and renew.

### Dependencies

Already installed — no new packages needed:

- `@nestjs/cache-manager@^2.3.0`
- `cache-manager@^5.4.0`
- `cache-manager-redis-yet@^5.1.3`

### `certification.module.ts` — Switch to Redis store

```ts
import { redisStore } from 'cache-manager-redis-yet';

CacheModule.registerAsync({
  imports: [ConfigModule],
  useFactory: (config: ConfigService) => ({
    store: redisStore,
    url: config.get<string>('redis.url'),
    ttl: 0, // TTL set per-call via cacheManager.set(key, value, ttlMs)
  }),
  inject: [ConfigService],
  isGlobal: false,
}),
```

### `qr-code.service.ts` — Inject CACHE_MANAGER

```ts
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';

constructor(
  @InjectRepository(QrCode) private readonly qrCodeRepo: Repository<QrCode>,
  @InjectRepository(Certification) private readonly certificationRepo: Repository<Certification>,
  private readonly configService: ConfigService,
  private readonly producer: CertificationProducer,
  @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
) { ... }
```

### `verifyQrCode()` — Cache read at top, cache write before return

Cache key: `qr:verify:{hmacSignature}`

**Read (insert at start of method):**

```ts
const cacheKey = `qr:verify:${hmacSignature}`;
const cached = await this.cacheManager.get<QrVerificationResult>(cacheKey);
if (cached) {
  this.logger.debug({ hmacSignature }, 'QR verify cache hit');
  return cached;
}
```

**Write (before returning GRANTED or RENEWED result only):**

```ts
// Cache GRANTED and RENEWED results (valid: false but safe to cache)
// REVOKED, not-found, expired are never cached — must reflect DB truth immediately
if (result.valid || result.certification?.currentStatus === CertificationStatus.RENEWED) {
  await this.cacheManager.set(cacheKey, result, 300_000); // 300 seconds in ms
}
return result;
```

### `deactivateByCertificationId()` — Evict before deactivating

```ts
async deactivateByCertificationId(certificationId: string): Promise<void> {
  const qr = await this.qrCodeRepo.findOne({ where: { certificationId, isActive: true } });
  if (qr) {
    await this.cacheManager.del(`qr:verify:${qr.hmacSignature}`);
  }
  await this.qrCodeRepo.update({ certificationId, isActive: true }, { isActive: false });
  this.logger.log({ certificationId }, 'QR codes deactivated for revoked certification');
}
```

### New method `evictQrCache()` — Called from renewCertification

```ts
/**
 * Evict cached QR verification result for a certification.
 * Called when certification transitions to RENEWED so the old token
 * immediately stops returning valid: true.
 */
async evictQrCache(certificationId: string): Promise<void> {
  const qr = await this.qrCodeRepo.findOne({ where: { certificationId, isActive: true } });
  if (qr) {
    await this.cacheManager.del(`qr:verify:${qr.hmacSignature}`);
    this.logger.debug({ certificationId }, 'QR cache evicted on renewal');
  }
}
```

### `certification.service.ts` — Call evictQrCache in renewCertification

In `renewCertification()`, after `applyTransition` for the old cert:

```ts
await this.qrCodeService.evictQrCache(cert.id);
```

### TTL Policy Summary

| Status               | Cache? | TTL  |
| -------------------- | ------ | ---- |
| GRANTED              | Yes    | 300s |
| RENEWED              | Yes    | 300s |
| REVOKED              | No     | —    |
| Not found / inactive | No     | —    |
| Expired              | No     | —    |

### Unit Tests for Cache Behavior

Add to `qr-code.service.spec.ts`:

- `verifyQrCode` cache hit: first call populates cache, second call returns cached result without DB call
- `verifyQrCode` REVOKED: result not cached, DB always called
- `deactivateByCertificationId`: calls `cacheManager.del` with correct key before deactivating
- `evictQrCache`: calls `cacheManager.del` with correct key; no-op when no active QR found

---

## Pillar 3 — TypeORM Migrations

**DoD:** `synchronize: false` in app datasource. `migration:generate --check` exits 0.

### Migration Chain Status

| Migration | Content                                                                 | Status              |
| --------- | ----------------------------------------------------------------------- | ------------------- |
| 001       | Create cooperative schema                                               | ✅                  |
| 002       | Create product schema                                                   | ✅                  |
| 003       | Create certification schema (`status` column)                           | ✅ — renamed by 005 |
| 004       | Create notification schema                                              | ✅                  |
| 005       | Rename `status` → `current_status`, create `certification_events` table | ✅ Confirmed        |
| 006       | Comment-only (no DDL — `RENEWED` fits in `VARCHAR(30)`)                 | ✅                  |

### Verification Steps

```bash
# Step 1: Run all migrations against dev DB
npm run migration:run

# Step 2: Check for drift — must exit 0
npm run migration:generate -- DriftCheck --check

# Step 3: If drift found, review generated SQL, add corrective migration task
# Step 4: If clean, proceed to disable synchronize
```

### `src/database/data-source.ts` — Disable synchronize

```ts
synchronize: false,  // was: true — NEVER true in production
migrationsRun: true, // auto-run on app boot
```

### Test datasource — Keep synchronize: true

Find the test-specific TypeORM config (used by Testcontainers integration tests) and leave `synchronize: true` — fresh container per test, migration overhead not needed.

---

## Action Items from Sprint 3 Retro (carried into Sprint 4)

| Item                                                            | Plan Task                        |
| --------------------------------------------------------------- | -------------------------------- |
| Run `npm run test:cov` and record baseline                      | Task 1                           |
| Document local barrel pattern in CLAUDE.md                      | Add to plan                      |
| Audit all unit tests for `useFactory` vs `useValue` consistency | Fold into coverage baseline task |
| Document `em.create()` + `em.save()` JSONB pattern in CLAUDE.md | Add to plan                      |

---

## Definition of Done

- [ ] `npm run test:cov` exits 0, all files ≥80%
- [ ] Second `verifyQrCode` call returns from Redis (log shows "cache hit")
- [ ] `revokeCertification` immediately evicts QR cache
- [ ] `renewCertification` immediately evicts old cert's QR cache
- [ ] `synchronize: false` in `data-source.ts`
- [ ] `npm run migration:generate -- --check` exits 0 (no drift)
- [ ] Zero TypeScript errors
- [ ] Zero lint errors
- [ ] CLAUDE.md updated: local barrel pattern + JSONB pattern documented
