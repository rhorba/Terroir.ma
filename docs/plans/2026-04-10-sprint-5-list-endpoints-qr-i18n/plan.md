# Sprint 5 — List Endpoints, QR Download & Trilingual Verification

> **For Claude:** Use /execute to implement this plan task-by-task.

**Goal:** Add role-scoped list endpoints for cert-body/inspector/cooperative-admin, PNG+SVG QR download, and `?lang=` trilingual verification — all within the existing certification module, no new entities or Kafka events.

**Architecture:** Single NestJS module (certification). All new endpoints are read-only GET queries or binary response streams. No new Kafka events. No new entities. No DB migrations.

**Tech Stack:** NestJS, TypeScript, PostgreSQL, Redis (QR cache), Keycloak JWT (cooperative_id claim)

**Modules Affected:** certification (primary), notification (TM-2 test fix)

**Estimated Story Points:** 23

---

## Batch 1: Foundation — Pagination DTO, i18n Constants, Pending/Paginated Service Methods

### Task 1 — Create `src/common/dto/pagination-query.dto.ts`

**File to create:** `src/common/dto/pagination-query.dto.ts`

```ts
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: { page: number; limit: number; total: number };
}
```

**Verification:** `npm run typecheck` — no errors on new file.

---

### Task 2 — Create `src/common/constants/i18n-verification.constants.ts`

**File to create:** `src/common/constants/i18n-verification.constants.ts`

```ts
export const VERIFICATION_I18N = {
  status: {
    GRANTED: { fr: 'Certifié', ar: 'معتمد', zgh: 'ⴰⵙⵉⴼⵍⵍ' },
    RENEWED: { fr: 'Renouvelé', ar: 'مجدد', zgh: 'ⴰⵙⵏⴼⵍⵉ' },
    REVOKED: { fr: 'Révoqué', ar: 'ملغى', zgh: 'ⴰⴽⴽⴰ' },
    DENIED: { fr: 'Refusé', ar: 'مرفوض', zgh: 'ⵓⵔ ⵉⵇⴱⵍ' },
    EXPIRED: { fr: 'Expiré', ar: 'منتهي الصلاحية', zgh: 'ⵉⵎⵎⵓⵜ' },
  },
  message: {
    valid: { fr: 'Produit certifié', ar: 'منتج معتمد', zgh: 'ⴰⵎⵣⵣⴰⵏ ⴰⵙⵉⴼⵍⵍ' },
    invalid: { fr: 'Certification invalide', ar: 'شهادة غير صالحة', zgh: 'ⴰⵙⵉⴼⵍⵍ ⵓⵔ ⵉⵍⵍⵉ' },
    revoked: { fr: 'Produit révoqué', ar: 'منتج ملغى', zgh: 'ⴰⵎⵣⵣⴰⵏ ⴰⴽⴽⴰ' },
    expired: { fr: 'Certificat expiré', ar: 'شهادة منتهية', zgh: 'ⴰⵙⵉⴼⵍⵍ ⵉⵎⵎⵓⵜ' },
    renewed: { fr: 'Certificat renouvelé', ar: 'شهادة مجددة', zgh: 'ⴰⵙⵉⴼⵍⵍ ⴰⵙⵏⴼⵍⵉ' },
  },
} as const;

export type SupportedLang = 'ar' | 'fr' | 'zgh';
export const DEFAULT_LANG: SupportedLang = 'fr';
export const RTL_LANGS: SupportedLang[] = ['ar'];

/** Returns true if the given string is a supported language code. */
export function isSupportedLang(lang: string): lang is SupportedLang {
  return ['ar', 'fr', 'zgh'].includes(lang);
}
```

**Verification:** `npm run typecheck` — no errors.

---

### Task 3 — Add `findPending()` and `findByCooperativePaginated()` to `certification.service.ts`

**File to modify:** `src/modules/certification/services/certification.service.ts`

Add import at top (after existing imports):

```ts
import { In } from 'typeorm';
import { PaginatedResult } from '../../../common/dto/pagination-query.dto';
```

Add two new methods after the existing `findByCooperative()` method (after line ~87):

```ts
/**
 * Returns certifications with actionable statuses for certification-body officers.
 * "Pending" = any status where the cert body has an outstanding action.
 */
async findPending(page: number, limit: number): Promise<PaginatedResult<Certification>> {
  const pendingStatuses = [
    CertificationStatus.SUBMITTED,
    CertificationStatus.DOCUMENT_REVIEW,
    CertificationStatus.LAB_RESULTS_RECEIVED,
    CertificationStatus.UNDER_REVIEW,
  ];
  const [data, total] = await this.certRepo.findAndCount({
    where: { currentStatus: In(pendingStatuses) },
    order: { createdAt: 'DESC' },
    skip: (page - 1) * limit,
    take: limit,
  });
  return { data, meta: { page, limit, total } };
}

/**
 * Returns all certifications for a cooperative with pagination.
 * Used by cooperative-admin to view their full certification portfolio.
 */
async findByCooperativePaginated(
  cooperativeId: string,
  page: number,
  limit: number,
): Promise<PaginatedResult<Certification>> {
  const [data, total] = await this.certRepo.findAndCount({
    where: { cooperativeId },
    order: { createdAt: 'DESC' },
    skip: (page - 1) * limit,
    take: limit,
  });
  return { data, meta: { page, limit, total } };
}
```

**Verification:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 2: Certification List Controllers + Inspector My Endpoint

### Task 4 — Add `GET /certifications/pending` and `GET /certifications/my` to `certification.controller.ts`

**File to modify:** `src/modules/certification/controllers/certification.controller.ts`

Add import at top:

```ts
import { Query } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';
import { PaginationQueryDto, PaginatedResult } from '../../../common/dto/pagination-query.dto';
```

Add two methods before `requestCertification` (before `@Post('request')`):

```ts
/**
 * US-042 — Certification body officer views all pending certification requests.
 * Returns certifications with status: SUBMITTED, DOCUMENT_REVIEW, LAB_RESULTS_RECEIVED, UNDER_REVIEW.
 */
@Get('pending')
@UseGuards(RolesGuard)
@Roles('certification-body', 'super-admin')
@ApiOperation({ summary: 'US-042: List pending certification requests (cert-body view)' })
@ApiQuery({ name: 'page', required: false, type: Number })
@ApiQuery({ name: 'limit', required: false, type: Number })
async findPending(
  @Query() query: PaginationQueryDto,
): Promise<PaginatedResult<Certification>> {
  return this.certificationService.findPending(query.page, query.limit);
}

/**
 * US-049 — Cooperative admin views all certifications for their cooperative.
 * Scoped to the cooperative from the JWT claim.
 */
@Get('my')
@UseGuards(RolesGuard)
@Roles('cooperative-admin')
@ApiOperation({ summary: 'US-049: List certifications for the calling cooperative' })
@ApiQuery({ name: 'page', required: false, type: Number })
@ApiQuery({ name: 'limit', required: false, type: Number })
async findMyCertifications(
  @CurrentUser() user: CurrentUserPayload,
  @Query() query: PaginationQueryDto,
): Promise<PaginatedResult<Certification>> {
  const cooperativeId = user.cooperative_id ?? user.sub;
  return this.certificationService.findByCooperativePaginated(cooperativeId, query.page, query.limit);
}
```

> Note: `user.cooperative_id` uses snake_case — this is the Keycloak JWT claim name already in `CurrentUserPayload`. Falls back to `user.sub` if the claim is absent (useful in development/testing).

**Verification:** `npm run typecheck` — verify no import errors on `PaginationQueryDto`.

---

### Task 5 — Add `findByInspectorId()` to `inspection.service.ts`

**File to modify:** `src/modules/certification/services/inspection.service.ts`

Add import at top:

```ts
import { PaginatedResult } from '../../../common/dto/pagination-query.dto';
```

Add new method after `findByCertification()` (after line ~137):

```ts
/**
 * Returns paginated inspections assigned to a specific inspector.
 * Used by the inspector /my endpoint to show their scheduled workload.
 */
async findByInspectorId(
  inspectorId: string,
  page: number,
  limit: number,
): Promise<PaginatedResult<Inspection>> {
  const [data, total] = await this.inspectionRepo.findAndCount({
    where: { inspectorId },
    order: { createdAt: 'DESC' },
    skip: (page - 1) * limit,
    take: limit,
  });
  return { data, meta: { page, limit, total } };
}
```

**Verification:** `npm run typecheck` — no errors.

---

### Task 6 — Add `GET /inspections/my` to `inspection.controller.ts`

**File to modify:** `src/modules/certification/controllers/inspection.controller.ts`

Add imports at top:

```ts
import { Query } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';
import { PaginationQueryDto, PaginatedResult } from '../../../common/dto/pagination-query.dto';
```

Add method before `scheduleInspection` (before `@Post()`):

```ts
/**
 * US-043 — Inspector views their scheduled inspections.
 * Scoped to the inspector's Keycloak sub (user ID).
 */
@Get('my')
@UseGuards(RolesGuard)
@Roles('inspector')
@ApiOperation({ summary: 'US-043: List inspections assigned to the calling inspector' })
@ApiQuery({ name: 'page', required: false, type: Number })
@ApiQuery({ name: 'limit', required: false, type: Number })
async findMyInspections(
  @CurrentUser() user: CurrentUserPayload,
  @Query() query: PaginationQueryDto,
): Promise<PaginatedResult<Inspection>> {
  return this.inspectionService.findByInspectorId(user.sub, query.page, query.limit);
}
```

**Verification:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 3: Export Doc List + QR Download Service

### Task 7 — Add `findByCooperativePaginated()` to `export-document.service.ts` and `GET /export-documents/my` to controller

**File to modify:** `src/modules/certification/services/export-document.service.ts`

Add import at top:

```ts
import { PaginatedResult } from '../../../common/dto/pagination-query.dto';
```

Add method after `findByCooperative()` (after line ~78):

```ts
/**
 * Returns paginated export documents for a cooperative.
 * Used by cooperative-admin to view their export logistics.
 */
async findByCooperativePaginated(
  cooperativeId: string,
  page: number,
  limit: number,
): Promise<PaginatedResult<ExportDocument>> {
  const [data, total] = await this.exportDocRepo.findAndCount({
    where: { cooperativeId },
    order: { createdAt: 'DESC' },
    skip: (page - 1) * limit,
    take: limit,
  });
  return { data, meta: { page, limit, total } };
}
```

**File to modify:** `src/modules/certification/controllers/export-document.controller.ts`

Add imports at top:

```ts
import { Query } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';
import { PaginationQueryDto, PaginatedResult } from '../../../common/dto/pagination-query.dto';
```

Add method before `generateExportDoc` (before `@Post()`):

```ts
/**
 * US-066 — Cooperative admin views all export documentation requests for their cooperative.
 */
@Get('my')
@UseGuards(RolesGuard)
@Roles('cooperative-admin')
@ApiOperation({ summary: 'US-066: List export documents for the calling cooperative' })
@ApiQuery({ name: 'page', required: false, type: Number })
@ApiQuery({ name: 'limit', required: false, type: Number })
async findMyExportDocuments(
  @CurrentUser() user: CurrentUserPayload,
  @Query() query: PaginationQueryDto,
): Promise<PaginatedResult<ExportDocument>> {
  const cooperativeId = user.cooperative_id ?? user.sub;
  return this.exportDocumentService.findByCooperativePaginated(cooperativeId, query.page, query.limit);
}
```

**Verification:** `npm run typecheck` — no errors.

---

### Task 8 — Add `downloadQrCode()` to `qr-code.service.ts`

**File to modify:** `src/modules/certification/services/qr-code.service.ts`

Add import at top (after existing imports):

```ts
import * as QRCode from 'qrcode';
```

> Note: The existing service already imports `* as crypto`. Add `qrcode` import alongside it. The `qrcode` package is already in `package.json` — no new dependency needed.

Add interface before the `@Injectable()` class:

```ts
export interface QrDownloadResult {
  buffer: Buffer;
  mimeType: string;
  filename: string;
}
```

Add method after `evictQrCache()` (at the end of the class, before the closing `}`):

```ts
/**
 * Generate a QR code image for download by cooperative admins.
 * Returns a PNG buffer or SVG buffer for the active QR code of a certification.
 * Certification must be GRANTED or RENEWED.
 */
async downloadQrCode(
  certificationId: string,
  format: 'png' | 'svg',
): Promise<QrDownloadResult> {
  const certification = await this.certificationRepo.findOne({
    where: { id: certificationId },
  });
  if (
    !certification ||
    (certification.currentStatus !== CertificationStatus.GRANTED &&
      certification.currentStatus !== CertificationStatus.RENEWED)
  ) {
    throw new NotFoundException({
      code: 'CERTIFICATION_NOT_FOUND_OR_NOT_GRANTED',
      message: `Certification ${certificationId} not found or not in GRANTED/RENEWED status`,
    });
  }

  const qrCode = await this.qrCodeRepo.findOne({
    where: { certificationId, isActive: true },
  });
  if (!qrCode) {
    throw new NotFoundException({
      code: 'QR_CODE_NOT_FOUND',
      message: `No active QR code found for certification ${certificationId}`,
    });
  }

  const filename = `${certification.certificationNumber ?? certificationId}.${format}`;

  if (format === 'svg') {
    const svgString = await QRCode.toString(qrCode.verificationUrl, { type: 'svg' });
    return {
      buffer: Buffer.from(svgString),
      mimeType: 'image/svg+xml',
      filename,
    };
  }

  const buffer = await QRCode.toBuffer(qrCode.verificationUrl);
  return {
    buffer,
    mimeType: 'image/png',
    filename,
  };
}
```

**Verification:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 4: QR Download Controller + Trilingual Verification

### Task 9 — Add `GET /qr-codes/:certificationId/download` to `qr-code.controller.ts`

**File to modify:** `src/modules/certification/controllers/qr-code.controller.ts`

Add imports at top:

```ts
import { Res, StreamableFile } from '@nestjs/common';
import { Response } from 'express';
import { ApiQuery } from '@nestjs/swagger';
```

Add method after `generateQrCode` (after the POST endpoint):

```ts
/**
 * US-057 — Download QR code image for packaging.
 * Returns PNG (default) or SVG binary stream.
 * Certification must be GRANTED or RENEWED.
 */
@Get('qr-codes/:certificationId/download')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('cooperative-admin', 'certification-body', 'super-admin')
@ApiOperation({ summary: 'US-057: Download QR code as PNG or SVG for packaging' })
@ApiParam({ name: 'certificationId', description: 'Certification UUID' })
@ApiQuery({ name: 'format', required: false, enum: ['png', 'svg'], description: 'Image format (default: png)' })
async downloadQrCode(
  @Param('certificationId') certificationId: string,
  @Query('format') format: string = 'png',
  @Res({ passthrough: true }) res: Response,
): Promise<StreamableFile> {
  const safeFormat = format === 'svg' ? 'svg' : 'png';
  const result = await this.qrCodeService.downloadQrCode(certificationId, safeFormat);
  res.set({
    'Content-Type': result.mimeType,
    'Content-Disposition': `attachment; filename="${result.filename}"`,
  });
  return new StreamableFile(result.buffer);
}
```

**Verification:** `npm run typecheck` — verify `StreamableFile` and `Response` types resolve cleanly.

---

### Task 10 — Update `verifyQrCode()` in `qr-code.service.ts` for i18n

**File to modify:** `src/modules/certification/services/qr-code.service.ts`

Add imports at top:

```ts
import {
  VERIFICATION_I18N,
  SupportedLang,
  DEFAULT_LANG,
  RTL_LANGS,
  isSupportedLang,
} from '../../../common/constants/i18n-verification.constants';
```

Extend the `QrVerificationResult` interface (defined at the top of the file, line ~13):

```ts
export interface QrVerificationResult {
  valid: boolean;
  certification: Certification | null;
  qrCode: QrCode | null;
  message: string;
  newCertificationNumber?: string | null;
  // i18n fields (populated when lang is provided)
  statusDisplay?: string;
  lang?: SupportedLang;
  rtl?: boolean;
}
```

Update the `verifyQrCode()` method signature (line ~114):

```ts
async verifyQrCode(hmacSignature: string, lang?: string, scannedFromIp?: string): Promise<QrVerificationResult>
```

Add a private helper at the end of the class (before closing `}`):

```ts
/**
 * Applies i18n translation to a QrVerificationResult.
 * Adds statusDisplay, message (translated), lang, and rtl fields.
 */
private applyI18n(
  result: QrVerificationResult,
  lang: SupportedLang,
): QrVerificationResult {
  const resolvedLang = isSupportedLang(lang) ? lang : DEFAULT_LANG;
  const statusKey = result.certification?.currentStatus as keyof typeof VERIFICATION_I18N.status | undefined;
  const statusDisplay = statusKey && VERIFICATION_I18N.status[statusKey]
    ? VERIFICATION_I18N.status[statusKey][resolvedLang]
    : undefined;

  let messageKey: keyof typeof VERIFICATION_I18N.message = 'invalid';
  if (result.valid) messageKey = 'valid';
  else if (result.certification?.currentStatus === 'REVOKED') messageKey = 'revoked';
  else if (result.certification?.currentStatus === 'RENEWED') messageKey = 'renewed';
  else if (result.qrCode?.expiresAt && new Date() > result.qrCode.expiresAt) messageKey = 'expired';

  return {
    ...result,
    message: VERIFICATION_I18N.message[messageKey][resolvedLang],
    statusDisplay,
    lang: resolvedLang,
    rtl: RTL_LANGS.includes(resolvedLang),
  };
}
```

Update the `verifyQrCode()` method body to call `applyI18n` before each `return` statement. The lang is resolved at the top of the method:

```ts
// Add at the start of verifyQrCode(), after the cache hit check:
const resolvedLang: SupportedLang = isSupportedLang(lang ?? '')
  ? (lang as SupportedLang)
  : DEFAULT_LANG;
```

Each `return { valid: false, ... }` statement becomes:

```ts
return this.applyI18n({ valid: false, ..., }, resolvedLang);
```

And the two `await this.cacheManager.set(cacheKey, ...)` calls: **cache the raw result** (before i18n), then apply i18n to the returned value. This way the cache is language-neutral:

```ts
// Instead of: return renewedResult;
await this.cacheManager.set(cacheKey, renewedResult, 300_000);
return this.applyI18n(renewedResult, resolvedLang);

// Instead of: return grantedResult;
await this.cacheManager.set(cacheKey, grantedResult, 300_000);
return this.applyI18n(grantedResult, resolvedLang);

// For cache hit:
if (cached) {
  return this.applyI18n(cached, resolvedLang);
}
```

> IMPORTANT: Cache stores the raw result (no i18n). i18n is applied after cache retrieval. This keeps the cache language-neutral and ensures TTL/eviction logic is unchanged.

**Verification:** `npm run typecheck` — verify all return paths compile.

---

### Task 11 — Update `GET /verify/:uuid` in `qr-code.controller.ts` to accept `?lang=`

**File to modify:** `src/modules/certification/controllers/qr-code.controller.ts`

Add `@ApiQuery` import if not already present (already added in Task 9).

Update `verifyQrCode` controller method:

```ts
@Get('verify/:uuid')
@ApiOperation({ summary: 'Verify QR code and return certification chain (public)' })
@ApiParam({ name: 'uuid', description: 'QR code HMAC signature or UUID from scanned QR' })
@ApiQuery({ name: 'sig', required: false, description: 'HMAC signature for verification' })
@ApiQuery({ name: 'lang', required: false, enum: ['ar', 'fr', 'zgh'], description: 'Response language (default: fr)' })
async verifyQrCode(
  @Param('uuid') uuid: string,
  @Query('sig') sig?: string,
  @Query('lang') lang?: string,
): Promise<QrVerificationResult> {
  const lookupKey = sig ?? uuid;
  const result = await this.qrCodeService.verifyQrCode(lookupKey, lang);

  if (!result.valid) {
    if (sig !== undefined) {
      throw new ForbiddenException({ code: 'QR_INVALID_SIGNATURE', message: result.message });
    }
    throw new NotFoundException({ code: 'QR_NOT_FOUND', message: result.message });
  }

  return result;
}
```

**Verification:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 5: Technical Maintenance

### Task 12 — Add `test:unit:cov` script to `package.json`

**File to modify:** `package.json`

Locate the `"scripts"` section. Add after the existing `test` scripts:

```json
"test:unit:cov": "jest --testPathPattern=spec --coverage --coverageReporters=text --coverageReporters=lcov"
```

**Verification:** `npm run test:unit:cov` runs and produces coverage output (no threshold errors).

---

### Task 13 — Add error path test to `notification.service.spec.ts`

**File to modify:** `test/unit/notification.service.spec.ts`

Locate the existing describe block for `send()` (or add one). Add the following test:

```ts
it('marks notification as FAILED when email send throws', async () => {
  // Arrange — notification exists, email adapter rejects
  const notificationId = 'notif-uuid-001';
  mockNotificationRepo.findOne.mockResolvedValue({
    id: notificationId,
    channel: 'email',
    status: 'pending',
    recipientEmail: 'test@example.com',
    subject: 'Test',
    body: 'Hello',
  });
  mockEmailService.send.mockRejectedValue(new Error('SMTP timeout'));

  // Act
  await service.send(notificationId);

  // Assert — lines 92-93: update to FAILED on error
  expect(mockNotificationRepo.update).toHaveBeenCalledWith(
    notificationId,
    expect.objectContaining({ status: 'FAILED' }),
  );
});
```

> Adjust mock names to match the actual mock objects in the spec file. The intent is to cover the `catch` branch that calls `repo.update(..., { status: 'FAILED' })`.

**Verification:** `npm run test:unit` — notification module branch coverage rises from 62.06%.

---

### Task 14 — Document migration chain verification (TM-3)

This is a verification-only task. No code changes.

**Steps to run when PostgreSQL is available:**

```bash
# Start only the core DB profile
docker compose --profile core up -d postgres

# Run all pending migrations
npm run migration:run

# Verify no pending migrations remain (must output: "No changes in database schema were found")
npm run migration:generate -- --check

# Tear down
docker compose --profile core down
```

**Expected outcome:** Zero pending migrations. If the generate --check command produces a new migration file, investigate the drift and create a corrective migration.

**Record result in:** `docs/plans/2026-04-10-sprint-5-list-endpoints-qr-i18n/progress.md`

**Verification:** `npm run lint && npm run typecheck && npm run test:unit` (no code change — lint/check pass if prior tasks are clean)

---

## Testing Tasks

### Task 15 — Unit tests for `findPending()` and `findByCooperativePaginated()` in `certification.service.spec.ts`

**File to modify:** `test/unit/certification.service.spec.ts`

Add tests:

```ts
describe('findPending', () => {
  it('returns paginated certifications with actionable statuses', async () => {
    const mockData = [{ id: 'cert-1', currentStatus: 'SUBMITTED' }];
    mockCertRepo.findAndCount.mockResolvedValue([mockData, 1]);

    const result = await service.findPending(1, 20);

    expect(mockCertRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { currentStatus: expect.anything() }, // In([...])
        skip: 0,
        take: 20,
      }),
    );
    expect(result.data).toEqual(mockData);
    expect(result.meta).toEqual({ page: 1, limit: 20, total: 1 });
  });
});

describe('findByCooperativePaginated', () => {
  it('returns paginated certifications for a cooperative', async () => {
    const mockData = [{ id: 'cert-2', cooperativeId: 'coop-1' }];
    mockCertRepo.findAndCount.mockResolvedValue([mockData, 5]);

    const result = await service.findByCooperativePaginated('coop-1', 2, 10);

    expect(mockCertRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cooperativeId: 'coop-1' },
        skip: 10,
        take: 10,
      }),
    );
    expect(result.meta).toEqual({ page: 2, limit: 10, total: 5 });
  });
});
```

---

### Task 16 — Unit tests for `findByInspectorId()` in `inspection.service.spec.ts`

**File to modify:** `test/unit/inspection.service.spec.ts`

Add test:

```ts
describe('findByInspectorId', () => {
  it('returns paginated inspections for an inspector', async () => {
    const mockData = [{ id: 'insp-1', inspectorId: 'user-sub-123' }];
    mockInspectionRepo.findAndCount.mockResolvedValue([mockData, 1]);

    const result = await service.findByInspectorId('user-sub-123', 1, 20);

    expect(mockInspectionRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { inspectorId: 'user-sub-123' },
        skip: 0,
        take: 20,
      }),
    );
    expect(result.data).toEqual(mockData);
    expect(result.meta.total).toBe(1);
  });
});
```

---

### Task 17 — Unit tests for `findByCooperativePaginated()` in `export-document.service.spec.ts`

**File to modify:** `test/unit/export-document.service.spec.ts`

Add test:

```ts
describe('findByCooperativePaginated', () => {
  it('returns paginated export docs for a cooperative', async () => {
    const mockData = [{ id: 'doc-1', cooperativeId: 'coop-2' }];
    mockExportDocRepo.findAndCount.mockResolvedValue([mockData, 3]);

    const result = await service.findByCooperativePaginated('coop-2', 1, 20);

    expect(mockExportDocRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cooperativeId: 'coop-2' },
        skip: 0,
        take: 20,
      }),
    );
    expect(result.meta.total).toBe(3);
  });
});
```

---

### Task 18 — Unit tests for `downloadQrCode()` in `qr-code.service.spec.ts`

**File to modify:** `test/unit/qr-code.service.spec.ts`

Add tests:

```ts
describe('downloadQrCode', () => {
  it('returns PNG buffer for a GRANTED certification', async () => {
    mockCertificationRepo.findOne.mockResolvedValue({
      id: 'cert-1',
      currentStatus: 'GRANTED',
      certificationNumber: 'TERROIR-AOP-RSK-2026-001',
    });
    mockQrCodeRepo.findOne.mockResolvedValue({
      id: 'qr-1',
      certificationId: 'cert-1',
      isActive: true,
      verificationUrl: 'https://api.terroir.ma/verify/abc123',
    });

    const result = await service.downloadQrCode('cert-1', 'png');

    expect(result.mimeType).toBe('image/png');
    expect(result.filename).toBe('TERROIR-AOP-RSK-2026-001.png');
    expect(result.buffer).toBeInstanceOf(Buffer);
  });

  it('returns SVG buffer for a GRANTED certification', async () => {
    mockCertificationRepo.findOne.mockResolvedValue({
      id: 'cert-1',
      currentStatus: 'GRANTED',
      certificationNumber: 'TERROIR-AOP-RSK-2026-001',
    });
    mockQrCodeRepo.findOne.mockResolvedValue({
      id: 'qr-1',
      certificationId: 'cert-1',
      isActive: true,
      verificationUrl: 'https://api.terroir.ma/verify/abc123',
    });

    const result = await service.downloadQrCode('cert-1', 'svg');

    expect(result.mimeType).toBe('image/svg+xml');
    expect(result.filename).toBe('TERROIR-AOP-RSK-2026-001.svg');
    expect(result.buffer.toString()).toContain('<svg');
  });

  it('throws NotFoundException for non-GRANTED certification', async () => {
    mockCertificationRepo.findOne.mockResolvedValue({
      id: 'cert-2',
      currentStatus: 'DENIED',
    });

    await expect(service.downloadQrCode('cert-2', 'png')).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when no active QR code exists', async () => {
    mockCertificationRepo.findOne.mockResolvedValue({
      id: 'cert-3',
      currentStatus: 'GRANTED',
    });
    mockQrCodeRepo.findOne.mockResolvedValue(null);

    await expect(service.downloadQrCode('cert-3', 'png')).rejects.toThrow(NotFoundException);
  });
});
```

---

### Task 19 — Unit tests for trilingual `verifyQrCode()` in `qr-code.service.spec.ts`

**File to modify:** `test/unit/qr-code.service.spec.ts`

Add tests:

```ts
describe('verifyQrCode — i18n', () => {
  const grantedCert = {
    id: 'cert-1',
    currentStatus: 'GRANTED',
    certificationNumber: 'TERROIR-AOP-RSK-2026-001',
  };
  const activeQr = {
    id: 'qr-1',
    hmacSignature: 'sig123',
    isActive: true,
    expiresAt: null,
    scansCount: 0,
  };

  beforeEach(() => {
    mockCacheManager.get.mockResolvedValue(null);
    mockQrCodeRepo.findOne.mockResolvedValue(activeQr);
    mockCertificationRepo.findOne.mockResolvedValue(grantedCert);
    mockQrCodeRepo.increment.mockResolvedValue(undefined);
    mockCacheManager.set.mockResolvedValue(undefined);
  });

  it('returns French translation by default (no lang param)', async () => {
    const result = await service.verifyQrCode('sig123');
    expect(result.lang).toBe('fr');
    expect(result.rtl).toBe(false);
    expect(result.statusDisplay).toBe('Certifié');
    expect(result.message).toBe('Produit certifié');
  });

  it('returns Arabic translation and rtl:true for lang=ar', async () => {
    const result = await service.verifyQrCode('sig123', 'ar');
    expect(result.lang).toBe('ar');
    expect(result.rtl).toBe(true);
    expect(result.statusDisplay).toBe('معتمد');
  });

  it('returns Amazigh translation for lang=zgh', async () => {
    const result = await service.verifyQrCode('sig123', 'zgh');
    expect(result.lang).toBe('zgh');
    expect(result.rtl).toBe(false);
    expect(result.statusDisplay).toBe('ⴰⵙⵉⴼⵍⵍ');
  });

  it('falls back to fr for unknown lang', async () => {
    const result = await service.verifyQrCode('sig123', 'es');
    expect(result.lang).toBe('fr');
  });

  it('applies i18n on cache hit', async () => {
    const cachedResult = {
      valid: true,
      certification: grantedCert,
      qrCode: activeQr,
      message: 'raw',
    };
    mockCacheManager.get.mockResolvedValue(cachedResult);

    const result = await service.verifyQrCode('sig123', 'ar');
    expect(result.lang).toBe('ar');
    expect(result.rtl).toBe(true);
  });
});
```

---

### Task 20 — Final coverage verification

Run the full unit test suite and confirm all thresholds pass:

```bash
npm run test:unit:cov
```

Expected targets (≥ Sprint 4 baseline):

- Statements: ≥ 98%
- Branches: ≥ 85% (notification fix should lift this)
- Functions: ≥ 96%
- Lines: ≥ 98%

Record final numbers in `progress.md`.

---

## Execution Order Summary

| Batch   | Tasks | Ends with                             |
| ------- | ----- | ------------------------------------- |
| 1       | 1–3   | `lint + typecheck + test:unit`        |
| 2       | 4–6   | `lint + typecheck + test:unit`        |
| 3       | 7–8   | `lint + typecheck + test:unit`        |
| 4       | 9–11  | `lint + typecheck + test:unit`        |
| 5       | 12–14 | `lint + typecheck + test:unit`        |
| Testing | 15–20 | `test:unit:cov` (final coverage gate) |

**Total tasks:** 20
**Total story points:** 23
**New files:** 2 (`pagination-query.dto.ts`, `i18n-verification.constants.ts`)
**Modified files:** 7 existing source files + 5 existing spec files + `package.json`
**New Kafka events:** 0
**New DB migrations:** 0
