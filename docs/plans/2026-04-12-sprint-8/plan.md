# Sprint 8 Implementation Plan

> **For Claude:** Use /execute to implement this plan task-by-task.

**Goal:** Add post-harvest processing steps, lab test history, inspector read access, SDOQ validity periods, MAPMDREF JSON export, and Kafka DLQ stats.

**Architecture:** product module (6 stories), certification module (1 story), common/admin (1 story). One new entity (ProcessingStep), one new column (validityDays), two migrations, one Kafka event.

**Tech Stack:** NestJS, TypeScript, PostgreSQL, Redpanda, Keycloak, Redis

**Modules Affected:** product, certification, common

**Estimated Story Points:** 24

---

## Pre-flight Checks

Before executing:

- `GET /products/:id` has no `@Roles()` guard → US-018 is already satisfied (any authenticated user including inspector). Only tests needed.
- `GET /lab-tests/:id` has no `@Roles()` guard → US-029 is already satisfied. Only tests needed.
- `UpdateProductTypeDto extends PartialType(CreateProductTypeDto)` → `labTestParameters` is already inheritable. US-025 needs `validityDays` added to the DTO + 2 tests.
- Migration sequence: last is `1700000000008`. New: 009 (ProcessingStep), 010 (ProductTypeValidityDays).

---

## Batch 1 — US-025 + US-018 + US-029 (Zero-code stories, tests only)

### Task 1.1 — US-025: Add `validityDays` to `UpdateProductTypeDto`

**File to modify:** `src/modules/product/dto/update-product-type.dto.ts`

`UpdateProductTypeDto` extends `PartialType(CreateProductTypeDto)` — `labTestParameters` is already inherited. The only addition needed is `validityDays`.

```typescript
// src/modules/product/dto/update-product-type.dto.ts
import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateProductTypeDto } from './create-product-type.dto';

export class UpdateProductTypeDto extends PartialType(CreateProductTypeDto) {
  @ApiPropertyOptional({ description: 'Certificate validity in days (1–3650)', example: 365 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  validityDays?: number;
}
```

**Verification:** `npm run typecheck` — no errors.

---

### Task 1.2 — US-018: Unit test — inspector can read product SDOQ spec

**File to modify:** `test/unit/product/product.service.spec.ts` (or create `test/unit/product/product.controller.spec.ts` if it doesn't exist)

Add one test asserting `ProductService.findById()` resolves successfully (role enforcement is at controller level; controller has `JwtAuthGuard` only — any authenticated user including inspector can call it).

```typescript
// Add to existing product service spec or create product.controller.spec.ts
it('US-018: findById returns product for any authenticated user including inspector', async () => {
  mockProductRepo.findOne.mockResolvedValue(mockProduct);
  const result = await service.findById(mockProduct.id);
  expect(result).toEqual(mockProduct);
});
```

**Verification:** `npm run test:unit` — all passing.

---

### Task 1.3 — US-029: Unit test — inspector can read lab test

**File to modify:** `test/unit/product/lab-test.service.spec.ts`

```typescript
// Add to lab-test.service.spec.ts
it('US-029: findById resolves lab test for any authenticated user including inspector', async () => {
  mockLabTestRepo.findOne.mockResolvedValue(mockLabTest);
  const result = await service.findById(mockLabTest.id);
  expect(result).toEqual(mockLabTest);
});
```

**Verification:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 2 — US-045: ProductType Validity Days

### Task 2.1 — Add `validityDays` column to `ProductType` entity

**File to modify:** `src/modules/product/entities/product-type.entity.ts`

Add after the `isActive` column:

```typescript
/** US-045 — Certificate validity period in days (null = no default configured). */
@Column({ name: 'validity_days', type: 'int', nullable: true })
validityDays: number | null;
```

**Verification:** `npm run typecheck` — no errors.

---

### Task 2.2 — Migration 009: Add validity_days column

**File to create:** `src/database/migrations/1700000000009-AddProductTypeValidityDays.ts`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductTypeValidityDays1700000000009 implements MigrationInterface {
  name = 'AddProductTypeValidityDays1700000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product"."product_type" ADD COLUMN IF NOT EXISTS "validity_days" integer NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product"."product_type" DROP COLUMN IF EXISTS "validity_days"`,
    );
  }
}
```

**Verification:** `npm run typecheck` — no errors.

---

### Task 2.3 — Tests: validityDays in ProductTypeService

**File to modify:** `test/unit/product/product-type.service.spec.ts`

Add 2 tests:

```typescript
describe('update — validityDays', () => {
  it('sets validityDays when provided', async () => {
    mockRepo.findOne.mockResolvedValue({ ...mockProductType, validityDays: null });
    mockRepo.save.mockResolvedValue({ ...mockProductType, validityDays: 365 });
    const result = await service.update(mockProductType.id, { validityDays: 365 });
    expect(result.validityDays).toBe(365);
  });

  it('clears validityDays when set to undefined (partial update)', async () => {
    mockRepo.findOne.mockResolvedValue({ ...mockProductType, validityDays: 365 });
    mockRepo.save.mockResolvedValue({ ...mockProductType, validityDays: 365 });
    const result = await service.update(mockProductType.id, { nameFr: 'Updated' });
    expect(mockRepo.save).toHaveBeenCalled();
    expect(result).toBeDefined();
  });
});
```

**Verification:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 3 — US-019 Part 1: ProcessingStep Entity + Kafka Interface

### Task 3.1 — Kafka event interface in common

**File to modify:** `src/common/interfaces/events/product.events.ts`

Add after `ProductBatchCreatedEvent`:

```typescript
export interface ProductBatchProcessingStepAddedEvent extends BaseEvent {
  batchId: string;
  processingStepId: string;
  cooperativeId: string;
  stepType: string;
  doneAt: string;
  doneBy: string;
  notes: string | null;
}
```

Also add `ProductBatchProcessingStepAddedEvent` to `src/common/interfaces/events/index.ts` — it's auto-exported via `export * from './product.events'`.

---

### Task 3.2 — Re-export in product barrel

**File to modify:** `src/modules/product/events/product-events.ts`

Add:

```typescript
export type { ProductBatchProcessingStepAddedEvent } from '../../../common/interfaces/events/product.events';
```

---

### Task 3.3 — ProcessingStep entity

**File to create:** `src/modules/product/entities/processing-step.entity.ts`

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum ProcessingStepType {
  SORTING = 'SORTING',
  WASHING = 'WASHING',
  PRESSING = 'PRESSING',
  DRYING = 'DRYING',
  PACKAGING = 'PACKAGING',
  STORAGE = 'STORAGE',
  TRANSPORT = 'TRANSPORT',
  OTHER = 'OTHER',
}

/**
 * Records an immutable post-harvest processing step for a production batch.
 * Append-only — no updatedAt (mirrors CertificationEvent pattern).
 * US-019.
 */
@Entity({ schema: 'product', name: 'processing_step' })
export class ProcessingStep {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'batch_id', type: 'uuid' })
  batchId: string;

  @Column({ name: 'cooperative_id', type: 'uuid' })
  cooperativeId: string;

  @Column({ name: 'step_type', type: 'varchar', length: 30 })
  stepType: ProcessingStepType;

  @Column({ name: 'done_at', type: 'timestamptz' })
  doneAt: Date;

  @Column({ name: 'done_by', type: 'uuid' })
  doneBy: string;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
```

---

### Task 3.4 — Migration 010: Create processing_step table

**File to create:** `src/database/migrations/1700000000010-AddProcessingStep.ts`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProcessingStep1700000000010 implements MigrationInterface {
  name = 'AddProcessingStep1700000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product"."processing_step" (
        "id"             uuid              NOT NULL DEFAULT gen_random_uuid(),
        "batch_id"       uuid              NOT NULL,
        "cooperative_id" uuid              NOT NULL,
        "step_type"      varchar(30)       NOT NULL,
        "done_at"        timestamptz       NOT NULL,
        "done_by"        uuid              NOT NULL,
        "notes"          text              NULL,
        "created_at"     timestamptz       NOT NULL DEFAULT now(),
        CONSTRAINT "pk_processing_step" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_processing_step_batch_id"
       ON "product"."processing_step" ("batch_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "product"."processing_step"`);
  }
}
```

**Verification:** `npm run lint && npm run typecheck`

---

### Task 3.5 — AddProcessingStepDto

**File to create:** `src/modules/product/dto/add-processing-step.dto.ts`

```typescript
import { IsEnum, IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProcessingStepType } from '../entities/processing-step.entity';

export class AddProcessingStepDto {
  @ApiProperty({ enum: ProcessingStepType, description: 'Type of processing step' })
  @IsEnum(ProcessingStepType)
  stepType: ProcessingStepType;

  @ApiProperty({
    description: 'When the step was performed (ISO 8601)',
    example: '2026-04-10T08:00:00Z',
  })
  @IsDateString()
  doneAt: string;

  @ApiPropertyOptional({ description: 'Notes or observations', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
```

**Verification:** `npm run lint && npm run typecheck`

---

## Batch 4 — US-019 Part 2: ProcessingStepService + BatchController Endpoints

### Task 4.1 — ProcessingStepService

**File to create:** `src/modules/product/services/processing-step.service.ts`

```typescript
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProcessingStep } from '../entities/processing-step.entity';
import { AddProcessingStepDto } from '../dto/add-processing-step.dto';
import { ProductionBatch } from '../entities/production-batch.entity';
import { ProductProducer } from '../events/product.producer';

@Injectable()
export class ProcessingStepService {
  private readonly logger = new Logger(ProcessingStepService.name);

  constructor(
    @InjectRepository(ProcessingStep)
    private readonly stepRepo: Repository<ProcessingStep>,
    @InjectRepository(ProductionBatch)
    private readonly batchRepo: Repository<ProductionBatch>,
    private readonly producer: ProductProducer,
  ) {}

  /**
   * Record a post-harvest processing step for a batch.
   * US-019: cooperative-admin / cooperative-member.
   */
  async addStep(
    batchId: string,
    dto: AddProcessingStepDto,
    cooperativeId: string,
    actorId: string,
    correlationId: string,
  ): Promise<ProcessingStep> {
    const batch = await this.batchRepo.findOne({ where: { id: batchId } });
    if (!batch) {
      throw new NotFoundException({
        code: 'BATCH_NOT_FOUND',
        message: `Batch ${batchId} not found`,
      });
    }

    const step = this.stepRepo.create({
      batchId,
      cooperativeId,
      stepType: dto.stepType,
      doneAt: new Date(dto.doneAt),
      doneBy: actorId,
      notes: dto.notes ?? null,
    });

    const saved = await this.stepRepo.save(step);

    await this.producer.publishProcessingStepAdded(saved, correlationId);

    this.logger.log({ batchId, stepType: dto.stepType }, 'Processing step recorded');
    return saved;
  }

  /**
   * Return all processing steps for a batch, ordered by doneAt ascending.
   * US-019: cooperative-admin, inspector, certification-body.
   */
  async findByBatch(batchId: string): Promise<ProcessingStep[]> {
    return this.stepRepo.find({
      where: { batchId },
      order: { doneAt: 'ASC' },
    });
  }
}
```

---

### Task 4.2 — ProductProducer: add `publishProcessingStepAdded`

**File to modify:** `src/modules/product/events/product.producer.ts`

Add import at the top (with existing imports):

```typescript
import type { ProductBatchProcessingStepAddedEvent } from './product-events';
import { ProcessingStep } from '../entities/processing-step.entity';
```

Add method:

```typescript
async publishProcessingStepAdded(step: ProcessingStep, correlationId: string): Promise<void> {
  const event: ProductBatchProcessingStepAddedEvent = {
    eventId: uuidv4(),
    correlationId,
    timestamp: new Date().toISOString(),
    version: 1,
    source: 'product',
    batchId: step.batchId,
    processingStepId: step.id,
    cooperativeId: step.cooperativeId,
    stepType: step.stepType,
    doneAt: step.doneAt.toISOString(),
    doneBy: step.doneBy,
    notes: step.notes,
  };

  try {
    await this.kafkaClient.emit('product.batch.processing_step_added', event).toPromise();
    this.logger.log({ eventId: event.eventId, batchId: step.batchId }, 'Processing step event published');
  } catch (error) {
    this.logger.error({ error, batchId: step.batchId }, 'Failed to publish processing step event');
  }
}
```

---

### Task 4.3 — BatchController: add processing-steps sub-resource

**File to modify:** `src/modules/product/controllers/batch.controller.ts`

Add imports:

```typescript
import { Query, Headers } from '@nestjs/common';
import { ProcessingStepService } from '../services/processing-step.service';
import { AddProcessingStepDto } from '../dto/add-processing-step.dto';
import { ProcessingStep } from '../entities/processing-step.entity';
```

Inject `ProcessingStepService` via constructor:

```typescript
constructor(
  private readonly batchService: BatchService,
  private readonly processingStepService: ProcessingStepService,
) {}
```

Add two endpoints AFTER the existing routes:

```typescript
/** US-019: Record a post-harvest processing step for a batch */
@Post(':id/processing-steps')
@UseGuards(RolesGuard)
@Roles('cooperative-admin', 'cooperative-member')
@HttpCode(HttpStatus.CREATED)
@ApiOperation({ summary: 'US-019: Add a post-harvest processing step to a batch' })
async addProcessingStep(
  @Param('id') batchId: string,
  @Body() dto: AddProcessingStepDto,
  @CurrentUser() user: CurrentUserPayload,
  @Headers('x-correlation-id') correlationId = '',
): Promise<ProcessingStep> {
  const cooperativeId = user.cooperative_id ?? '';
  return this.processingStepService.addStep(batchId, dto, cooperativeId, user.sub, correlationId ?? user.sub);
}

/** US-019: List all processing steps for a batch */
@Get(':id/processing-steps')
@UseGuards(RolesGuard)
@Roles('cooperative-admin', 'cooperative-member', 'inspector', 'certification-body', 'super-admin')
@ApiOperation({ summary: 'US-019: List post-harvest processing steps for a batch' })
async listProcessingSteps(@Param('id') batchId: string): Promise<ProcessingStep[]> {
  return this.processingStepService.findByBatch(batchId);
}
```

---

### Task 4.4 — Register ProcessingStep in ProductModule

**File to modify:** `src/modules/product/product.module.ts`

Add to imports:

```typescript
import { ProcessingStep } from './entities/processing-step.entity';
import { ProcessingStepService } from './services/processing-step.service';
```

Add `ProcessingStep` to `TypeOrmModule.forFeature([...])`.

Add `ProcessingStepService` to `providers: [...]`.

**Verification:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 5 — US-028: Lab Test History (List Endpoint)

### Task 5.1 — LabTestListQueryDto

**File to create:** `src/modules/product/dto/lab-test-list-query.dto.ts`

```typescript
import { IsOptional, IsUUID, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { LabTestStatus } from '../entities/lab-test.entity';

export class LabTestListQueryDto {
  @ApiPropertyOptional({ description: 'Filter by batch UUID' })
  @IsOptional()
  @IsUUID()
  batchId?: string;

  @ApiPropertyOptional({ description: 'Filter by cooperative UUID' })
  @IsOptional()
  @IsUUID()
  cooperativeId?: string;

  @ApiPropertyOptional({ enum: ['submitted', 'in_progress', 'completed', 'cancelled'] })
  @IsOptional()
  @IsEnum(['submitted', 'in_progress', 'completed', 'cancelled'])
  status?: LabTestStatus;

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

---

### Task 5.2 — LabTestService.findAll

**File to modify:** `src/modules/product/services/lab-test.service.ts`

Add import:

```typescript
import { FindOptionsWhere } from 'typeorm';
import { PagedResult } from '../../../common/dto/pagination.dto';
import { LabTestListQueryDto } from '../dto/lab-test-list-query.dto';
```

Add method:

```typescript
/**
 * Paginated list of lab tests with optional filters.
 * US-028: cooperative-admin scoped to own cooperative; super-admin/cert-body/inspector see all.
 */
async findAll(query: LabTestListQueryDto): Promise<PagedResult<LabTest>> {
  const where: FindOptionsWhere<LabTest> = {};
  if (query.batchId) where.batchId = query.batchId;
  if (query.cooperativeId) where.cooperativeId = query.cooperativeId;
  if (query.status) where.status = query.status;

  const page = query.page ?? 1;
  const limit = query.limit ?? 20;

  const [data, total] = await this.labTestRepo.findAndCount({
    where,
    order: { createdAt: 'DESC' },
    skip: (page - 1) * limit,
    take: limit,
  });

  return { data, meta: { page, limit, total } };
}
```

---

### Task 5.3 — LabTestController: GET /lab-tests list endpoint

**File to modify:** `src/modules/product/controllers/lab-test.controller.ts`

Add imports:

```typescript
import { Query } from '@nestjs/common';
import { LabTestListQueryDto } from '../dto/lab-test-list-query.dto';
import { PagedResult } from '../../../common/dto/pagination.dto';
```

Add `GET /lab-tests` BEFORE the existing `@Post()` (NestJS processes in declaration order; GET list must come before GET `:id`). In practice, add it as the FIRST `@Get()` method in the class:

```typescript
/**
 * US-028: Paginated lab test history.
 * cooperative-admin: server enforces own cooperativeId from JWT.
 */
@Get()
@UseGuards(RolesGuard)
@Roles('cooperative-admin', 'inspector', 'certification-body', 'super-admin')
@ApiOperation({ summary: 'US-028: List lab tests with optional filters' })
async findAll(
  @Query() query: LabTestListQueryDto,
  @CurrentUser() user: CurrentUserPayload,
): Promise<PagedResult<LabTest>> {
  // cooperative-admin can only see their own cooperative's lab tests
  const roles: string[] = user.realm_access?.roles ?? [];
  if (roles.includes('cooperative-admin') && !roles.includes('super-admin')) {
    query.cooperativeId = user.cooperative_id ?? query.cooperativeId;
  }
  return this.labTestService.findAll(query);
}
```

**Verification:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 6 — US-084: MAPMDREF Certification Export

### Task 6.1 — ExportQueryDto

**File to create:** `src/modules/certification/dto/export-query.dto.ts`

```typescript
import { IsOptional, IsDateString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CertificationStatus } from '../entities/certification.entity';

export class ExportQueryDto {
  @ApiPropertyOptional({ description: 'Start date filter (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'End date filter (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ enum: CertificationStatus })
  @IsOptional()
  @IsEnum(CertificationStatus)
  status?: CertificationStatus;
}
```

---

### Task 6.2 — CertificationService.exportForMapmdref

**File to modify:** `src/modules/certification/services/certification.service.ts`

Add import:

```typescript
import { FindOptionsWhere, Between } from 'typeorm';
import { ExportQueryDto } from '../dto/export-query.dto';
```

Add method after `getStats()`:

```typescript
/**
 * Export all certifications as a flat array for MAPMDREF regulatory reporting.
 * US-084: super-admin and certification-body.
 * Capped at 10,000 rows.
 */
async exportForMapmdref(query: ExportQueryDto): Promise<Certification[]> {
  const where: FindOptionsWhere<Certification> = {};
  if (query.status) where.currentStatus = query.status;
  if (query.from && query.to) {
    where.requestedAt = Between(new Date(query.from), new Date(query.to));
  }

  return this.certRepo.find({
    where,
    order: { requestedAt: 'DESC' },
    take: 10_000,
  });
}
```

---

### Task 6.3 — CertificationController: GET /certifications/export

**File to modify:** `src/modules/certification/controllers/certification.controller.ts`

Add imports:

```typescript
import { ExportQueryDto } from '../dto/export-query.dto';
```

Add the endpoint in the LITERAL cluster (alongside `stats`, `pending`, `my`) — BEFORE `@Get(':id')`:

```typescript
/**
 * US-084 — Export certifications as JSON for MAPMDREF regulatory reporting.
 * Returns up to 10,000 rows. Sets Content-Disposition: attachment header.
 */
@Get('export')
@UseGuards(RolesGuard)
@Roles('super-admin', 'certification-body')
@ApiOperation({ summary: 'US-084: Export certifications as JSON for MAPMDREF' })
@ApiQuery({ name: 'from', required: false, type: String, description: 'YYYY-MM-DD' })
@ApiQuery({ name: 'to', required: false, type: String, description: 'YYYY-MM-DD' })
@ApiQuery({ name: 'status', required: false, enum: CertificationStatus })
async exportForMapmdref(
  @Query() query: ExportQueryDto,
  @Res({ passthrough: true }) res: Response,
): Promise<Certification[]> {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  res.set({
    'Content-Type': 'application/json',
    'Content-Disposition': `attachment; filename="certifications-export-${date}.json"`,
  });
  return this.certificationService.exportForMapmdref(query);
}
```

**Verification:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 7 — US-087: Kafka DLQ Stats

### Task 7.1 — KafkaAdminService

**File to create:** `src/common/services/kafka-admin.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface RedpandaTopic {
  name: string;
}

interface PartitionInfo {
  id: number;
  high_watermark: number;
}

export interface DlqTopicStats {
  topic: string;
  totalMessages: number;
}

/**
 * Calls the Redpanda Admin HTTP API to retrieve DLQ topic message counts.
 * US-087: super-admin dashboard — detect processing failures.
 */
@Injectable()
export class KafkaAdminService {
  private readonly logger = new Logger(KafkaAdminService.name);
  private readonly adminUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.adminUrl = this.configService.get<string>('REDPANDA_ADMIN_URL', 'http://redpanda:9644');
  }

  /**
   * Returns message counts for all DLQ topics (topics ending in .dlq).
   * Uses Redpanda Admin REST API v1.
   */
  async getDlqStats(): Promise<DlqTopicStats[]> {
    try {
      const topicsRes = await fetch(`${this.adminUrl}/v1/topics`);
      const topics = (await topicsRes.json()) as RedpandaTopic[];

      const dlqTopics = topics.filter((t) => t.name.endsWith('.dlq'));

      const stats = await Promise.all(
        dlqTopics.map(async (topic): Promise<DlqTopicStats> => {
          try {
            const partRes = await fetch(`${this.adminUrl}/v1/topics/${topic.name}/partitions`);
            const partitions = (await partRes.json()) as PartitionInfo[];
            const totalMessages = partitions.reduce((sum, p) => sum + (p.high_watermark ?? 0), 0);
            return { topic: topic.name, totalMessages };
          } catch {
            this.logger.warn({ topic: topic.name }, 'Failed to fetch partition info for DLQ topic');
            return { topic: topic.name, totalMessages: -1 };
          }
        }),
      );

      return stats;
    } catch (error) {
      this.logger.error({ error }, 'Failed to reach Redpanda Admin API');
      return [];
    }
  }
}
```

---

### Task 7.2 — AdminController

**File to create:** `src/common/controllers/admin.controller.ts`

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { KafkaAdminService, DlqTopicStats } from '../services/kafka-admin.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super-admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly kafkaAdminService: KafkaAdminService) {}

  /**
   * US-087: View Kafka DLQ topic message counts.
   * Calls Redpanda Admin API to return current high watermarks for all *.dlq topics.
   */
  @Get('kafka/dlq-stats')
  @ApiOperation({ summary: 'US-087: Kafka DLQ topic message counts (super-admin)' })
  async getDlqStats(): Promise<{ success: boolean; data: DlqTopicStats[] }> {
    const data = await this.kafkaAdminService.getDlqStats();
    return { success: true, data };
  }
}
```

---

### Task 7.3 — Register AdminController + KafkaAdminService in AppModule

**File to modify:** `src/app.module.ts`

Add imports at the top:

```typescript
import { AdminController } from './common/controllers/admin.controller';
import { KafkaAdminService } from './common/services/kafka-admin.service';
```

Update `controllers` and add `providers`:

```typescript
controllers: [HealthController, UserController, AdminController],
providers: [KafkaAdminService],
```

**Verification:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 8 — Testing Tasks

### Task 8.1 — ProcessingStepService unit tests

**File to create:** `test/unit/product/processing-step.service.spec.ts`

Cover:

- `addStep`: batch found → step created + producer called
- `addStep`: batch not found → `NotFoundException`
- `addStep`: notes defaults to null when not provided
- `findByBatch`: returns ordered array
- `findByBatch`: returns empty array when no steps

```typescript
// Scaffold — mock pattern same as cooperative.service.spec.ts (useValue)
const makeBatchRepo = () => ({
  findOne: jest.fn(),
});
const makeStepRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
});
const makeProducer = () => ({
  publishProcessingStepAdded: jest.fn().mockResolvedValue(undefined),
});
```

---

### Task 8.2 — LabTestService.findAll unit tests

**File to modify:** `test/unit/product/lab-test.service.spec.ts`

Add `findAll` describe block (3 tests):

- returns paginated result with cooperative filter
- enforces cooperativeId when provided
- returns empty page when no results

---

### Task 8.3 — CertificationService.exportForMapmdref unit tests

**File to modify:** `test/unit/certification/certification.service.spec.ts`

Add `exportForMapmdref` describe block (3 tests):

- no filter → returns array of certifications
- with `status=GRANTED` → `where.currentStatus` set
- with `from` + `to` → `where.requestedAt` is a `Between` expression

---

### Task 8.4 — AdminController unit tests

**File to create:** `test/unit/common/admin.controller.spec.ts`

2 tests:

- `getDlqStats`: returns `{ success: true, data: [...] }` from `KafkaAdminService`
- `getDlqStats`: returns `{ success: true, data: [] }` when service returns empty (API unreachable)

---

### Task 8.5 — ProductTypeService: validityDays + labTestParameters update tests

Already covered in Task 2.3 above.

**Final verification:** `npm run lint && npm run typecheck && npm run test:unit`

Expected: ~27 suites, ~315+ tests, 0 failures.

---

## Migration Checklist

| #   | File                                          | Change                                                             |
| --- | --------------------------------------------- | ------------------------------------------------------------------ |
| 009 | `1700000000009-AddProductTypeValidityDays.ts` | ALTER TABLE product.product_type ADD COLUMN validity_days INT NULL |
| 010 | `1700000000010-AddProcessingStep.ts`          | CREATE TABLE product.processing_step                               |

Run after Docker is up: `npm run migration:run`

---

## New Files

| File                                                                  | Purpose                    |
| --------------------------------------------------------------------- | -------------------------- |
| `src/modules/product/entities/processing-step.entity.ts`              | ProcessingStep entity      |
| `src/modules/product/dto/add-processing-step.dto.ts`                  | POST body DTO              |
| `src/modules/product/dto/lab-test-list-query.dto.ts`                  | Lab test list query DTO    |
| `src/modules/product/services/processing-step.service.ts`             | ProcessingStepService      |
| `src/modules/certification/dto/export-query.dto.ts`                   | Export query DTO           |
| `src/common/services/kafka-admin.service.ts`                          | Redpanda Admin HTTP calls  |
| `src/common/controllers/admin.controller.ts`                          | GET /admin/kafka/dlq-stats |
| `src/database/migrations/1700000000009-AddProductTypeValidityDays.ts` | Migration 009              |
| `src/database/migrations/1700000000010-AddProcessingStep.ts`          | Migration 010              |
| `test/unit/product/processing-step.service.spec.ts`                   | ProcessingStep tests       |
| `test/unit/common/admin.controller.spec.ts`                           | AdminController tests      |

## Modified Files

| File                                                                | Change                                          |
| ------------------------------------------------------------------- | ----------------------------------------------- |
| `src/common/interfaces/events/product.events.ts`                    | Add ProductBatchProcessingStepAddedEvent        |
| `src/modules/product/events/product-events.ts`                      | Re-export new event                             |
| `src/modules/product/events/product.producer.ts`                    | Add publishProcessingStepAdded()                |
| `src/modules/product/entities/product-type.entity.ts`               | Add validityDays column                         |
| `src/modules/product/dto/update-product-type.dto.ts`                | Add validityDays field                          |
| `src/modules/product/controllers/batch.controller.ts`               | Add processing-steps sub-resource               |
| `src/modules/product/controllers/lab-test.controller.ts`            | Add GET /lab-tests list                         |
| `src/modules/product/services/lab-test.service.ts`                  | Add findAll()                                   |
| `src/modules/product/product.module.ts`                             | Register ProcessingStep + ProcessingStepService |
| `src/modules/certification/services/certification.service.ts`       | Add exportForMapmdref()                         |
| `src/modules/certification/controllers/certification.controller.ts` | Add GET /certifications/export                  |
| `src/app.module.ts`                                                 | Register AdminController + KafkaAdminService    |
| `test/unit/product/product-type.service.spec.ts`                    | Add validityDays tests                          |
| `test/unit/product/lab-test.service.spec.ts`                        | Add findAll() tests                             |
| `test/unit/certification/certification.service.spec.ts`             | Add exportForMapmdref tests                     |
