# Sprint 10 — Admin Dashboard, Analytics & Audit — Implementation Plan

> **For Claude:** Use /execute to implement this plan task-by-task.

**Goal:** Deliver US-081 (admin dashboard counts), US-082 (certification analytics by region/product), US-085 (HTTP audit interceptor + log viewer), and US-088 (notification delivery rates) — 24 SP, 0 cross-module service imports.

**Architecture:**

- `DashboardService` in `src/common/` — raw SQL via `DataSource`, queries all 4 schemas
- `AuditInterceptor` (global `APP_INTERCEPTOR`) + `AuditLogService` in `src/common/` — append-only `common.audit_log` table
- `CertificationService.getAnalytics()` — two GROUP BY raw SQL queries, Redis 300s cache
- `NotificationService.getStats()` extended — adds `byChannel` with `deliveryRate` %

**Tech Stack:** NestJS, TypeScript, PostgreSQL + PostGIS, Redpanda, Keycloak, Redis
**Modules Affected:** common (new services + entity + interceptor), certification (new method + route), notification (stats extension)
**Estimated Story Points:** 24

---

## Batch 1 — US-085 Part 1: AuditLog Entity + Migration

### Task 1.1 — Create `AuditLog` entity

**File to create:** `src/common/entities/audit-log.entity.ts`

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * US-085: Append-only audit trail of authenticated HTTP requests.
 * Schema: common. No updatedAt — immutable once written.
 */
@Entity({ schema: 'common', name: 'audit_log' })
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId: string;

  @Column({ name: 'user_email', type: 'varchar', length: 255, nullable: true })
  userEmail: string | null;

  @Column({ name: 'user_role', type: 'varchar', length: 100 })
  userRole: string;

  @Column({ type: 'varchar', length: 10 })
  method: string;

  @Column({ type: 'varchar', length: 500 })
  path: string;

  @Column({ name: 'status_code', type: 'int' })
  statusCode: number;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip: string | null;

  @Index()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
```

**Verification:** `npm run typecheck`

---

### Task 1.2 — Create migration `1700000000014-AddAuditLog`

**File to create:** `src/database/migrations/1700000000014-AddAuditLog.ts`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuditLog1700000000014 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS common`);
    await queryRunner.query(`
      CREATE TABLE common.audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(36) NOT NULL,
        user_email VARCHAR(255),
        user_role VARCHAR(100) NOT NULL,
        method VARCHAR(10) NOT NULL,
        path VARCHAR(500) NOT NULL,
        status_code INT NOT NULL,
        ip VARCHAR(45),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_audit_log_user_id ON common.audit_log (user_id)`);
    await queryRunner.query(
      `CREATE INDEX idx_audit_log_created_at ON common.audit_log (created_at)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS common.audit_log`);
  }
}
```

**Verification:** `npm run typecheck`

---

## Batch 2 — US-085 Part 2: AuditInterceptor + AuditLogService + AdminController routes

### Task 2.1 — Create `AuditLogQueryDto`

**File to create:** `src/common/dto/audit-log-query.dto.ts`

```typescript
import { IsOptional, IsUUID, IsDateString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AuditLogQueryDto {
  @ApiPropertyOptional({ description: 'Filter by userId (UUID)' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: 'Start date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'End date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
```

**Verification:** `npm run typecheck`

---

### Task 2.2 — Create `AuditLogService`

**File to create:** `src/common/services/audit-log.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { AuditLogQueryDto } from '../dto/audit-log-query.dto';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  /**
   * Fire-and-forget write — never throws (logs error silently).
   * Called from AuditInterceptor; must not block the response.
   */
  async record(entry: Omit<AuditLog, 'id' | 'createdAt'>): Promise<void> {
    try {
      const log = this.auditRepo.create(entry);
      await this.auditRepo.save(log);
    } catch {
      // Silent — audit failure must never affect the request
    }
  }

  /**
   * US-085: Paginated audit log query for super-admin.
   */
  async findAll(
    query: AuditLogQueryDto,
  ): Promise<{ data: AuditLog[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.auditRepo
      .createQueryBuilder('a')
      .orderBy('a.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.userId) qb.andWhere('a.userId = :userId', { userId: query.userId });
    if (query.from) qb.andWhere('a.createdAt >= :from', { from: query.from });
    if (query.to) qb.andWhere('a.createdAt <= :to', { to: query.to });

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }
}
```

**Verification:** `npm run typecheck`

---

### Task 2.3 — Create `AuditInterceptor`

**File to create:** `src/common/interceptors/audit.interceptor.ts`

```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { AuditLogService } from '../services/audit-log.service';

interface JwtUser {
  sub?: string;
  email?: string;
  realm_access?: { roles?: string[] };
}

/**
 * US-085: Globally registers one audit_log row per authenticated HTTP request.
 * Skips requests with no req.user (public endpoints, health checks, QR verify).
 * Fire-and-forget — never blocks the response path.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { user?: JwtUser }>();
    const res = context.switchToHttp().getResponse<Response>();

    if (!req.user) return next.handle();

    const userId = req.user.sub ?? 'unknown';
    const userEmail = req.user.email ?? null;
    const userRole = req.user.realm_access?.roles?.[0] ?? 'unknown';
    const method = req.method;
    const path = req.path;
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
      req.socket.remoteAddress ??
      null;

    return next.handle().pipe(
      tap(() => {
        const statusCode = res.statusCode;
        void this.auditLogService.record({
          userId,
          userEmail,
          userRole,
          method,
          path,
          statusCode,
          ip,
        });
      }),
    );
  }
}
```

**Verification:** `npm run typecheck`

---

### Task 2.4 — Update `AdminController` — add `GET /admin/audit-logs`

**File to modify:** `src/common/controllers/admin.controller.ts`

Add `AuditLogService` constructor injection and new route. Updated full file:

```typescript
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { KafkaAdminService, DlqTopicStats } from '../services/kafka-admin.service';
import { DashboardService } from '../services/dashboard.service';
import { AuditLogService } from '../services/audit-log.service';
import { AuditLogQueryDto } from '../dto/audit-log-query.dto';
import { AuditLog } from '../entities/audit-log.entity';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super-admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly kafkaAdminService: KafkaAdminService,
    private readonly dashboardService: DashboardService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /** US-087 */
  @Get('kafka/dlq-stats')
  @ApiOperation({ summary: 'US-087: Kafka DLQ topic message counts (super-admin)' })
  async getDlqStats(): Promise<{ success: boolean; data: DlqTopicStats[] }> {
    const data = await this.kafkaAdminService.getDlqStats();
    return { success: true, data };
  }

  /** US-081 */
  @Get('dashboard')
  @ApiOperation({ summary: 'US-081: Platform metrics dashboard (super-admin)' })
  async getDashboard(): Promise<{ success: boolean; data: unknown }> {
    const data = await this.dashboardService.getDashboard();
    return { success: true, data };
  }

  /** US-085 */
  @Get('audit-logs')
  @ApiOperation({ summary: 'US-085: Paginated user activity audit log (super-admin)' })
  async getAuditLogs(@Query() query: AuditLogQueryDto): Promise<{
    success: boolean;
    data: AuditLog[];
    meta: { page: number; limit: number; total: number };
  }> {
    const { data, total, page, limit } = await this.auditLogService.findAll(query);
    return { success: true, data, meta: { page, limit, total } };
  }
}
```

**Verification:** `npm run typecheck`

---

### Task 2.5 — Update `AppModule` — register AuditLog entity + services + interceptor

**File to modify:** `src/app.module.ts`

Add these imports at the top:

```typescript
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm'; // already imported — add to forFeature
import { AuditLog } from './common/entities/audit-log.entity';
import { AuditLogService } from './common/services/audit-log.service';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { DashboardService } from './common/services/dashboard.service';
```

In `imports[]` array, add after `KafkaClientModule`:

```typescript
TypeOrmModule.forFeature([AuditLog]),
```

In `providers[]` array, replace:

```typescript
providers: [KafkaAdminService, MinioService],
```

with:

```typescript
providers: [
  KafkaAdminService,
  MinioService,
  DashboardService,
  AuditLogService,
  { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
],
```

**Verification:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 3 — US-081: DashboardService

### Task 3.1 — Create `DashboardMetrics` interface

**File to create:** `src/common/interfaces/dashboard.interface.ts`

```typescript
export interface CooperativeMetrics {
  total: number;
  verified: number;
  pending: number;
  suspended: number;
}

export interface ProductMetrics {
  total: number;
}

export interface CertificationMetrics {
  total: number;
  granted: number;
  pending: number;
  denied: number;
  revoked: number;
}

export interface LabTestMetrics {
  total: number;
  passed: number;
  failed: number;
}

export interface NotificationMetrics {
  total: number;
  sent: number;
  failed: number;
}

export interface DashboardMetrics {
  cooperatives: CooperativeMetrics;
  products: ProductMetrics;
  certifications: CertificationMetrics;
  labTests: LabTestMetrics;
  notifications: NotificationMetrics;
  generatedAt: string;
}
```

**Verification:** `npm run typecheck`

---

### Task 3.2 — Create `DashboardService`

**File to create:** `src/common/services/dashboard.service.ts`

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { DashboardMetrics } from '../interfaces/dashboard.interface';

const CACHE_KEY = 'dashboard:admin';
const CACHE_TTL_MS = 300_000;

/**
 * US-081: Aggregates platform-wide counts for the super-admin dashboard.
 * Uses raw SQL via DataSource — no cross-module service imports.
 * Redis-cached for 300s.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async getDashboard(): Promise<DashboardMetrics> {
    const cached = await this.cacheManager.get<DashboardMetrics>(CACHE_KEY);
    if (cached) return cached;

    const [coopRows, productRows, certRows, labRows, notifRows] = await Promise.all([
      this.dataSource.query<Array<Record<string, string>>>(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'VERIFIED') AS verified,
          COUNT(*) FILTER (WHERE status = 'PENDING') AS pending,
          COUNT(*) FILTER (WHERE status = 'SUSPENDED') AS suspended
        FROM cooperative.cooperative
      `),
      this.dataSource.query<Array<Record<string, string>>>(`
        SELECT COUNT(*) AS total FROM product.product
      `),
      this.dataSource.query<Array<Record<string, string>>>(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE current_status = 'GRANTED') AS granted,
          COUNT(*) FILTER (WHERE current_status = 'PENDING') AS pending,
          COUNT(*) FILTER (WHERE current_status = 'DENIED') AS denied,
          COUNT(*) FILTER (WHERE current_status = 'REVOKED') AS revoked
        FROM certification.certification
      `),
      this.dataSource.query<Array<Record<string, string>>>(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'PASSED') AS passed,
          COUNT(*) FILTER (WHERE status = 'FAILED') AS failed
        FROM product.lab_test
      `),
      this.dataSource.query<Array<Record<string, string>>>(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'sent') AS sent,
          COUNT(*) FILTER (WHERE status = 'failed') AS failed
        FROM notification.notification
      `),
    ]);

    const n = (v: string | undefined) => Number(v ?? 0);
    const coop = coopRows[0]!;
    const prod = productRows[0]!;
    const cert = certRows[0]!;
    const lab = labRows[0]!;
    const notif = notifRows[0]!;

    const result: DashboardMetrics = {
      cooperatives: {
        total: n(coop['total']),
        verified: n(coop['verified']),
        pending: n(coop['pending']),
        suspended: n(coop['suspended']),
      },
      products: { total: n(prod['total']) },
      certifications: {
        total: n(cert['total']),
        granted: n(cert['granted']),
        pending: n(cert['pending']),
        denied: n(cert['denied']),
        revoked: n(cert['revoked']),
      },
      labTests: {
        total: n(lab['total']),
        passed: n(lab['passed']),
        failed: n(lab['failed']),
      },
      notifications: {
        total: n(notif['total']),
        sent: n(notif['sent']),
        failed: n(notif['failed']),
      },
      generatedAt: new Date().toISOString(),
    };

    await this.cacheManager.set(CACHE_KEY, result, CACHE_TTL_MS);
    return result;
  }
}
```

**Verification:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 4 — US-082: Certification Analytics

### Task 4.1 — Extend `certification-stats.interface.ts`

**File to modify:** `src/modules/certification/interfaces/certification-stats.interface.ts`

Append to end of file:

```typescript
/** US-082: Analytics breakdown by region. */
export interface RegionAnalyticsRow {
  region: string;
  granted: number;
  denied: number;
  revoked: number;
  total: number;
}

/** US-082: Analytics breakdown by product type. */
export interface ProductTypeAnalyticsRow {
  productType: string;
  granted: number;
  denied: number;
  revoked: number;
  total: number;
}

/** US-082: Full analytics response. */
export interface CertificationAnalytics {
  period: { from: string | null; to: string | null };
  byRegion: RegionAnalyticsRow[];
  byProductType: ProductTypeAnalyticsRow[];
  generatedAt: string;
}
```

**Verification:** `npm run typecheck`

---

### Task 4.2 — Add `getAnalytics()` to `CertificationService`

**File to modify:** `src/modules/certification/services/certification.service.ts`

Add import at top (add to existing interface imports):

```typescript
import {
  CertificationStats,
  CooperativeComplianceRow,
  OnssaCertRow,
  CertificationAnalytics,
} from '../interfaces/certification-stats.interface';
```

Add method before the closing `}` of the class (after existing `onssaReport()`):

```typescript
/**
 * US-082: Returns certification counts grouped by region and product type.
 * Supports optional date range. Redis-cached for 300s.
 */
async getAnalytics(from?: string, to?: string): Promise<CertificationAnalytics> {
  const cacheKey = `analytics:certifications:${from ?? 'all'}:${to ?? 'all'}`;
  const cached = await this.cacheManager.get<CertificationAnalytics>(cacheKey);
  if (cached) return cached;

  const params: Record<string, string> = {};
  const dateFilter = `
    ${from ? "AND created_at >= :from" : ""}
    ${to ? "AND created_at <= :to" : ""}
  `;
  if (from) params['from'] = from;
  if (to) params['to'] = to;

  const [regionRows, productRows] = await Promise.all([
    this.dataSource.query<Array<Record<string, string>>>(`
      SELECT
        region,
        COUNT(*) FILTER (WHERE current_status = 'GRANTED') AS granted,
        COUNT(*) FILTER (WHERE current_status = 'DENIED') AS denied,
        COUNT(*) FILTER (WHERE current_status = 'REVOKED') AS revoked,
        COUNT(*) AS total
      FROM certification.certification
      WHERE 1=1 ${dateFilter}
      GROUP BY region
      ORDER BY total DESC
    `, Object.values(params).length ? params : undefined),
    this.dataSource.query<Array<Record<string, string>>>(`
      SELECT
        product_type_code AS product_type,
        COUNT(*) FILTER (WHERE current_status = 'GRANTED') AS granted,
        COUNT(*) FILTER (WHERE current_status = 'DENIED') AS denied,
        COUNT(*) FILTER (WHERE current_status = 'REVOKED') AS revoked,
        COUNT(*) AS total
      FROM certification.certification
      WHERE 1=1 ${dateFilter}
      GROUP BY product_type_code
      ORDER BY total DESC
    `, Object.values(params).length ? params : undefined),
  ]);

  const n = (v: string | undefined) => Number(v ?? 0);

  const result: CertificationAnalytics = {
    period: { from: from ?? null, to: to ?? null },
    byRegion: regionRows.map(r => ({
      region: r['region'] ?? '',
      granted: n(r['granted']),
      denied: n(r['denied']),
      revoked: n(r['revoked']),
      total: n(r['total']),
    })),
    byProductType: productRows.map(r => ({
      productType: r['product_type'] ?? '',
      granted: n(r['granted']),
      denied: n(r['denied']),
      revoked: n(r['revoked']),
      total: n(r['total']),
    })),
    generatedAt: new Date().toISOString(),
  };

  await this.cacheManager.set(cacheKey, result, 300_000);
  return result;
}
```

**Verification:** `npm run typecheck`

---

### Task 4.3 — Add `GET /certifications/analytics` to `CertificationController`

**File to modify:** `src/modules/certification/controllers/certification.controller.ts`

Add import:

```typescript
import { CertificationAnalytics } from '../interfaces/certification-stats.interface';
```

Add route **before** `GET /:id` (after existing `/onssa-report` route):

```typescript
/** US-082: Certification analytics by region and product type. */
@Get('analytics')
@Roles('super-admin', 'certification-body')
@ApiOperation({ summary: 'US-082: Certification analytics by region/product type' })
async getAnalytics(
  @Query() query: ReportQueryDto,
): Promise<{ success: boolean; data: CertificationAnalytics }> {
  const data = await this.certificationService.getAnalytics(query.from, query.to);
  return { success: true, data };
}
```

**Verification:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 5 — US-088: Notification Delivery Rates

### Task 5.1 — Update `NotificationStats` interface

**File to modify:** `src/modules/notification/interfaces/notification-stats.interface.ts`

Replace entire file content:

```typescript
export interface ChannelDeliveryStats {
  channel: 'email' | 'sms';
  sent: number;
  failed: number;
  deliveryRate: number; // 0–100 integer, (sent / (sent + failed)) * 100
}

export interface NotificationStats {
  total: number;
  byStatus: {
    sent: number;
    failed: number;
    pending: number;
  };
  byChannel: ChannelDeliveryStats[];
  from: string | null;
  to: string | null;
  generatedAt: string;
}
```

**Verification:** `npm run typecheck`

---

### Task 5.2 — Update `NotificationService.getStats()`

**File to modify:** `src/modules/notification/services/notification.service.ts`

Replace the `getStats()` method body to add `byChannel` query and `deliveryRate` calculation:

```typescript
async getStats(from?: string, to?: string): Promise<NotificationStats> {
  const cacheKey = `stats:notifications:${from ?? 'all'}:${to ?? 'all'}`;
  const cached = await this.cacheManager.get<NotificationStats>(cacheKey);
  if (cached) return cached;

  // Query 1: by status
  const statusQb = this.notificationRepo
    .createQueryBuilder('n')
    .select('n.status', 'status')
    .addSelect('COUNT(*)', 'count')
    .groupBy('n.status');
  if (from) statusQb.andWhere('n.created_at >= :from', { from });
  if (to) statusQb.andWhere('n.created_at <= :to', { to });
  const statusRows: Array<{ status: string; count: string }> = await statusQb.getRawMany();

  // Query 2: by channel
  const channelQb = this.notificationRepo
    .createQueryBuilder('n')
    .select('n.channel', 'channel')
    .addSelect("COUNT(*) FILTER (WHERE n.status = 'sent')", 'sent')
    .addSelect("COUNT(*) FILTER (WHERE n.status = 'failed')", 'failed')
    .groupBy('n.channel');
  if (from) channelQb.andWhere('n.created_at >= :from', { from });
  if (to) channelQb.andWhere('n.created_at <= :to', { to });
  const channelRows: Array<{ channel: string; sent: string; failed: string }> =
    await channelQb.getRawMany();

  const byStatus = { sent: 0, failed: 0, pending: 0 };
  let total = 0;
  for (const row of statusRows) {
    const count = Number(row.count);
    total += count;
    if (row.status === 'sent') byStatus.sent = count;
    else if (row.status === 'failed') byStatus.failed = count;
    else if (row.status === 'pending') byStatus.pending = count;
  }

  const byChannel = channelRows.map(row => {
    const sent = Number(row.sent);
    const failed = Number(row.failed);
    const deliveryRate = sent + failed === 0 ? 0 : Math.round((sent / (sent + failed)) * 100);
    return {
      channel: row.channel as 'email' | 'sms',
      sent,
      failed,
      deliveryRate,
    };
  });

  const result: NotificationStats = {
    total,
    byStatus,
    byChannel,
    from: from ?? null,
    to: to ?? null,
    generatedAt: new Date().toISOString(),
  };

  await this.cacheManager.set(cacheKey, result, 300_000);
  return result;
}
```

**Verification:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 6 — Tests: AuditLogService + DashboardService

### Task 6.1 — Create `test/unit/common/audit-log.service.spec.ts`

**File to create:** `test/unit/common/audit-log.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLogService } from '../../../src/common/services/audit-log.service';
import { AuditLog } from '../../../src/common/entities/audit-log.entity';

const makeRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('AuditLogService', () => {
  let service: AuditLogService;
  let repo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    repo = makeRepo();
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditLogService, { provide: getRepositoryToken(AuditLog), useValue: repo }],
    }).compile();
    service = module.get(AuditLogService);
  });

  it('is defined', () => expect(service).toBeDefined());

  it('record() saves one audit log entry', async () => {
    const entry = {
      userId: 'u1',
      userEmail: 'a@b.com',
      userRole: 'super-admin',
      method: 'GET',
      path: '/admin/dashboard',
      statusCode: 200,
      ip: '127.0.0.1',
    };
    repo.create.mockReturnValue(entry);
    repo.save.mockResolvedValue(entry);
    await expect(service.record(entry)).resolves.toBeUndefined();
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('record() swallows errors silently', async () => {
    repo.create.mockReturnValue({});
    repo.save.mockRejectedValue(new Error('DB down'));
    await expect(
      service.record({
        userId: 'u1',
        userEmail: null,
        userRole: 'super-admin',
        method: 'GET',
        path: '/',
        statusCode: 200,
        ip: null,
      }),
    ).resolves.toBeUndefined();
  });

  it('findAll() applies userId filter and returns paginated result', async () => {
    const qb: Record<string, jest.Mock> = {
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    repo.createQueryBuilder.mockReturnValue(qb);
    const result = await service.findAll({ userId: 'u1', page: 1, limit: 20 });
    expect(result.total).toBe(0);
    expect(qb.andWhere).toHaveBeenCalledWith('a.userId = :userId', { userId: 'u1' });
  });
});
```

**Verification:** `npm run typecheck`

---

### Task 6.2 — Create `test/unit/common/dashboard.service.spec.ts`

**File to create:** `test/unit/common/dashboard.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { DashboardService } from '../../../src/common/services/dashboard.service';

const makeDataSource = () => ({ query: jest.fn() });
const makeCache = () => ({ get: jest.fn(), set: jest.fn() });

const mockRow = {
  total: '5',
  verified: '3',
  pending: '1',
  suspended: '1',
  granted: '2',
  denied: '1',
  revoked: '0',
  passed: '2',
  failed: '1',
  sent: '4',
  failed_notif: '1',
};

describe('DashboardService', () => {
  let service: DashboardService;
  let ds: ReturnType<typeof makeDataSource>;
  let cache: ReturnType<typeof makeCache>;

  beforeEach(async () => {
    ds = makeDataSource();
    cache = makeCache();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: DataSource, useValue: ds },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();
    service = module.get(DashboardService);
  });

  it('is defined', () => expect(service).toBeDefined());

  it('getDashboard() returns cached result when available', async () => {
    const cached = { cooperatives: { total: 1, verified: 1, pending: 0, suspended: 0 } };
    cache.get.mockResolvedValue(cached);
    const result = await service.getDashboard();
    expect(result).toBe(cached);
    expect(ds.query).not.toHaveBeenCalled();
  });

  it('getDashboard() queries all 5 schemas and returns metrics', async () => {
    cache.get.mockResolvedValue(null);
    cache.set.mockResolvedValue(undefined);
    ds.query
      .mockResolvedValueOnce([{ total: '10', verified: '7', pending: '2', suspended: '1' }])
      .mockResolvedValueOnce([{ total: '20' }])
      .mockResolvedValueOnce([
        { total: '15', granted: '10', pending: '3', denied: '1', revoked: '1' },
      ])
      .mockResolvedValueOnce([{ total: '8', passed: '6', failed: '2' }])
      .mockResolvedValueOnce([{ total: '50', sent: '45', failed: '5' }]);

    const result = await service.getDashboard();
    expect(result.cooperatives.total).toBe(10);
    expect(result.cooperatives.verified).toBe(7);
    expect(result.certifications.granted).toBe(10);
    expect(result.labTests.passed).toBe(6);
    expect(result.notifications.sent).toBe(45);
    expect(ds.query).toHaveBeenCalledTimes(5);
    expect(cache.set).toHaveBeenCalledWith('dashboard:admin', result, 300_000);
  });
});
```

**Verification:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 7 — Tests: CertificationService analytics + NotificationService delivery rates

### Task 7.1 — Extend `test/unit/certification/certification.service.spec.ts`

**File to modify:** `test/unit/certification/certification.service.spec.ts`

Add to the existing test file — append 2 new `describe` blocks for `getAnalytics()`:

```typescript
describe('getAnalytics()', () => {
  it('returns cached analytics when available', async () => {
    const cached = {
      period: { from: null, to: null },
      byRegion: [],
      byProductType: [],
      generatedAt: '',
    };
    cacheManager.get.mockResolvedValue(cached);
    const result = await service.getAnalytics();
    expect(result).toBe(cached);
  });

  it('queries DB and returns analytics with byRegion and byProductType', async () => {
    cacheManager.get.mockResolvedValue(null);
    cacheManager.set.mockResolvedValue(undefined);
    // dataSource.query is called twice (region + productType)
    dataSource.query
      .mockResolvedValueOnce([
        { region: 'SOUSS', granted: '5', denied: '1', revoked: '0', total: '6' },
      ])
      .mockResolvedValueOnce([
        { product_type: 'ARGAN_OIL', granted: '5', denied: '1', revoked: '0', total: '6' },
      ]);

    const result = await service.getAnalytics();
    expect(result.byRegion).toHaveLength(1);
    expect(result.byRegion[0]!.region).toBe('SOUSS');
    expect(result.byRegion[0]!.granted).toBe(5);
    expect(result.byProductType[0]!.productType).toBe('ARGAN_OIL');
  });
});
```

**Note:** Ensure `dataSource` mock is accessible in the test file (`{ provide: DataSource, useValue: dataSource }`). If not already present in the spec, add it to the module providers.

**Verification:** `npm run typecheck`

---

### Task 7.2 — Extend `test/unit/notification/notification.service.spec.ts`

**File to modify:** `test/unit/notification/notification.service.spec.ts`

Add 2 new tests for `getStats()` covering `byChannel` and `deliveryRate`:

```typescript
it('getStats() includes byChannel with deliveryRate', async () => {
  cacheManager.get.mockResolvedValue(null);
  cacheManager.set.mockResolvedValue(undefined);

  const mockQb = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getRawMany: jest
      .fn()
      .mockResolvedValueOnce([
        { status: 'sent', count: '40' },
        { status: 'failed', count: '10' },
      ])
      .mockResolvedValueOnce([
        { channel: 'email', sent: '30', failed: '5' },
        { channel: 'sms', sent: '10', failed: '5' },
      ]),
  };
  notificationRepo.createQueryBuilder.mockReturnValue(mockQb);

  const result = await service.getStats();
  const emailStats = result.byChannel.find((c) => c.channel === 'email');
  expect(emailStats?.deliveryRate).toBe(86); // Math.round(30/35*100)
  const smsStats = result.byChannel.find((c) => c.channel === 'sms');
  expect(smsStats?.deliveryRate).toBe(67); // Math.round(10/15*100)
});

it('getStats() returns deliveryRate 0 when no sent+failed', async () => {
  cacheManager.get.mockResolvedValue(null);
  cacheManager.set.mockResolvedValue(undefined);

  const mockQb = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getRawMany: jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ channel: 'email', sent: '0', failed: '0' }]),
  };
  notificationRepo.createQueryBuilder.mockReturnValue(mockQb);

  const result = await service.getStats();
  expect(result.byChannel[0]?.deliveryRate).toBe(0);
});
```

**Verification:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Testing Tasks Summary

| Test file                                               | Status   | New tests |
| ------------------------------------------------------- | -------- | --------- |
| `test/unit/common/audit-log.service.spec.ts`            | New      | 4 tests   |
| `test/unit/common/dashboard.service.spec.ts`            | New      | 3 tests   |
| `test/unit/certification/certification.service.spec.ts` | Extended | +2 tests  |
| `test/unit/notification/notification.service.spec.ts`   | Extended | +2 tests  |

**Target after Sprint 10:** 342 + 11 = **~353 tests, 0 failures**

---

## Final Verification Checklist

- [ ] `npm run lint` — 0 errors
- [ ] `npm run typecheck` — 0 errors
- [ ] `npm run test:unit` — all tests pass
- [ ] Migration `1700000000014-AddAuditLog.ts` exists
- [ ] `GET /admin/dashboard` registered in `AdminController`
- [ ] `GET /admin/audit-logs` registered in `AdminController`
- [ ] `GET /certifications/analytics` registered **before** `GET /certifications/:id`
- [ ] `AuditInterceptor` registered as `APP_INTERCEPTOR` in `AppModule`
- [ ] `TypeOrmModule.forFeature([AuditLog])` in `AppModule` imports
- [ ] `byChannel[].deliveryRate` present in `NotificationStats`
- [ ] `AuditLog` entity uses schema `common`, table `audit_log`
- [ ] PRODUCT-BACKLOG.md updated: US-081, US-082, US-085, US-088 → Done
- [ ] `.sessions/current-state.json` updated for Sprint 10

---

## Story Point Summary

| Story                 | SP     | Module(s)     |
| --------------------- | ------ | ------------- |
| US-081 Dashboard      | 8      | common        |
| US-082 Analytics      | 8      | certification |
| US-085 Audit Logs     | 5      | common        |
| US-088 Delivery Rates | 3      | notification  |
| **Total**             | **24** |               |
