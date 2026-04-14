# Sprint 11 — System Config, Reports, Preferences Implementation Plan

> **For Claude:** Use /execute to implement this plan task-by-task.

**Goal:** Implement US-090 system settings, US-050/US-020/US-070 CSV exports, US-077 notification preferences, and US-069 HS code assignments — all read/config stories, zero new Kafka events.

**Architecture:** AdminController owns settings (GET/PATCH /admin/settings/{group}). CSV exports are inline string-builds (no npm). NotificationPreference is owned by notification module, keyed by Keycloak `sub`. ExportDocument HS-codes/clearances queries are intra-module (same `certification` schema).

**Tech Stack:** NestJS, TypeScript, PostgreSQL + PostGIS, Redpanda, Keycloak, Redis

**Modules Affected:** common (system settings), certification (compliance export, clearances, HS codes), notification (preferences), product (product export)

**Estimated Story Points:** 24

---

## Batch 1 — Migration 015 + SystemSetting Entity + SystemSettingsService

### Task 1 — Migration 015: AddSystemSetting

**File:** `src/database/migrations/1700000000015-AddSystemSetting.ts`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSystemSetting1700000000015 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE common.system_setting (
        setting_group  VARCHAR(50)   NOT NULL,
        setting_key    VARCHAR(100)  NOT NULL,
        setting_value  TEXT          NOT NULL,
        updated_by     UUID,
        updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        PRIMARY KEY (setting_group, setting_key)
      );
    `);

    await queryRunner.query(`
      INSERT INTO common.system_setting (setting_group, setting_key, setting_value, updated_at) VALUES
        ('campaign',      'current_campaign_year',  '2025-2026',           NOW()),
        ('campaign',      'campaign_start_month',   '10',                  NOW()),
        ('campaign',      'campaign_end_month',     '9',                   NOW()),
        ('certification', 'default_validity_days',  '365',                 NOW()),
        ('certification', 'max_renewal_grace_days', '90',                  NOW()),
        ('platform',      'maintenance_mode',       'false',               NOW()),
        ('platform',      'support_email',          'support@terroir.ma',  NOW());
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS common.system_setting;`);
  }
}
```

**Verification:** `npx tsc --noEmit` — no errors.

---

### Task 2 — SystemSetting Entity

**File:** `src/common/entities/system-setting.entity.ts`

```typescript
import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

/**
 * US-090: Key-value store for platform-wide settings.
 * Schema: common. Composite PK: (setting_group, setting_key).
 * Grouped into 'campaign', 'certification', 'platform'.
 */
@Entity({ schema: 'common', name: 'system_setting' })
export class SystemSetting {
  @PrimaryColumn({ name: 'setting_group', type: 'varchar', length: 50 })
  settingGroup: string;

  @PrimaryColumn({ name: 'setting_key', type: 'varchar', length: 100 })
  settingKey: string;

  @Column({ name: 'setting_value', type: 'text' })
  settingValue: string;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
```

---

### Task 3 — SystemSettingsService

**File:** `src/common/services/system-settings.service.ts`

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { SystemSetting } from '../entities/system-setting.entity';
import { CampaignSettingsDto } from '../dto/settings/campaign-settings.dto';
import { CertificationSettingsDto } from '../dto/settings/certification-settings.dto';
import { PlatformSettingsDto } from '../dto/settings/platform-settings.dto';

type SettingsGroup = 'campaign' | 'certification' | 'platform';
type SettingsDto = CampaignSettingsDto | CertificationSettingsDto | PlatformSettingsDto;

/**
 * US-090: Reads and writes grouped platform settings.
 * Backed by common.system_setting. Each group is Redis-cached for 300s.
 * Cache key: settings:{group}. Invalidated on PATCH.
 */
@Injectable()
export class SystemSettingsService {
  constructor(
    @InjectRepository(SystemSetting)
    private readonly settingRepo: Repository<SystemSetting>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /** Read all rows for a group and return as a typed plain object. */
  private async readGroup(group: SettingsGroup): Promise<Record<string, string>> {
    const rows = await this.settingRepo.find({ where: { settingGroup: group } });
    return Object.fromEntries(rows.map((r) => [r.settingKey, r.settingValue]));
  }

  /** Upsert all key-value pairs from a DTO into the given group. */
  private async upsertGroup(
    group: SettingsGroup,
    dto: Record<string, unknown>,
    updatedBy: string,
  ): Promise<void> {
    for (const [key, value] of Object.entries(dto)) {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      await this.settingRepo.upsert(
        {
          settingGroup: group,
          settingKey: snakeKey,
          settingValue: String(value),
          updatedBy,
        },
        { conflictPaths: ['settingGroup', 'settingKey'] },
      );
    }
    await this.cacheManager.del(`settings:${group}`);
  }

  /** US-090: Read campaign settings. */
  async getCampaignSettings(): Promise<CampaignSettingsDto> {
    const cached = await this.cacheManager.get<CampaignSettingsDto>('settings:campaign');
    if (cached) return cached;
    const kv = await this.readGroup('campaign');
    const result: CampaignSettingsDto = {
      currentCampaignYear: kv['current_campaign_year'] ?? '2025-2026',
      campaignStartMonth: Number(kv['campaign_start_month'] ?? 10),
      campaignEndMonth: Number(kv['campaign_end_month'] ?? 9),
    };
    await this.cacheManager.set('settings:campaign', result, 300_000);
    return result;
  }

  /** US-090: Persist campaign settings. */
  async updateCampaignSettings(
    dto: CampaignSettingsDto,
    updatedBy: string,
  ): Promise<CampaignSettingsDto> {
    await this.upsertGroup('campaign', dto as unknown as Record<string, unknown>, updatedBy);
    return this.getCampaignSettings();
  }

  /** US-090: Read certification settings. */
  async getCertificationSettings(): Promise<CertificationSettingsDto> {
    const cached = await this.cacheManager.get<CertificationSettingsDto>('settings:certification');
    if (cached) return cached;
    const kv = await this.readGroup('certification');
    const result: CertificationSettingsDto = {
      defaultValidityDays: Number(kv['default_validity_days'] ?? 365),
      maxRenewalGraceDays: Number(kv['max_renewal_grace_days'] ?? 90),
    };
    await this.cacheManager.set('settings:certification', result, 300_000);
    return result;
  }

  /** US-090: Persist certification settings. */
  async updateCertificationSettings(
    dto: CertificationSettingsDto,
    updatedBy: string,
  ): Promise<CertificationSettingsDto> {
    await this.upsertGroup('certification', dto as unknown as Record<string, unknown>, updatedBy);
    return this.getCertificationSettings();
  }

  /** US-090: Read platform settings. */
  async getPlatformSettings(): Promise<PlatformSettingsDto> {
    const cached = await this.cacheManager.get<PlatformSettingsDto>('settings:platform');
    if (cached) return cached;
    const kv = await this.readGroup('platform');
    const result: PlatformSettingsDto = {
      maintenanceMode: kv['maintenance_mode'] === 'true',
      supportEmail: kv['support_email'] ?? 'support@terroir.ma',
    };
    await this.cacheManager.set('settings:platform', result, 300_000);
    return result;
  }

  /** US-090: Persist platform settings. */
  async updatePlatformSettings(
    dto: PlatformSettingsDto,
    updatedBy: string,
  ): Promise<PlatformSettingsDto> {
    await this.upsertGroup('platform', dto as unknown as Record<string, unknown>, updatedBy);
    return this.getPlatformSettings();
  }
}
```

**Verification:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 2 — Settings DTOs + AdminController Settings Endpoints + AppModule Wiring

### Task 4 — Three Settings DTOs

**File:** `src/common/dto/settings/campaign-settings.dto.ts`

```typescript
import { IsString, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CampaignSettingsDto {
  @ApiProperty({ example: '2025-2026' })
  @IsString()
  currentCampaignYear: string;

  @ApiProperty({ example: 10, minimum: 1, maximum: 12 })
  @IsInt()
  @Min(1)
  @Max(12)
  campaignStartMonth: number;

  @ApiProperty({ example: 9, minimum: 1, maximum: 12 })
  @IsInt()
  @Min(1)
  @Max(12)
  campaignEndMonth: number;
}
```

**File:** `src/common/dto/settings/certification-settings.dto.ts`

```typescript
import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CertificationSettingsDto {
  @ApiProperty({ example: 365 })
  @IsInt()
  @Min(1)
  defaultValidityDays: number;

  @ApiProperty({ example: 90 })
  @IsInt()
  @Min(0)
  maxRenewalGraceDays: number;
}
```

**File:** `src/common/dto/settings/platform-settings.dto.ts`

```typescript
import { IsBoolean, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PlatformSettingsDto {
  @ApiProperty({ example: false })
  @IsBoolean()
  maintenanceMode: boolean;

  @ApiProperty({ example: 'support@terroir.ma' })
  @IsEmail()
  supportEmail: string;
}
```

---

### Task 5 — AdminController: Add Settings Endpoints

**File:** `src/common/controllers/admin.controller.ts` — add imports + constructor injection + 6 new endpoints.

Add to imports:

```typescript
import { Body, Patch } from '@nestjs/common';
import { SystemSettingsService } from '../services/system-settings.service';
import { CampaignSettingsDto } from '../dto/settings/campaign-settings.dto';
import { CertificationSettingsDto } from '../dto/settings/certification-settings.dto';
import { PlatformSettingsDto } from '../dto/settings/platform-settings.dto';
import { CurrentUser, CurrentUserPayload } from '../decorators/current-user.decorator';
```

Add `SystemSettingsService` to constructor:

```typescript
constructor(
  private readonly kafkaAdminService: KafkaAdminService,
  private readonly dashboardService: DashboardService,
  private readonly auditLogService: AuditLogService,
  private readonly systemSettingsService: SystemSettingsService,
) {}
```

Add 6 endpoints (before the closing `}`):

```typescript
/** US-090: Get campaign settings */
@Get('settings/campaign')
@ApiOperation({ summary: 'US-090: Get campaign settings (super-admin)' })
async getCampaignSettings(): Promise<{ success: boolean; data: CampaignSettingsDto }> {
  const data = await this.systemSettingsService.getCampaignSettings();
  return { success: true, data };
}

/** US-090: Update campaign settings */
@Patch('settings/campaign')
@ApiOperation({ summary: 'US-090: Update campaign settings (super-admin)' })
async updateCampaignSettings(
  @Body() dto: CampaignSettingsDto,
  @CurrentUser() user: CurrentUserPayload,
): Promise<{ success: boolean; data: CampaignSettingsDto }> {
  const data = await this.systemSettingsService.updateCampaignSettings(dto, user.sub);
  return { success: true, data };
}

/** US-090: Get certification settings */
@Get('settings/certification')
@ApiOperation({ summary: 'US-090: Get certification settings (super-admin)' })
async getCertificationSettings(): Promise<{ success: boolean; data: CertificationSettingsDto }> {
  const data = await this.systemSettingsService.getCertificationSettings();
  return { success: true, data };
}

/** US-090: Update certification settings */
@Patch('settings/certification')
@ApiOperation({ summary: 'US-090: Update certification settings (super-admin)' })
async updateCertificationSettings(
  @Body() dto: CertificationSettingsDto,
  @CurrentUser() user: CurrentUserPayload,
): Promise<{ success: boolean; data: CertificationSettingsDto }> {
  const data = await this.systemSettingsService.updateCertificationSettings(dto, user.sub);
  return { success: true, data };
}

/** US-090: Get platform settings */
@Get('settings/platform')
@ApiOperation({ summary: 'US-090: Get platform settings (super-admin)' })
async getPlatformSettings(): Promise<{ success: boolean; data: PlatformSettingsDto }> {
  const data = await this.systemSettingsService.getPlatformSettings();
  return { success: true, data };
}

/** US-090: Update platform settings */
@Patch('settings/platform')
@ApiOperation({ summary: 'US-090: Update platform settings (super-admin)' })
async updatePlatformSettings(
  @Body() dto: PlatformSettingsDto,
  @CurrentUser() user: CurrentUserPayload,
): Promise<{ success: boolean; data: PlatformSettingsDto }> {
  const data = await this.systemSettingsService.updatePlatformSettings(dto, user.sub);
  return { success: true, data };
}
```

---

### Task 6 — AppModule: Wire SystemSetting Entity + SystemSettingsService

**File:** `src/app.module.ts`

In `TypeOrmModule.forFeature([AuditLog])` → change to `TypeOrmModule.forFeature([AuditLog, SystemSetting])`.

Add `SystemSetting` import: `import { SystemSetting } from './common/entities/system-setting.entity';`

Add `SystemSettingsService` to providers array alongside `DashboardService`:

```typescript
import { SystemSettingsService } from './common/services/system-settings.service';
// ...
providers: [
  KafkaAdminService,
  MinioService,
  DashboardService,
  AuditLogService,
  SystemSettingsService,
  { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
],
```

**Verification:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 3 — SystemSettingsService Unit Tests + US-050 CSV Export Logic

### Task 7 — Unit Tests: SystemSettingsService

**File:** `test/unit/common/system-settings.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { SystemSettingsService } from '../../../src/common/services/system-settings.service';
import { SystemSetting } from '../../../src/common/entities/system-setting.entity';

const makeRepo = () => ({
  find: jest.fn(),
  upsert: jest.fn(),
});

const makeCache = () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
});

describe('SystemSettingsService', () => {
  let service: SystemSettingsService;
  let repo: ReturnType<typeof makeRepo>;
  let cache: ReturnType<typeof makeCache>;

  beforeEach(async () => {
    repo = makeRepo();
    cache = makeCache();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemSettingsService,
        { provide: getRepositoryToken(SystemSetting), useValue: repo },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();
    service = module.get(SystemSettingsService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  it('getCampaignSettings returns cache hit without DB call', async () => {
    const cached = {
      currentCampaignYear: '2025-2026',
      campaignStartMonth: 10,
      campaignEndMonth: 9,
    };
    cache.get.mockResolvedValue(cached);
    const result = await service.getCampaignSettings();
    expect(result).toEqual(cached);
    expect(repo.find).not.toHaveBeenCalled();
  });

  it('getCampaignSettings reads DB on cache miss and applies defaults', async () => {
    repo.find.mockResolvedValue([
      { settingKey: 'current_campaign_year', settingValue: '2026-2027' },
      { settingKey: 'campaign_start_month', settingValue: '10' },
      { settingKey: 'campaign_end_month', settingValue: '9' },
    ]);
    const result = await service.getCampaignSettings();
    expect(result.currentCampaignYear).toBe('2026-2027');
    expect(cache.set).toHaveBeenCalledWith('settings:campaign', result, 300_000);
  });

  it('updateCampaignSettings upserts rows and invalidates cache', async () => {
    repo.find.mockResolvedValue([]);
    const dto = { currentCampaignYear: '2026-2027', campaignStartMonth: 10, campaignEndMonth: 9 };
    await service.updateCampaignSettings(dto, 'user-123');
    expect(repo.upsert).toHaveBeenCalled();
    expect(cache.del).toHaveBeenCalledWith('settings:campaign');
  });

  it('getPlatformSettings parses boolean correctly', async () => {
    repo.find.mockResolvedValue([
      { settingKey: 'maintenance_mode', settingValue: 'true' },
      { settingKey: 'support_email', settingValue: 'admin@terroir.ma' },
    ]);
    const result = await service.getPlatformSettings();
    expect(result.maintenanceMode).toBe(true);
    expect(result.supportEmail).toBe('admin@terroir.ma');
  });
});
```

---

### Task 8 — ComplianceExportQueryDto + CertificationService.exportComplianceReport()

**File:** `src/modules/certification/dto/compliance-export-query.dto.ts`

```typescript
import { IsOptional, IsDateString, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ComplianceExportQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ description: 'Filter by current_status' })
  @IsOptional()
  @IsString()
  status?: string;
}
```

**File:** `src/modules/certification/services/certification.service.ts` — add method:

```typescript
/**
 * US-050: Export certification compliance report as CSV string.
 * Columns: certificationNumber, cooperativeName, productTypeCode, regionCode,
 *          certificationType, currentStatus, validFrom, validUntil, grantedAt
 */
async exportComplianceReport(
  from?: string,
  to?: string,
  status?: string,
): Promise<string> {
  const qb = this.certRepo
    .createQueryBuilder('c')
    .select([
      'c.certification_number',
      'c.cooperative_name',
      'c.product_type_code',
      'c.region_code',
      'c.certification_type',
      'c.current_status',
      'c.valid_from',
      'c.valid_until',
      'c.granted_at',
    ])
    .orderBy('c.granted_at', 'DESC');

  if (from) qb.andWhere('c.created_at >= :from', { from });
  if (to) qb.andWhere('c.created_at <= :to', { to });
  if (status) qb.andWhere('c.current_status = :status', { status });

  const rows = await qb.getRawMany<{
    c_certification_number: string | null;
    c_cooperative_name: string;
    c_product_type_code: string;
    c_region_code: string;
    c_certification_type: string;
    c_current_status: string;
    c_valid_from: Date | null;
    c_valid_until: Date | null;
    c_granted_at: Date | null;
  }>();

  const header =
    'certificationNumber,cooperativeName,productTypeCode,regionCode,' +
    'certificationType,currentStatus,validFrom,validUntil,grantedAt';

  const csvRows = rows.map((r) =>
    [
      r.c_certification_number ?? '',
      `"${r.c_cooperative_name.replace(/"/g, '""')}"`,
      r.c_product_type_code,
      r.c_region_code,
      r.c_certification_type,
      r.c_current_status,
      r.c_valid_from ? r.c_valid_from.toISOString() : '',
      r.c_valid_until ? r.c_valid_until.toISOString() : '',
      r.c_granted_at ? r.c_granted_at.toISOString() : '',
    ].join(','),
  );

  return [header, ...csvRows].join('\n');
}
```

**Verification:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 4 — US-050 Controller + US-050 Tests + Migration 016

### Task 9 — CertificationController: GET /certifications/compliance-export

**File:** `src/modules/certification/controllers/certification.controller.ts`

Add import:

```typescript
import { ComplianceExportQueryDto } from '../dto/compliance-export-query.dto';
```

Add method **before** the first `@Get(':id')` route in the controller:

```typescript
/**
 * US-050: Export certification compliance report as CSV.
 * Registered before GET /:id to avoid NestJS param collision.
 */
@Get('compliance-export')
@UseGuards(RolesGuard)
@Roles('super-admin', 'certification-body')
@ApiOperation({ summary: 'US-050: Export certification compliance report (CSV)' })
@ApiQuery({ name: 'from', required: false, type: String })
@ApiQuery({ name: 'to', required: false, type: String })
@ApiQuery({ name: 'status', required: false, type: String })
async exportComplianceReport(
  @Query() query: ComplianceExportQueryDto,
  @Res({ passthrough: true }) res: Response,
): Promise<StreamableFile> {
  const csv = await this.certificationService.exportComplianceReport(
    query.from,
    query.to,
    query.status,
  );
  const date = new Date().toISOString().slice(0, 10);
  res.set({
    'Content-Type': 'text/csv',
    'Content-Disposition': `attachment; filename="compliance-${date}.csv"`,
  });
  const buffer = Buffer.from(csv, 'utf-8');
  return new StreamableFile(buffer);
}
```

---

### Task 10 — Unit Tests: exportComplianceReport

**File:** `test/unit/certification/certification.service.spec.ts` — add 2 tests to the existing suite:

```typescript
describe('exportComplianceReport()', () => {
  it('returns CSV with header and one data row', async () => {
    mockCertRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        {
          c_certification_number: 'TERROIR-IGP-MA-2025-0001',
          c_cooperative_name: 'Coop Test',
          c_product_type_code: 'ARGAN',
          c_region_code: 'SOUSS',
          c_certification_type: 'IGP',
          c_current_status: 'GRANTED',
          c_valid_from: new Date('2025-01-01'),
          c_valid_until: new Date('2026-01-01'),
          c_granted_at: new Date('2025-01-15'),
        },
      ]),
    });
    const csv = await service.exportComplianceReport();
    expect(csv).toContain('certificationNumber,cooperativeName');
    expect(csv).toContain('TERROIR-IGP-MA-2025-0001');
    expect(csv).toContain('"Coop Test"');
  });

  it('returns header-only CSV for empty result', async () => {
    mockCertRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    });
    const csv = await service.exportComplianceReport();
    const lines = csv.split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('certificationNumber');
  });
});
```

---

### Task 11 — Migration 016: AddNotificationPreference + NotificationPreference Entity

**File:** `src/database/migrations/1700000000016-AddNotificationPreference.ts`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationPreference1700000000016 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE notification.notification_preference (
        user_id    UUID         PRIMARY KEY,
        channels   TEXT[]       NOT NULL DEFAULT '{email}',
        language   VARCHAR(5)   NOT NULL DEFAULT 'fr',
        updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS notification.notification_preference;`);
  }
}
```

**File:** `src/modules/notification/entities/notification-preference.entity.ts`

```typescript
import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

/**
 * US-077: Per-user notification channel and language preferences.
 * Schema: notification. Keyed by Keycloak sub (userId).
 * GET returns defaults if no row exists — never 404.
 */
@Entity({ schema: 'notification', name: 'notification_preference' })
export class NotificationPreference {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'simple-array', default: 'email' })
  channels: string[];

  @Column({ type: 'varchar', length: 5, default: 'fr' })
  language: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
```

**Verification:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 5 — Notification Preferences DTOs + Service Methods + Controller Endpoints

### Task 12 — NotificationPreference DTOs

**File:** `src/modules/notification/dto/notification-preference.dto.ts`

```typescript
import { IsArray, IsIn, ArrayNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class NotificationPreferenceDto {
  @ApiProperty({ type: [String], enum: ['email', 'sms'], example: ['email'] })
  channels: string[];

  @ApiProperty({ enum: ['ar', 'fr', 'zgh'], example: 'fr' })
  language: string;
}

export class UpsertNotificationPreferenceDto {
  @ApiProperty({ type: [String], enum: ['email', 'sms'] })
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(['email', 'sms'], { each: true })
  channels: string[];

  @ApiProperty({ enum: ['ar', 'fr', 'zgh'] })
  @IsString()
  @IsIn(['ar', 'fr', 'zgh'])
  language: string;
}
```

---

### Task 13 — NotificationService: Add Preference Methods + Channel Filter in send()

**File:** `src/modules/notification/services/notification.service.ts`

Add import at top:

```typescript
import { NotificationPreference } from '../entities/notification-preference.entity';
import { UpsertNotificationPreferenceDto } from '../dto/notification-preference.dto';
```

Add `@InjectRepository(NotificationPreference)` to constructor:

```typescript
@InjectRepository(NotificationPreference)
private readonly preferenceRepo: Repository<NotificationPreference>,
```

Add 2 new methods:

```typescript
/**
 * US-077: Get notification preferences for a user.
 * Returns in-memory defaults if no row exists — never throws.
 */
async getPreferences(userId: string): Promise<{ channels: string[]; language: string }> {
  const cacheKey = `pref:${userId}`;
  const cached = await this.cacheManager.get<{ channels: string[]; language: string }>(cacheKey);
  if (cached) return cached;

  const row = await this.preferenceRepo.findOne({ where: { userId } });
  const result = row
    ? { channels: row.channels, language: row.language }
    : { channels: ['email'], language: 'fr' };

  await this.cacheManager.set(cacheKey, result, 300_000);
  return result;
}

/**
 * US-077: Upsert notification preferences for a user.
 * Invalidates the Redis cache on update.
 */
async upsertPreferences(
  userId: string,
  dto: UpsertNotificationPreferenceDto,
): Promise<{ channels: string[]; language: string }> {
  await this.preferenceRepo.upsert(
    { userId, channels: dto.channels, language: dto.language },
    { conflictPaths: ['userId'] },
  );
  await this.cacheManager.del(`pref:${userId}`);
  return { channels: dto.channels, language: dto.language };
}
```

Modify `send()` — add preference check **before** the template lookup (after `const language = ...`):

```typescript
// US-077: Skip if channel not in user's preferences
const prefs = await this.getPreferences(opts.recipientId);
if (!prefs.channels.includes(opts.channel)) {
  this.logger.debug(
    { recipientId: opts.recipientId, channel: opts.channel },
    'Notification skipped — channel not in user preferences',
  );
  return;
}
```

---

### Task 14 — NotificationController: GET/PUT /notifications/preferences/me + NotificationModule Wiring

**File:** `src/modules/notification/controllers/notification.controller.ts` — add 2 new endpoints before `@Get(':id')`:

Add imports:

```typescript
import { Put, Body } from '@nestjs/common';
import {
  NotificationPreferenceDto,
  UpsertNotificationPreferenceDto,
} from '../dto/notification-preference.dto';
```

Add endpoints (before `@Get(':id')`):

```typescript
/** US-077: Get notification preferences for current user */
@Get('preferences/me')
@ApiOperation({ summary: 'US-077: Get notification preferences for current user' })
async getPreferences(
  @CurrentUser() user: CurrentUserPayload,
): Promise<{ success: boolean; data: NotificationPreferenceDto }> {
  const data = await this.notificationService.getPreferences(user.sub);
  return { success: true, data };
}

/** US-077: Update notification preferences for current user */
@Put('preferences/me')
@ApiOperation({ summary: 'US-077: Update notification preferences for current user' })
async updatePreferences(
  @Body() dto: UpsertNotificationPreferenceDto,
  @CurrentUser() user: CurrentUserPayload,
): Promise<{ success: boolean; data: NotificationPreferenceDto }> {
  const data = await this.notificationService.upsertPreferences(user.sub, dto);
  return { success: true, data };
}
```

**File:** `src/modules/notification/notification.module.ts` — register `NotificationPreference` entity:

```typescript
import { NotificationPreference } from './entities/notification-preference.entity';
// In imports array:
TypeOrmModule.forFeature([Notification, NotificationTemplate, NotificationPreference]),
```

**Verification:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 6 — US-077 Tests + US-020 Product Export

### Task 15 — Unit Tests: Notification Preferences

**File:** `test/unit/notification/notification.service.spec.ts` — add 3 tests:

```typescript
// Add mockPrefRepo to the test setup:
const mockPrefRepo = {
  findOne: jest.fn(),
  upsert: jest.fn(),
};
// Add to providers: { provide: getRepositoryToken(NotificationPreference), useValue: mockPrefRepo }
// Add to imports in TestingModule: NotificationPreference

describe('getPreferences()', () => {
  it('returns defaults when no row exists', async () => {
    mockPrefRepo.findOne.mockResolvedValue(null);
    const result = await service.getPreferences('user-123');
    expect(result).toEqual({ channels: ['email'], language: 'fr' });
  });

  it('returns stored preferences when row exists', async () => {
    mockPrefRepo.findOne.mockResolvedValue({ channels: ['email', 'sms'], language: 'ar' });
    const result = await service.getPreferences('user-456');
    expect(result.channels).toContain('sms');
    expect(result.language).toBe('ar');
  });
});

describe('upsertPreferences()', () => {
  it('calls upsert and invalidates cache', async () => {
    mockPrefRepo.upsert.mockResolvedValue(undefined);
    const result = await service.upsertPreferences('user-789', {
      channels: ['sms'],
      language: 'zgh',
    });
    expect(mockPrefRepo.upsert).toHaveBeenCalled();
    expect(result.language).toBe('zgh');
  });
});

describe('send() channel filter', () => {
  it('skips sending when channel not in user preferences', async () => {
    mockPrefRepo.findOne.mockResolvedValue({ channels: ['email'], language: 'fr' });
    // send() with channel 'sms' should return early
    await service.send({
      recipientId: 'user-pref-test',
      channel: 'sms' as any,
      templateCode: 'test',
      context: {},
    });
    // notificationRepo.save should NOT be called
    expect(mockNotificationRepo.save).not.toHaveBeenCalled();
  });
});
```

---

### Task 16 — ProductExportQueryDto + ProductService.exportProductRegistry()

**File:** `src/modules/product/dto/product-export-query.dto.ts`

```typescript
import { IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ProductExportQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;
}
```

**File:** `src/modules/product/services/product.service.ts` — add method:

```typescript
/**
 * US-020: Export product registry as CSV string.
 * Columns: productId, name, productTypeCode, cooperativeId, regionCode, status, registeredAt
 */
async exportProductRegistry(from?: string, to?: string): Promise<string> {
  const qb = this.productRepo
    .createQueryBuilder('p')
    .select([
      'p.id',
      'p.name',
      'p.product_type_code',
      'p.cooperative_id',
      'p.region_code',
      'p.status',
      'p.created_at',
    ])
    .where('p.deleted_at IS NULL')
    .orderBy('p.created_at', 'DESC');

  if (from) qb.andWhere('p.created_at >= :from', { from });
  if (to) qb.andWhere('p.created_at <= :to', { to });

  const rows = await qb.getRawMany<{
    p_id: string;
    p_name: string;
    p_product_type_code: string;
    p_cooperative_id: string;
    p_region_code: string | null;
    p_status: string | null;
    p_created_at: Date;
  }>();

  const header = 'productId,name,productTypeCode,cooperativeId,regionCode,status,registeredAt';

  const csvRows = rows.map((r) =>
    [
      r.p_id,
      `"${r.p_name.replace(/"/g, '""')}"`,
      r.p_product_type_code,
      r.p_cooperative_id,
      r.p_region_code ?? '',
      r.p_status ?? '',
      r.p_created_at.toISOString(),
    ].join(','),
  );

  return [header, ...csvRows].join('\n');
}
```

**Verification:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 7 — US-020 Controller + Tests + US-070 Export Service

### Task 17 — ProductController: GET /products/export + Unit Tests

**File:** `src/modules/product/controllers/product.controller.ts` — add endpoint **before** any `@Get(':id')` routes.

Add imports:

```typescript
import { Res, StreamableFile } from '@nestjs/common';
import { Response } from 'express';
import { ProductExportQueryDto } from '../dto/product-export-query.dto';
```

Add endpoint:

```typescript
/**
 * US-020: Export product registry as CSV.
 * Registered before GET /:id to avoid NestJS param collision.
 */
@Get('export')
@UseGuards(RolesGuard)
@Roles('super-admin')
@ApiOperation({ summary: 'US-020: Export product registry as CSV (super-admin)' })
@ApiQuery({ name: 'from', required: false, type: String })
@ApiQuery({ name: 'to', required: false, type: String })
async exportProductRegistry(
  @Query() query: ProductExportQueryDto,
  @Res({ passthrough: true }) res: Response,
): Promise<StreamableFile> {
  const csv = await this.productService.exportProductRegistry(query.from, query.to);
  const date = new Date().toISOString().slice(0, 10);
  res.set({
    'Content-Type': 'text/csv',
    'Content-Disposition': `attachment; filename="products-${date}.csv"`,
  });
  return new StreamableFile(Buffer.from(csv, 'utf-8'));
}
```

**File:** `test/unit/product/product.service.spec.ts` — add 2 tests:

```typescript
describe('exportProductRegistry()', () => {
  it('returns CSV with header and one row', async () => {
    mockProductRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        {
          p_id: 'uuid-1',
          p_name: "Huile d'Argan",
          p_product_type_code: 'ARGAN',
          p_cooperative_id: 'coop-uuid',
          p_region_code: 'SOUSS',
          p_status: 'active',
          p_created_at: new Date('2025-03-01'),
        },
      ]),
    });
    const csv = await service.exportProductRegistry();
    expect(csv).toContain('productId,name,productTypeCode');
    expect(csv).toContain('uuid-1');
  });

  it('returns header-only for empty result', async () => {
    mockProductRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    });
    const csv = await service.exportProductRegistry();
    expect(csv.split('\n')).toHaveLength(1);
  });
});
```

---

### Task 18 — ClearancesReportQueryDto + ExportDocumentService.exportClearancesReport()

**File:** `src/modules/certification/dto/clearances-report-query.dto.ts`

```typescript
import { IsOptional, IsDateString, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ClearancesReportQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ description: 'ISO 3166-1 alpha-2 destination country code' })
  @IsOptional()
  @IsString()
  destinationCountry?: string;
}
```

**File:** `src/modules/certification/services/export-document.service.ts` — add method:

```typescript
/**
 * US-070: Export clearances report as CSV string.
 * Columns: exportDocId, cooperativeName, productTypeCode, destinationCountry, hsCode, clearedAt, status
 * Joins ExportDocument with Certification (same schema — intra-module safe).
 */
async exportClearancesReport(
  from?: string,
  to?: string,
  destinationCountry?: string,
): Promise<string> {
  const qb = this.exportDocRepo
    .createQueryBuilder('ed')
    .leftJoin(
      'certification.certification',
      'c',
      'c.id = ed.certification_id',
    )
    .select([
      'ed.id',
      'c.cooperative_name',
      'c.product_type_code',
      'ed.destination_country',
      'ed.hs_code',
      'ed.updated_at',
      'ed.status',
    ])
    .orderBy('ed.updated_at', 'DESC');

  if (from) qb.andWhere('ed.updated_at >= :from', { from });
  if (to) qb.andWhere('ed.updated_at <= :to', { to });
  if (destinationCountry)
    qb.andWhere('ed.destination_country = :destinationCountry', { destinationCountry });

  const rows = await qb.getRawMany<{
    ed_id: string;
    c_cooperative_name: string | null;
    c_product_type_code: string | null;
    ed_destination_country: string;
    ed_hs_code: string | null;
    ed_updated_at: Date;
    ed_status: string;
  }>();

  const header =
    'exportDocId,cooperativeName,productTypeCode,destinationCountry,hsCode,clearedAt,status';

  const csvRows = rows.map((r) =>
    [
      r.ed_id,
      `"${(r.c_cooperative_name ?? '').replace(/"/g, '""')}"`,
      r.c_product_type_code ?? '',
      r.ed_destination_country,
      r.ed_hs_code ?? '',
      r.ed_updated_at.toISOString(),
      r.ed_status,
    ].join(','),
  );

  return [header, ...csvRows].join('\n');
}
```

**Verification:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 8 — US-070 Controller + Tests + US-069 HS Codes Service

### Task 19 — ExportDocumentController: GET /export-documents/clearances-report

**File:** `src/modules/certification/controllers/export-document.controller.ts` — add endpoint **before** `@Get(':id')`.

Add imports:

```typescript
import { ClearancesReportQueryDto } from '../dto/clearances-report-query.dto';
```

Add endpoint before `@Get(':id')`:

```typescript
/**
 * US-070: Export clearances by destination as CSV.
 * Registered before GET /:id — literal segment, no collision.
 */
@Get('clearances-report')
@UseGuards(RolesGuard)
@Roles('super-admin', 'customs-agent')
@ApiOperation({ summary: 'US-070: Export clearances by destination country (CSV)' })
@ApiQuery({ name: 'from', required: false, type: String })
@ApiQuery({ name: 'to', required: false, type: String })
@ApiQuery({ name: 'destinationCountry', required: false, type: String })
async exportClearancesReport(
  @Query() query: ClearancesReportQueryDto,
  @Res({ passthrough: true }) res: Response,
): Promise<StreamableFile> {
  const csv = await this.exportDocumentService.exportClearancesReport(
    query.from,
    query.to,
    query.destinationCountry,
  );
  const date = new Date().toISOString().slice(0, 10);
  res.set({
    'Content-Type': 'text/csv',
    'Content-Disposition': `attachment; filename="clearances-${date}.csv"`,
  });
  return new StreamableFile(Buffer.from(csv, 'utf-8'));
}
```

---

### Task 20 — HsCodeQueryDto + ExportDocumentService.getHsCodeAssignments()

**File:** `src/modules/certification/dto/hs-code-query.dto.ts`

```typescript
import { IsOptional, IsUUID, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class HsCodeQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by cooperative UUID (cooperative-admin auto-scoped from JWT)',
  })
  @IsOptional()
  @IsUUID()
  cooperativeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;
}
```

**File:** `src/modules/certification/services/export-document.service.ts` — add method:

```typescript
/**
 * US-069: List HS code assignments with optional cooperative scoping.
 * cooperative-admin: scoped to their cooperative (cooperativeId from JWT).
 * customs-agent / super-admin: can query all or by cooperativeId param.
 */
async getHsCodeAssignments(
  cooperativeId?: string,
  from?: string,
  to?: string,
): Promise<Array<{
  exportDocId: string;
  certificationId: string;
  productTypeCode: string | null;
  hsCode: string | null;
  destinationCountry: string;
  assignedAt: string;
}>> {
  const qb = this.exportDocRepo
    .createQueryBuilder('ed')
    .leftJoin('certification.certification', 'c', 'c.id = ed.certification_id')
    .select([
      'ed.id',
      'ed.certification_id',
      'c.product_type_code',
      'ed.hs_code',
      'ed.destination_country',
      'ed.created_at',
    ])
    .orderBy('ed.created_at', 'DESC');

  if (cooperativeId) qb.andWhere('ed.cooperative_id = :cooperativeId', { cooperativeId });
  if (from) qb.andWhere('ed.created_at >= :from', { from });
  if (to) qb.andWhere('ed.created_at <= :to', { to });

  const rows = await qb.getRawMany<{
    ed_id: string;
    ed_certification_id: string;
    c_product_type_code: string | null;
    ed_hs_code: string | null;
    ed_destination_country: string;
    ed_created_at: Date;
  }>();

  return rows.map((r) => ({
    exportDocId: r.ed_id,
    certificationId: r.ed_certification_id,
    productTypeCode: r.c_product_type_code,
    hsCode: r.ed_hs_code,
    destinationCountry: r.ed_destination_country,
    assignedAt: r.ed_created_at.toISOString(),
  }));
}
```

**Verification:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 9 — US-069 Controller + All CSV Tests

### Task 21 — ExportDocumentController: GET /export-documents/hs-codes

**File:** `src/modules/certification/controllers/export-document.controller.ts`

Add imports:

```typescript
import { HsCodeQueryDto } from '../dto/hs-code-query.dto';
```

Add endpoint **before** `@Get(':id')` (after clearances-report):

```typescript
/**
 * US-069: View HS code assignments.
 * cooperative-admin: auto-scoped to JWT cooperativeId.
 * customs-agent / super-admin: optional cooperativeId filter.
 * Registered before GET /:id.
 */
@Get('hs-codes')
@UseGuards(RolesGuard)
@Roles('cooperative-admin', 'customs-agent', 'super-admin')
@ApiOperation({ summary: 'US-069: List HS code assignments' })
@ApiQuery({ name: 'cooperativeId', required: false, type: String })
@ApiQuery({ name: 'from', required: false, type: String })
@ApiQuery({ name: 'to', required: false, type: String })
async getHsCodeAssignments(
  @Query() query: HsCodeQueryDto,
  @CurrentUser() user: CurrentUserPayload,
): Promise<{ success: boolean; data: unknown[] }> {
  // cooperative-admin is always scoped to their own cooperative
  const roles: string[] = (user.realm_access?.roles ?? []) as string[];
  const cooperativeId =
    roles.includes('cooperative-admin')
      ? (user.cooperative_id ?? user.sub)
      : query.cooperativeId;

  const data = await this.exportDocumentService.getHsCodeAssignments(
    cooperativeId,
    query.from,
    query.to,
  );
  return { success: true, data };
}
```

---

### Task 22 — Unit Tests: US-070 + US-069

**File:** `test/unit/certification/export-document.service.spec.ts` — add tests:

```typescript
describe('exportClearancesReport()', () => {
  it('returns CSV with header and one data row', async () => {
    mockExportDocRepo.createQueryBuilder.mockReturnValue({
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        {
          ed_id: 'doc-1',
          c_cooperative_name: 'Coop Argan',
          c_product_type_code: 'ARGAN',
          ed_destination_country: 'FR',
          ed_hs_code: '1515.30',
          ed_updated_at: new Date('2025-06-01'),
          ed_status: 'cleared',
        },
      ]),
    });
    const csv = await service.exportClearancesReport();
    expect(csv).toContain('exportDocId,cooperativeName');
    expect(csv).toContain('doc-1');
    expect(csv).toContain('"Coop Argan"');
  });

  it('returns header-only CSV for empty result', async () => {
    mockExportDocRepo.createQueryBuilder.mockReturnValue({
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    });
    const csv = await service.exportClearancesReport();
    expect(csv.split('\n')).toHaveLength(1);
  });
});

describe('getHsCodeAssignments()', () => {
  it('returns mapped HS code rows', async () => {
    mockExportDocRepo.createQueryBuilder.mockReturnValue({
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        {
          ed_id: 'doc-2',
          ed_certification_id: 'cert-1',
          c_product_type_code: 'ARGAN',
          ed_hs_code: '1515.30',
          ed_destination_country: 'DE',
          ed_created_at: new Date('2025-07-01'),
        },
      ]),
    });
    const result = await service.getHsCodeAssignments('coop-uuid');
    expect(result).toHaveLength(1);
    expect(result[0]!.hsCode).toBe('1515.30');
    expect(result[0]!.destinationCountry).toBe('DE');
  });

  it('applies cooperativeId filter', async () => {
    const qb = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    mockExportDocRepo.createQueryBuilder.mockReturnValue(qb);
    await service.getHsCodeAssignments('coop-scoped');
    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('cooperative_id'),
      expect.objectContaining({ cooperativeId: 'coop-scoped' }),
    );
  });
});
```

**Verification:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Testing Tasks Summary

| Test File                                                 | Service Under Test                              | Test Count |
| --------------------------------------------------------- | ----------------------------------------------- | ---------- |
| `test/unit/common/system-settings.service.spec.ts`        | SystemSettingsService                           | 4          |
| `test/unit/certification/certification.service.spec.ts`   | exportComplianceReport                          | +2         |
| `test/unit/notification/notification.service.spec.ts`     | getPreferences, upsertPreferences, channel skip | +3         |
| `test/unit/product/product.service.spec.ts`               | exportProductRegistry                           | +2         |
| `test/unit/certification/export-document.service.spec.ts` | exportClearancesReport, getHsCodeAssignments    | +4         |

**Expected final test count:** 357 + 4 + 2 + 3 + 2 + 4 = **~372 tests** (plus any incidental new controller tests)

---

## Post-Sprint Checklist

- [ ] `npm run migration:run` — apply migrations 015 + 016 after `docker compose up`
- [ ] Verify `GET /admin/settings/campaign` returns `{ currentCampaignYear: '2025-2026', ... }`
- [ ] Verify `GET /certifications/compliance-export` returns `Content-Type: text/csv`
- [ ] Verify `GET /notifications/preferences/me` returns defaults for new user (no row)
- [ ] Verify `GET /products/export` returns CSV with correct header
- [ ] Verify `GET /export-documents/hs-codes` cooperative-admin scoping via JWT claim
- [ ] Verify route ordering: all literal routes appear before `/:id` in each controller
