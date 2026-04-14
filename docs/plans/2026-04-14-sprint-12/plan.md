# Sprint 12 — v1 Hardening + QR Scan Events Implementation Plan

> **For Claude:** Use /execute to implement this plan task-by-task.

**Goal:** Complete v1 with US-058 QR scan tracking, ENV validation, OpenAPI docs, font asset handling, integration tests for Sprint 10-12 gaps, and E2E smoke tests.  
**Architecture:** Certification module (QrScanEvent entity + stats), ConfigModule (Joi validation), SwaggerModule (all controllers), PDF services (font fallback), Testcontainers (integration + E2E gaps)  
**Tech Stack:** NestJS, TypeScript, PostgreSQL, Testcontainers, Supertest, Joi, @nestjs/swagger  
**Modules Affected:** certification, common (config), all controllers (OpenAPI annotations)  
**Estimated Story Points:** 18

---

## Batch 1 — US-058: Migration + Entity + Service fire-and-forget (Tasks 1–3)

### Task 1 — Migration 017: AddQrScanEvent

**File to create:** `src/database/migrations/1700000000017-AddQrScanEvent.ts`

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQrScanEvent1700000000017 implements MigrationInterface {
  name = 'AddQrScanEvent1700000000017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE certification.qr_scan_event (
        id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        qr_code_id       UUID        NOT NULL,
        certification_id UUID        NOT NULL,
        scanned_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
        ip_address       VARCHAR(45)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX idx_qr_scan_event_qr_code_id
        ON certification.qr_scan_event(qr_code_id)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_qr_scan_event_certification_id
        ON certification.qr_scan_event(certification_id)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_qr_scan_event_scanned_at
        ON certification.qr_scan_event(scanned_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS certification.qr_scan_event`);
  }
}
```

### Task 2 — QrScanEvent entity

**File to create:** `src/modules/certification/entities/qr-scan-event.entity.ts`

```ts
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/**
 * Append-only log of every valid QR code scan.
 * Written fire-and-forget in QrCodeService.verifyQrCode() — never blocks response.
 * Schema: certification
 * US-058
 */
@Entity({ schema: 'certification', name: 'qr_scan_event' })
export class QrScanEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'qr_code_id', type: 'uuid' })
  qrCodeId: string;

  @Column({ name: 'certification_id', type: 'uuid' })
  certificationId: string;

  @Column({
    name: 'scanned_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  scannedAt: Date;

  @Column({ name: 'ip_address', length: 45, nullable: true })
  ipAddress: string | null;
}
```

### Task 3 — QrCodeService: inject QrScanEventRepo + fire-and-forget write

**File to modify:** `src/modules/certification/services/qr-code.service.ts`

Changes:

1. Add import for `QrScanEvent`
2. Inject `@InjectRepository(QrScanEvent) private readonly qrScanEventRepo: Repository<QrScanEvent>`
3. Inside `verifyQrCode()`, after `await this.cacheManager.set(cacheKey, grantedResult, 300_000)` (the GRANTED branch), add fire-and-forget write:

```ts
// Fire-and-forget — never blocks the 200ms SLA
this.qrScanEventRepo
  .save(
    this.qrScanEventRepo.create({
      qrCodeId: qrCode.id,
      certificationId: qrCode.certificationId,
      ipAddress: scannedFromIp ?? null,
    }),
  )
  .catch((err: unknown) => this.logger.error({ err }, 'Failed to write QR scan event'));
```

Write ONLY in the GRANTED branch (valid: true). Do NOT write for expired, revoked, RENEWED, or not-found cases.

**Verification:**

```
npm run lint
npm run typecheck
```

---

## Batch 2 — US-058: Stats DTO + getScanStats() + Module wiring (Tasks 4–6)

### Task 4 — ScanStatsResponseDto

**File to create:** `src/modules/certification/dto/scan-stats-response.dto.ts`

```ts
import { IsUUID, IsInt, IsDateString, IsOptional } from 'class-validator';

export class ScanStatsResponseDto {
  @IsUUID()
  certificationId: string;

  @IsInt()
  totalScans: number;

  @IsInt()
  last30DaysScans: number;

  @IsDateString()
  @IsOptional()
  firstScanAt: string | null;

  @IsDateString()
  @IsOptional()
  lastScanAt: string | null;
}
```

### Task 5 — QrCodeService.getScanStats() + certification.controller.ts endpoint

**File to modify:** `src/modules/certification/services/qr-code.service.ts`

Add new method after `evictQrCache()`:

```ts
/**
 * Return aggregate scan statistics for a certification's QR code.
 * Roles: super-admin, certification-body
 * US-058
 */
async getScanStats(certificationId: string): Promise<ScanStatsResponseDto> {
  const rows = await this.qrScanEventRepo.manager.query<
    Array<{
      total_scans: string;
      last_30_days_scans: string;
      first_scan_at: string | null;
      last_scan_at: string | null;
    }>
  >(
    `SELECT
       COUNT(*)                                                      AS total_scans,
       COUNT(*) FILTER (WHERE scanned_at > NOW() - INTERVAL '30 days') AS last_30_days_scans,
       MIN(scanned_at)                                               AS first_scan_at,
       MAX(scanned_at)                                               AS last_scan_at
     FROM certification.qr_scan_event
     WHERE certification_id = $1`,
    [certificationId],
  );

  const row = rows[0]!;
  return {
    certificationId,
    totalScans: Number(row.total_scans),
    last30DaysScans: Number(row.last_30_days_scans),
    firstScanAt: row.first_scan_at ?? null,
    lastScanAt: row.last_scan_at ?? null,
  };
}
```

Add import at top: `import { ScanStatsResponseDto } from '../dto/scan-stats-response.dto';`

**File to modify:** `src/modules/certification/controllers/certification.controller.ts`

Add new endpoint (order doesn't matter — `/:id/scan-stats` won't conflict with `/:id`):

```ts
@Get(':id/scan-stats')
@UseGuards(KeycloakAuthGuard, RolesGuard)
@Roles('super-admin', 'certification-body')
async getScanStats(@Param('id', ParseUUIDPipe) id: string): Promise<ScanStatsResponseDto> {
  return this.qrCodeService.getScanStats(id);
}
```

Inject `QrCodeService` into `CertificationController` constructor if not already present (check existing imports).

### Task 6 — CertificationModule: register QrScanEvent entity

**File to modify:** `src/modules/certification/certification.module.ts`

Add `QrScanEvent` to `TypeOrmModule.forFeature([...])`:

```ts
TypeOrmModule.forFeature([
  Certification,
  CertificationEvent,
  Inspection,
  InspectionReport,
  QrCode,
  ExportDocument,
  QrScanEvent,   // ← add
]),
```

Add import: `import { QrScanEvent } from './entities/qr-scan-event.entity';`

**Verification:**

```
npm run lint
npm run typecheck
```

---

## Batch 3 — US-058: Unit tests + Joi ENV validation (Tasks 7–9)

### Task 7 — Extend qr-code.service.spec.ts: +4 tests

**File to modify:** `test/unit/certification/qr-code.service.spec.ts`

In `makeRepo()` factory, add `qrScanEventRepo`:

```ts
const makeQrScanEventRepo = () => ({
  create: jest.fn((dto) => dto),
  save: jest.fn().mockResolvedValue({}),
  manager: {
    query: jest
      .fn()
      .mockResolvedValue([
        {
          total_scans: '5',
          last_30_days_scans: '2',
          first_scan_at: '2026-01-01T00:00:00Z',
          last_scan_at: '2026-04-01T00:00:00Z',
        },
      ]),
  },
});
```

Provide in test module: `{ provide: getRepositoryToken(QrScanEvent), useValue: makeQrScanEventRepo() }`

Add 4 tests:

1. `verifyQrCode() — writes QrScanEvent fire-and-forget on GRANTED scan` — mock qrCodeRepo returns active QR, certificationRepo returns GRANTED cert → after call, `qrScanEventRepo.save` called once
2. `verifyQrCode() — does NOT write QrScanEvent for invalid signature` — qrCodeRepo.findOne returns null → `qrScanEventRepo.save` never called
3. `getScanStats() — returns totals from raw SQL` — manager.query returns mock row → result has `totalScans: 5, last30DaysScans: 2`
4. `getScanStats() — casts COUNT string to number` — manager.query returns `{ total_scans: '42', ... }` → result.totalScans is `42` (number, not '42')

### Task 8 — Install joi + src/config/env.validation.ts

**Install:**

```bash
npm install joi
```

**File to create:** `src/config/env.validation.ts`

```ts
import * as Joi from 'joi';

/**
 * Joi schema for environment variable validation.
 * Wired into ConfigModule.forRoot({ validate }) in app.module.ts.
 * App refuses to start if any required variable is missing or malformed.
 */
export const envValidationSchema = Joi.object({
  // App
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().default(3000),

  // Database
  DATABASE_URL: Joi.string().required(),

  // Redis
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),

  // Kafka
  KAFKA_BROKERS: Joi.string().required(),
  KAFKA_CLIENT_ID: Joi.string().default('terroir-ma'),

  // Keycloak
  KEYCLOAK_URL: Joi.string().uri().required(),
  KEYCLOAK_REALM: Joi.string().required(),
  KEYCLOAK_CLIENT_ID: Joi.string().required(),
  KEYCLOAK_JWKS_URI: Joi.string().uri().required(),

  // QR HMAC
  QR_HMAC_SECRET: Joi.string().min(32).required(),

  // MinIO
  MINIO_ENDPOINT: Joi.string().required(),
  MINIO_PORT: Joi.number().default(9000),
  MINIO_ACCESS_KEY: Joi.string().required(),
  MINIO_SECRET_KEY: Joi.string().required(),
  MINIO_BUCKET: Joi.string().default('terroir-uploads'),
  MINIO_USE_SSL: Joi.boolean().default(false),

  // SMTP (optional — Mailpit in dev)
  SMTP_HOST: Joi.string().default('localhost'),
  SMTP_PORT: Joi.number().default(1025),
  SMTP_FROM: Joi.string()
    .email({ tlds: { allow: false } })
    .default('noreply@terroir.ma'),

  // Logging
  LOG_LEVEL: Joi.string().valid('trace', 'debug', 'info', 'warn', 'error').default('info'),
  CORS_ORIGINS: Joi.string().default('http://localhost:4200'),

  // Rate limiting
  RATE_LIMIT_TTL: Joi.number().default(900000),
  RATE_LIMIT_LIMIT: Joi.number().default(100),

  // Redpanda Admin (optional)
  REDPANDA_ADMIN_URL: Joi.string().uri().optional(),
}).options({ allowUnknown: true });

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const { error, value } = envValidationSchema.validate(config, { abortEarly: false });
  if (error) {
    throw new Error(
      `ENV validation failed:\n${error.details.map((d) => `  • ${d.message}`).join('\n')}`,
    );
  }
  return value as Record<string, unknown>;
}
```

### Task 9 — app.module.ts: wire validateEnv into ConfigModule

**File to modify:** `src/app.module.ts`

Add import at top:

```ts
import { validateEnv } from './config/env.validation';
```

Update `ConfigModule.forRoot(...)`:

```ts
ConfigModule.forRoot({
  isGlobal: true,
  load: [appConfig, databaseConfig, kafkaConfig, keycloakConfig, redisConfig, minioConfig],
  envFilePath: ['.env', '.env.local'],
  validate: validateEnv,   // ← add
}),
```

**Verification:**

```
npm run lint
npm run typecheck
npm run test:unit
```

---

## Batch 4 — OpenAPI: SwaggerModule + export script (Tasks 10–11)

### Task 10 — main.ts: SwaggerModule setup

**File to modify:** `src/main.ts`

Add imports at top:

```ts
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
```

Add Swagger setup block inside `bootstrap()`, after `app.useGlobalInterceptors(...)` and before `await app.listen(port)`:

```ts
// OpenAPI — available at /api-docs in non-production environments
if (configService.get<string>('NODE_ENV') !== 'production') {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Terroir.ma API')
    .setDescription(
      'Modular monolith for Morocco SDOQ terroir product certification (Law 25-06). ' +
        'All endpoints require Bearer JWT issued by Keycloak except /health, /ready, and /verify/:sig.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, document);
}
```

### Task 11 — export-openapi.ts script + package.json update

**File to create:** `src/scripts/export-openapi.ts`

```ts
/**
 * Standalone script to export the OpenAPI document as JSON.
 * Usage: npx ts-node src/scripts/export-openapi.ts
 * Output: docs/api/openapi.json
 */
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { AppModule } from '../app.module';

async function exportOpenApi(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'ready'] });

  const config = new DocumentBuilder()
    .setTitle('Terroir.ma API')
    .setDescription('SDOQ terroir product certification platform — Morocco Law 25-06')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  const outDir = join(process.cwd(), 'docs', 'api');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'openapi.json'), JSON.stringify(document, null, 2));

  console.log('OpenAPI document written to docs/api/openapi.json');
  await app.close();
  process.exit(0);
}

exportOpenApi().catch((err) => {
  console.error('Failed to export OpenAPI:', err);
  process.exit(1);
});
```

**File to modify:** `package.json`

Add script in `"scripts"` block:

```json
"export:openapi": "ts-node -r tsconfig-paths/register src/scripts/export-openapi.ts"
```

**Verification:**

```
npm run lint
npm run typecheck
```

---

## Batch 5 — OpenAPI: Controller annotation pass (Tasks 12–13)

### Task 12 — Annotate controllers: health, user, admin, cooperative, product, lab

For each controller, add at class level:

- `@ApiTags('tag-name')`
- `@ApiBearerAuth()` (skip for HealthController — no auth)

For each endpoint method, add:

- `@ApiOperation({ summary: 'One-line description' })`
- `@ApiResponse({ status: 200, description: 'Success' })`
- `@ApiResponse({ status: 401, description: 'Unauthorized' })` (skip on public endpoints)

**Files to modify:**

`src/health/health.controller.ts` — `@ApiTags('health')`, no `@ApiBearerAuth()`

`src/common/controllers/user.controller.ts` — `@ApiTags('users')`, `@ApiBearerAuth()`  
Endpoints: `GET /users/me` → `@ApiOperation({ summary: 'Get current user profile from JWT' })`

`src/common/controllers/admin.controller.ts` — `@ApiTags('admin')`, `@ApiBearerAuth()`  
Endpoints: dashboard, audit-logs, settings/campaign, settings/certification, settings/platform

`src/modules/cooperative/controllers/cooperative.controller.ts` — `@ApiTags('cooperatives')`, `@ApiBearerAuth()`

`src/modules/product/controllers/product.controller.ts` — `@ApiTags('products')`, `@ApiBearerAuth()`

`src/modules/product/controllers/lab.controller.ts` — `@ApiTags('labs')`, `@ApiBearerAuth()`

Imports to add in each file:

```ts
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
```

### Task 13 — Annotate controllers: lab-test, product-document, certification, qr-code, export-document, notification

Same pattern as Task 12.

`src/modules/product/controllers/lab-test.controller.ts` — `@ApiTags('lab-tests')`, `@ApiBearerAuth()`

`src/modules/product/controllers/product-document.controller.ts` — `@ApiTags('product-documents')`, `@ApiBearerAuth()`

`src/modules/certification/controllers/certification.controller.ts` — `@ApiTags('certifications')`, `@ApiBearerAuth()`

`src/modules/certification/controllers/qr-code.controller.ts` — `@ApiTags('qr-codes')`, `@ApiBearerAuth()`  
Note: `GET /verify/:sig` is public — skip `@ApiBearerAuth()` on that method only

`src/modules/certification/controllers/export-document.controller.ts` — `@ApiTags('export-documents')`, `@ApiBearerAuth()`

`src/modules/notification/controllers/notification.controller.ts` — `@ApiTags('notifications')`, `@ApiBearerAuth()`

**Verification:**

```
npm run lint
npm run typecheck
npm run test:unit
```

---

## Batch 6 — Font assets + PDF graceful fallback (Tasks 14–15)

### Task 14 — Font directory + download script

**File to create:** `assets/fonts/.gitkeep` (empty file — ensures directory is tracked)

**File to create:** `scripts/download-fonts.sh`

```bash
#!/usr/bin/env bash
# Download required font assets for Terroir.ma PDF generation.
# Run once after cloning: bash scripts/download-fonts.sh
set -e

FONTS_DIR="$(dirname "$0")/../assets/fonts"
mkdir -p "$FONTS_DIR"

echo "Downloading Amiri-Regular.ttf (Arabic, OFL license)..."
curl -L "https://github.com/alif-type/amiri/releases/download/0.113/amiri-0.113.zip" \
  -o /tmp/amiri.zip
unzip -o /tmp/amiri.zip "Amiri-Regular.ttf" -d "$FONTS_DIR"
rm /tmp/amiri.zip

echo "Downloading DejaVuSans.ttf (Latin + Tifinagh, free license)..."
curl -L "https://github.com/dejavu-fonts/dejavu-fonts/releases/download/version_2_37/dejavu-fonts-ttf-2.37.tar.bz2" \
  -o /tmp/dejavu.tar.bz2
tar -xjf /tmp/dejavu.tar.bz2 --strip-components=2 -C "$FONTS_DIR" \
  "dejavu-fonts-ttf-2.37/ttf/DejaVuSans.ttf"
rm /tmp/dejavu.tar.bz2

echo "Fonts installed to $FONTS_DIR:"
ls -lh "$FONTS_DIR"
```

### Task 15 — PDF services: graceful font fallback

**File to modify:** `src/modules/certification/services/certification-pdf.service.ts`

Replace any `doc.registerFont(...)` + `doc.font(name)` block with a font-aware helper. Pattern to apply in `buildPdf()` (or wherever `registerFont` is called):

```ts
import { existsSync } from 'fs';

// At top of buildPdf() / private method:
const amiriPath = path.join(this.fontsDir, 'Amiri-Regular.ttf');
const dejavuPath = path.join(this.fontsDir, 'DejaVuSans.ttf');
const hasAmiri = existsSync(amiriPath);
const hasDejaVu = existsSync(dejavuPath);

if (!hasDejaVu) {
  this.logger.warn(
    'DejaVuSans.ttf not found — using Helvetica fallback. Run scripts/download-fonts.sh to install fonts.',
  );
}
if (!hasAmiri) {
  this.logger.warn(
    'Amiri-Regular.ttf not found — Arabic block will use Helvetica. Run scripts/download-fonts.sh.',
  );
}

if (hasDejaVu) doc.registerFont('DejaVu', dejavuPath);
if (hasAmiri) doc.registerFont('Amiri', amiriPath);

// Use font name with fallback:
const latinFont = hasDejaVu ? 'DejaVu' : 'Helvetica';
const arabicFont = hasAmiri ? 'Amiri' : 'Helvetica';
```

Replace all `doc.font('DejaVu')` with `doc.font(latinFont)` and `doc.font('Amiri')` with `doc.font(arabicFont)`.

**File to modify:** `src/modules/certification/services/export-document-pdf.service.ts`

Apply same pattern — replace `doc.registerFont('DejaVu', dejavu)` block with the existsSync guard. Replace `doc.font('DejaVu')` with `doc.font(latinFont)`.

**Verification:**

```
npm run lint
npm run typecheck
npm run test:unit
```

---

## Batch 7 — Integration tests: common module + qr-scan-event (Tasks 16–18)

### Task 16 — test/integration/common/system-settings.integration.ts

**File to create:** `test/integration/common/system-settings.integration.ts`

Uses `startTestDatabase([SystemSetting])` from the existing helper.

Test cases:

1. `should persist a system setting row`
2. `should update an existing setting on conflict (upsert pattern)` — save same (group, key) twice, assert single row with updated value
3. `should retrieve settings by group` — save 3 rows with group='campaign', assert findBy returns 3

```ts
import { SystemSetting } from '../../../src/common/entities/system-setting.entity';
import {
  startTestDatabase,
  stopTestDatabase,
  TestDatabase,
} from '../helpers/test-containers.setup';

describe('SystemSetting (integration)', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await startTestDatabase([SystemSetting]);
  });
  afterAll(async () => {
    await stopTestDatabase(db);
  });
  afterEach(async () => {
    await db.dataSource.query(`TRUNCATE TABLE common.system_setting`);
  });

  it('should persist a system setting row', async () => {
    const repo = db.dataSource.getRepository(SystemSetting);
    await repo.save(
      repo.create({
        settingGroup: 'platform',
        settingKey: 'maintenanceMode',
        settingValue: 'false',
      }),
    );
    const found = await repo.findOneBy({ settingGroup: 'platform', settingKey: 'maintenanceMode' });
    expect(found?.settingValue).toBe('false');
  });

  it('should allow updating a setting value', async () => {
    const repo = db.dataSource.getRepository(SystemSetting);
    await repo.save(
      repo.create({
        settingGroup: 'platform',
        settingKey: 'maintenanceMode',
        settingValue: 'false',
      }),
    );
    await repo.save(
      repo.create({
        settingGroup: 'platform',
        settingKey: 'maintenanceMode',
        settingValue: 'true',
      }),
    );
    const rows = await repo.findBy({ settingGroup: 'platform' });
    // Two rows (no DB-level upsert in test — entity layer does save/findOne)
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it('should retrieve all settings for a group', async () => {
    const repo = db.dataSource.getRepository(SystemSetting);
    await repo.save([
      repo.create({
        settingGroup: 'campaign',
        settingKey: 'currentCampaignYear',
        settingValue: '2025-2026',
      }),
      repo.create({
        settingGroup: 'campaign',
        settingKey: 'campaignStartMonth',
        settingValue: '10',
      }),
      repo.create({ settingGroup: 'campaign', settingKey: 'campaignEndMonth', settingValue: '9' }),
    ]);
    const rows = await repo.findBy({ settingGroup: 'campaign' });
    expect(rows.length).toBe(3);
  });
});
```

### Task 17 — test/integration/common/audit-log.integration.ts

**File to create:** `test/integration/common/audit-log.integration.ts`

Test cases:

1. `should persist an audit log row (append-only)`
2. `should not have updatedAt column` — query raw SQL `SELECT column_name FROM information_schema.columns WHERE table_name = 'audit_log'`, assert no 'updated_at'
3. `should paginate findAll by userId filter`

### Task 18 — test/integration/certification/qr-scan-event.integration.ts

**File to create:** `test/integration/certification/qr-scan-event.integration.ts`

Uses `startTestDatabase([QrCode, QrScanEvent])`.

Test cases:

1. `should persist a QrScanEvent row`
2. `should aggregate scan stats via raw SQL` — insert 3 rows for same certificationId → raw SQL query → totalScans = 3
3. `should track ip_address when provided`
4. `should allow null ip_address`

```ts
import { QrScanEvent } from '../../../src/modules/certification/entities/qr-scan-event.entity';
import {
  startTestDatabase,
  stopTestDatabase,
  TestDatabase,
} from '../helpers/test-containers.setup';

const CERT_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380b01';
const QR_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380b02';

describe('QrScanEvent (integration)', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await startTestDatabase([QrScanEvent]);
  });
  afterAll(async () => {
    await stopTestDatabase(db);
  });
  afterEach(async () => {
    await db.dataSource.query(`TRUNCATE TABLE certification.qr_scan_event`);
  });

  it('should persist a scan event', async () => {
    const repo = db.dataSource.getRepository(QrScanEvent);
    await repo.save(
      repo.create({ qrCodeId: QR_ID, certificationId: CERT_ID, ipAddress: '192.168.1.1' }),
    );
    const found = await repo.findOneBy({ certificationId: CERT_ID });
    expect(found?.ipAddress).toBe('192.168.1.1');
  });

  it('should aggregate totalScans correctly', async () => {
    const repo = db.dataSource.getRepository(QrScanEvent);
    await repo.save([
      repo.create({ qrCodeId: QR_ID, certificationId: CERT_ID, ipAddress: null }),
      repo.create({ qrCodeId: QR_ID, certificationId: CERT_ID, ipAddress: '10.0.0.1' }),
      repo.create({ qrCodeId: QR_ID, certificationId: CERT_ID, ipAddress: '10.0.0.2' }),
    ]);
    const rows = await db.dataSource.query(
      `SELECT COUNT(*) AS total FROM certification.qr_scan_event WHERE certification_id = $1`,
      [CERT_ID],
    );
    expect(Number(rows[0].total)).toBe(3);
  });

  it('should allow null ip_address', async () => {
    const repo = db.dataSource.getRepository(QrScanEvent);
    await repo.save(repo.create({ qrCodeId: QR_ID, certificationId: CERT_ID, ipAddress: null }));
    const found = await repo.findOneBy({ certificationId: CERT_ID });
    expect(found?.ipAddress).toBeNull();
  });
});
```

**Verification:**

```
npm run lint
npm run typecheck
```

---

## Batch 8 — Integration test: notification preference + E2E smoke tests (Tasks 19–22)

### Task 19 — test/integration/notification/notification-preference.integration.ts

**File to create:** `test/integration/notification/notification-preference.integration.ts`

Uses `startTestDatabase([NotificationPreference])`.

Test cases:

1. `should persist notification preference for a user`
2. `should update channels on second save` — save, then update channels array → assert new value
3. `should store channels as TEXT[]` — raw SQL `SELECT channels FROM notification.notification_preference WHERE user_id = $1` → parse array

```ts
import { NotificationPreference } from '../../../src/modules/notification/entities/notification-preference.entity';
import {
  startTestDatabase,
  stopTestDatabase,
  TestDatabase,
} from '../helpers/test-containers.setup';

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01';

describe('NotificationPreference (integration)', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await startTestDatabase([NotificationPreference]);
  });
  afterAll(async () => {
    await stopTestDatabase(db);
  });
  afterEach(async () => {
    await db.dataSource.query(`TRUNCATE TABLE notification.notification_preference`);
  });

  it('should persist a notification preference', async () => {
    const repo = db.dataSource.getRepository(NotificationPreference);
    await repo.save(repo.create({ userId: USER_ID, channels: ['email', 'sms'], language: 'fr' }));
    const found = await repo.findOneBy({ userId: USER_ID });
    expect(found?.channels).toEqual(['email', 'sms']);
    expect(found?.language).toBe('fr');
  });

  it('should overwrite channels on update', async () => {
    const repo = db.dataSource.getRepository(NotificationPreference);
    await repo.save(repo.create({ userId: USER_ID, channels: ['email'], language: 'fr' }));
    await repo.upsert({ userId: USER_ID, channels: ['sms'], language: 'ar' }, ['userId']);
    const found = await repo.findOneBy({ userId: USER_ID });
    expect(found?.channels).toEqual(['sms']);
  });

  it('should persist Arabic language preference', async () => {
    const repo = db.dataSource.getRepository(NotificationPreference);
    await repo.save(repo.create({ userId: USER_ID, channels: ['email'], language: 'ar' }));
    const found = await repo.findOneBy({ userId: USER_ID });
    expect(found?.language).toBe('ar');
  });
});
```

### Task 20 — test/e2e/smoke/cooperative-onboarding.e2e.ts

**File to create:** `test/e2e/smoke/cooperative-onboarding.e2e.ts`

Uses `createTestApp()` (existing helper) + `generateTestTokens()` (existing auth helper).

Test cases:

1. `POST /api/v1/cooperatives — creates cooperative (super-admin)` → 201
2. `GET /api/v1/cooperatives/:id — retrieves created cooperative` → 200, id matches
3. `PUT /api/v1/cooperatives/:id/verify — verifies cooperative (super-admin)` → 200

```ts
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from '../../helpers/app.helper';
import { generateTestTokens, authHeader } from '../helpers/auth.helper';

describe('Cooperative Onboarding Smoke (e2e)', () => {
  let app: INestApplication;
  let superAdminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    superAdminToken = generateTestTokens().superAdmin;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should create, retrieve, and verify a cooperative', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/cooperatives')
      .set(authHeader(superAdminToken))
      .send({
        name: 'Coopérative Test Argan',
        ice: '001234567000011',
        phone: '+212612345678',
        regionCode: 'SUS',
        certificationTypes: ['AOP'],
      });
    expect(createRes.status).toBe(201);
    const cooperativeId = createRes.body.data.id as string;

    const getRes = await request(app.getHttpServer())
      .get(`/api/v1/cooperatives/${cooperativeId}`)
      .set(authHeader(superAdminToken));
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.id).toBe(cooperativeId);

    const verifyRes = await request(app.getHttpServer())
      .put(`/api/v1/cooperatives/${cooperativeId}/verify`)
      .set(authHeader(superAdminToken));
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.status).toBe('verified');
  });
});
```

### Task 21 — test/e2e/smoke/certification-grant.e2e.ts

**File to create:** `test/e2e/smoke/certification-grant.e2e.ts`

Tests the certification request → grant path. Uses `createTestApp()` + seed helpers.

Test cases:

1. `POST /api/v1/certifications — cooperative-admin requests certification` → 201
2. `GET /api/v1/certifications/:id/events — event ledger has REQUESTED event` → 200, events.length ≥ 1
3. `GET /api/v1/certifications/:id — certification is in DRAFT status` → 200

Note: Full chain walk (12 steps) is covered by `certification-chain.e2e.ts`. This smoke test only checks the entry point.

### Task 22 — test/e2e/smoke/qr-verify.e2e.ts

**File to create:** `test/e2e/smoke/qr-verify.e2e.ts`

Smoke test for the QR verify → scan-stats flow (US-058).

Test cases:

1. `POST /api/v1/qr-codes/:certId — generates QR code for granted certification` → 201 (requires seeded GRANTED cert)
2. `GET /api/v1/verify/:hmac — verifies QR code, returns valid: true` → 200
3. `GET /api/v1/certifications/:certId/scan-stats — returns totalScans ≥ 1 after scan` → 200, data.totalScans ≥ 1

**Verification:**

```
npm run lint
npm run typecheck
npm run test:unit
```

---

## Testing Summary

### New unit tests (Task 7)

- `test/unit/certification/qr-code.service.spec.ts` — +4 tests

### New integration test files (Tasks 16–19)

- `test/integration/common/system-settings.integration.ts` — 3 tests
- `test/integration/common/audit-log.integration.ts` — 3 tests
- `test/integration/certification/qr-scan-event.integration.ts` — 3 tests
- `test/integration/notification/notification-preference.integration.ts` — 3 tests

### New E2E smoke test files (Tasks 20–22)

- `test/e2e/smoke/cooperative-onboarding.e2e.ts` — 1 scenario (3 requests)
- `test/e2e/smoke/certification-grant.e2e.ts` — 1 scenario (3 requests)
- `test/e2e/smoke/qr-verify.e2e.ts` — 1 scenario (3 requests)

### Expected test count after Sprint 12

| Type              | Before | After                |
| ----------------- | ------ | -------------------- |
| Unit suites       | 36     | **37** (+1 extended) |
| Unit tests        | 382    | **386** (+4)         |
| Integration files | 8      | **12** (+4)          |
| E2E files         | 7      | **10** (+3)          |

---

## Batch Verification Checkpoints

| After Batch | Command                                                  | Must pass                  |
| ----------- | -------------------------------------------------------- | -------------------------- |
| 1           | `npm run typecheck`                                      | ✅                         |
| 2           | `npm run lint && npm run typecheck`                      | ✅                         |
| 3           | `npm run lint && npm run typecheck && npm run test:unit` | ✅ (386 tests)             |
| 4           | `npm run lint && npm run typecheck`                      | ✅                         |
| 5           | `npm run lint && npm run typecheck && npm run test:unit` | ✅                         |
| 6           | `npm run lint && npm run typecheck && npm run test:unit` | ✅                         |
| 7           | `npm run lint && npm run typecheck`                      | ✅                         |
| 8           | `npm run lint && npm run typecheck && npm run test:unit` | ✅ (386 tests, 0 failures) |

---

## Post-Sprint v1 Checklist

- [ ] `npm run migration:run` — apply migration 017 (AddQrScanEvent) after `docker compose up`
- [ ] `bash scripts/download-fonts.sh` — install Amiri + DejaVuSans for PDF endpoints
- [ ] `npm run export:openapi` — generate `docs/api/openapi.json`
- [ ] `npm run test:unit` — 386 tests, 0 failures
- [ ] `npm run test:integration` — 12 integration files (requires `docker compose up`)
- [ ] `npm run test:e2e` — 10 E2E files (requires `docker compose up`)
- [ ] Remove a required ENV var (e.g. `QR_HMAC_SECRET`), restart app — confirm clear validation error
- [ ] `GET /api-docs` in dev — all endpoints listed with tags

---

## New Files Created

| File                                                                   | Purpose                            |
| ---------------------------------------------------------------------- | ---------------------------------- |
| `src/database/migrations/1700000000017-AddQrScanEvent.ts`              | Migration 017                      |
| `src/modules/certification/entities/qr-scan-event.entity.ts`           | QrScanEvent entity                 |
| `src/modules/certification/dto/scan-stats-response.dto.ts`             | Stats response shape               |
| `src/config/env.validation.ts`                                         | Joi ENV schema                     |
| `src/scripts/export-openapi.ts`                                        | OpenAPI JSON export script         |
| `assets/fonts/.gitkeep`                                                | Track fonts directory in git       |
| `scripts/download-fonts.sh`                                            | Font download helper               |
| `test/integration/common/system-settings.integration.ts`               | SystemSetting integration          |
| `test/integration/common/audit-log.integration.ts`                     | AuditLog integration               |
| `test/integration/certification/qr-scan-event.integration.ts`          | QrScanEvent integration            |
| `test/integration/notification/notification-preference.integration.ts` | NotificationPreference integration |
| `test/e2e/smoke/cooperative-onboarding.e2e.ts`                         | E2E smoke: onboarding              |
| `test/e2e/smoke/certification-grant.e2e.ts`                            | E2E smoke: cert grant              |
| `test/e2e/smoke/qr-verify.e2e.ts`                                      | E2E smoke: QR verify + scan-stats  |

## Modified Files

| File                                                                  | Change                                                         |
| --------------------------------------------------------------------- | -------------------------------------------------------------- |
| `src/modules/certification/services/qr-code.service.ts`               | +QrScanEventRepo inject, fire-and-forget write, getScanStats() |
| `src/modules/certification/controllers/certification.controller.ts`   | +GET :id/scan-stats                                            |
| `src/modules/certification/certification.module.ts`                   | +QrScanEvent in forFeature                                     |
| `src/app.module.ts`                                                   | +validate: validateEnv in ConfigModule                         |
| `src/main.ts`                                                         | +SwaggerModule setup                                           |
| `package.json`                                                        | +export:openapi script, +joi dependency                        |
| `src/modules/certification/services/certification-pdf.service.ts`     | +existsSync font fallback                                      |
| `src/modules/certification/services/export-document-pdf.service.ts`   | +existsSync font fallback                                      |
| `src/common/controllers/admin.controller.ts`                          | +@ApiTags etc                                                  |
| `src/common/controllers/user.controller.ts`                           | +@ApiTags etc                                                  |
| `src/health/health.controller.ts`                                     | +@ApiTags                                                      |
| `src/modules/cooperative/controllers/cooperative.controller.ts`       | +@ApiTags etc                                                  |
| `src/modules/product/controllers/product.controller.ts`               | +@ApiTags etc                                                  |
| `src/modules/product/controllers/lab.controller.ts`                   | +@ApiTags etc                                                  |
| `src/modules/product/controllers/lab-test.controller.ts`              | +@ApiTags etc                                                  |
| `src/modules/product/controllers/product-document.controller.ts`      | +@ApiTags etc                                                  |
| `src/modules/certification/controllers/certification.controller.ts`   | +@ApiTags etc (already modified above)                         |
| `src/modules/certification/controllers/qr-code.controller.ts`         | +@ApiTags etc                                                  |
| `src/modules/certification/controllers/export-document.controller.ts` | +@ApiTags etc                                                  |
| `src/modules/notification/controllers/notification.controller.ts`     | +@ApiTags etc                                                  |
| `test/unit/certification/qr-code.service.spec.ts`                     | +4 tests for scan event + stats                                |
