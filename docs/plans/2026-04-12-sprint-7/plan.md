# Sprint 7 Implementation Plan

> **For Claude:** Use /execute to implement this plan task-by-task.

**Goal:** Deliver cooperative deactivation, SDOQ product type CRUD, inspector assignment, notification stats, and read-only user roles view.

**Architecture:** 4 domain modules (cooperative, product, certification, notification) + common. 2 new Kafka events. 1 DB migration. 10 new endpoints. No cross-module service imports.

**Tech Stack:** NestJS, TypeScript, PostgreSQL + PostGIS, Redpanda, Keycloak, Redis

**Modules Affected:** cooperative, product, certification, notification, common

**Estimated Story Points:** 20 SP

---

## Stories

| ID     | Title                          | SP  |
| ------ | ------------------------------ | --- |
| TM-3   | Migration chain verification   | 1   |
| US-010 | Deactivate cooperative         | 3   |
| US-016 | SDOQ product type CRUD         | 5   |
| US-044 | Assign inspector to inspection | 3   |
| US-076 | Notification stats             | 3   |
| US-086 | User roles read-only           | 5   |

---

## Batch 1 — TM-3 + US-010 Kafka Interfaces

### Task 1 — TM-3: Migration chain verification

**Files:** none (shell only)

**Commands:**

```bash
docker compose --profile core up -d postgres
npm run migration:run
npm run migration:generate -- --check
```

**Expected:** `migration:generate --check` exits 0 with "No changes detected".
**If Docker unavailable:** document blocker in progress.md, mark TM-3 as deferred (3rd time).

**Verification:** `echo $?` returns 0 after migration:generate --check.

---

### Task 2 — US-010: Add `CooperativeDeactivatedEvent` interface (2 files)

**File 1 — modify:** `src/common/interfaces/events/cooperative.events.ts`

Add at end of file:

```ts
export interface CooperativeDeactivatedEvent extends BaseEvent {
  cooperativeId: string;
  cooperativeName: string;
  ice: string;
  regionCode: string;
  deactivatedBy: string;
  reason: string | null;
}
```

**File 2 — modify:** `src/modules/cooperative/events/cooperative-events.ts`

Add `CooperativeDeactivatedEvent` to the re-export list:

```ts
export type {
  CooperativeRegistrationSubmittedEvent,
  CooperativeRegistrationVerifiedEvent,
  CooperativeFarmMappedEvent,
  CooperativeDeactivatedEvent,
} from '../../../common/interfaces/events/cooperative.events';
```

**Verification:** `npm run typecheck` — no errors.

---

### Task 3 — US-010: `DeactivateCooperativeDto`

**File — create:** `src/modules/cooperative/dto/deactivate-cooperative.dto.ts`

```ts
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class DeactivateCooperativeDto {
  @ApiPropertyOptional({ description: 'Reason for deactivation', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
```

**Verification:** `npm run lint` — no errors.

---

**Batch 1 checkpoint:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 2 — US-010 Service + Producer + Controller + Notification Handler

### Task 4 — US-010: `CooperativeService.deactivate()` + `CooperativeProducer.publishCooperativeDeactivated()`

**File — modify:** `src/modules/cooperative/services/cooperative.service.ts`

Add method (inject producer if not already injected — check file first):

```ts
/**
 * US-010 — Deactivates a cooperative (super-admin action).
 * Sets status to 'suspended' and publishes cooperative.cooperative.deactivated Kafka event.
 */
async deactivate(
  id: string,
  deactivatedBy: string,
  reason: string | null,
  correlationId: string,
): Promise<Cooperative> {
  const cooperative = await this.cooperativeRepo.findOne({ where: { id } });
  if (!cooperative) {
    throw new NotFoundException({ code: 'COOPERATIVE_NOT_FOUND', message: `Cooperative ${id} not found` });
  }
  if (cooperative.status === 'suspended') {
    throw new ConflictException({ code: 'ALREADY_SUSPENDED', message: 'Cooperative is already suspended' });
  }
  await this.cooperativeRepo.update({ id }, { status: 'suspended' });
  const updated = { ...cooperative, status: 'suspended' as const };
  await this.producer.publishCooperativeDeactivated(updated, deactivatedBy, reason, correlationId);
  this.logger.log({ cooperativeId: id, deactivatedBy }, 'Cooperative deactivated');
  return { ...updated };
}
```

**File — modify:** `src/modules/cooperative/events/cooperative.producer.ts`

Add method:

```ts
/** Publish cooperative deactivated event (US-010) */
async publishCooperativeDeactivated(
  cooperative: Cooperative,
  deactivatedBy: string,
  reason: string | null,
  correlationId: string,
): Promise<void> {
  const event: CooperativeDeactivatedEvent = {
    eventId: uuidv4(),
    correlationId,
    timestamp: new Date().toISOString(),
    version: 1,
    source: 'cooperative',
    cooperativeId: cooperative.id,
    cooperativeName: cooperative.name,
    ice: cooperative.ice,
    regionCode: cooperative.regionCode,
    deactivatedBy,
    reason,
  };
  try {
    await this.kafkaClient.emit('cooperative.cooperative.deactivated', event).toPromise();
    this.logger.log({ eventId: event.eventId, cooperativeId: cooperative.id }, 'Cooperative deactivated event published');
  } catch (error) {
    this.logger.error({ error, cooperativeId: cooperative.id }, 'Failed to publish cooperative deactivated event');
  }
}
```

Also add `CooperativeDeactivatedEvent` to the import in `cooperative.producer.ts`.

---

### Task 5 — US-010: `PUT /cooperatives/:id/deactivate` endpoint

**File — modify:** `src/modules/cooperative/controllers/cooperative.controller.ts`

Add endpoint:

```ts
/** US-010 — Deactivate a cooperative */
@Put(':id/deactivate')
@UseGuards(RolesGuard)
@Roles('super-admin')
@ApiOperation({ summary: 'US-010: Deactivate a cooperative (super-admin)' })
async deactivate(
  @Param('id') id: string,
  @Body() dto: DeactivateCooperativeDto,
  @CurrentUser() user: CurrentUserPayload,
  @Headers('x-correlation-id') correlationId = '',
): Promise<Cooperative> {
  return this.cooperativeService.deactivate(id, user.sub, dto.reason ?? null, correlationId);
}
```

Add `DeactivateCooperativeDto` to the imports.

---

### Task 6 — US-010: Notification listener for `cooperative.cooperative.deactivated`

**File — modify:** `src/modules/notification/listeners/notification.listener.ts`

Add handler:

```ts
@EventPattern('cooperative.cooperative.deactivated')
async handleCooperativeDeactivated(
  @Payload() data: CooperativeDeactivatedEvent,
  @Ctx() _context: KafkaContext,
): Promise<void> {
  try {
    this.logger.log(
      { eventId: data.eventId, cooperativeId: data.cooperativeId },
      'Cooperative deactivated — sending notification',
    );
    await this.notificationService.send({
      recipientId: data.cooperativeId,
      channel: 'email',
      templateCode: 'cooperative-deactivated',
      language: 'fr-MA',
      context: {
        cooperativeName: data.cooperativeName,
        reason: data.reason ?? 'Non spécifié',
        deactivatedBy: data.deactivatedBy,
      },
      triggerEventId: data.eventId,
      correlationId: data.correlationId,
    });
  } catch (error) {
    this.logger.error(
      { error, eventId: data.eventId },
      'Failed to process cooperative.cooperative.deactivated',
    );
  }
}
```

Add `CooperativeDeactivatedEvent` to the imports from `../../../common/interfaces/events`.

---

**Batch 2 checkpoint:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 3 — US-016 Migration + Entity + DTOs

### Task 7 — US-016: Migration `1700000000007-AddProductTypeIsActive`

**File — create:** `src/database/migrations/1700000000007-AddProductTypeIsActive.ts`

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductTypeIsActive1700000000007 implements MigrationInterface {
  name = 'AddProductTypeIsActive1700000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product"."product_type" ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product"."product_type" DROP COLUMN IF EXISTS "is_active"`,
    );
  }
}
```

---

### Task 8 — US-016: Add `isActive` to `ProductType` entity

**File — modify:** `src/modules/product/entities/product-type.entity.ts`

Add column after `onssaCategory`:

```ts
@Column({ name: 'is_active', type: 'boolean', default: true })
isActive: boolean;
```

---

### Task 9 — US-016: `CreateProductTypeDto` + `UpdateProductTypeDto`

**File — create:** `src/modules/product/dto/create-product-type.dto.ts`

```ts
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CertificationType } from '../../../common/interfaces/morocco.interface';

class LabTestParameterDto {
  @IsString() @IsNotEmpty() name: string;
  @IsString() @IsNotEmpty() unit: string;
  @IsOptional() minValue?: number;
  @IsOptional() maxValue?: number;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) values?: string[];
}

export class CreateProductTypeDto {
  @ApiProperty({ example: 'SAFFRON_TALIOUINE' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @ApiProperty({ example: 'Safran de Taliouine' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nameFr: string;

  @ApiProperty({ example: 'زعفران تالوين' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nameAr: string;

  @ApiPropertyOptional({ example: 'ⵣⵄⴼⵔⴰⵏ' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nameZgh?: string;

  @ApiProperty({ enum: ['IGP', 'AOP', 'LA'] })
  @IsEnum(['IGP', 'AOP', 'LA'])
  certificationType: CertificationType;

  @ApiProperty({ example: 'SOUSS_MASSA' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  regionCode: string;

  @ApiProperty({ type: [LabTestParameterDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LabTestParameterDto)
  labTestParameters: LabTestParameterDto[];

  @ApiPropertyOptional({ example: '0910.20' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  hsCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  onssaCategory?: string;
}
```

**File — create:** `src/modules/product/dto/update-product-type.dto.ts`

```ts
import { PartialType } from '@nestjs/swagger';
import { CreateProductTypeDto } from './create-product-type.dto';

export class UpdateProductTypeDto extends PartialType(CreateProductTypeDto) {}
```

---

**Batch 3 checkpoint:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 4 — US-016 Service + Controller + Module Registration

### Task 10 — US-016: `ProductTypeService`

**File — create:** `src/modules/product/services/product-type.service.ts`

```ts
import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductType } from '../entities/product-type.entity';
import { CreateProductTypeDto } from '../dto/create-product-type.dto';
import { UpdateProductTypeDto } from '../dto/update-product-type.dto';

@Injectable()
export class ProductTypeService {
  private readonly logger = new Logger(ProductTypeService.name);

  constructor(
    @InjectRepository(ProductType)
    private readonly productTypeRepo: Repository<ProductType>,
  ) {}

  /** List all active product types, paginated */
  async findAll(page = 1, limit = 20): Promise<[ProductType[], number]> {
    return this.productTypeRepo.findAndCount({
      where: { isActive: true },
      order: { nameFr: 'ASC' },
      skip: (page - 1) * limit,
      take: Math.min(limit, 100),
    });
  }

  /** Find single product type by ID */
  async findById(id: string): Promise<ProductType> {
    const pt = await this.productTypeRepo.findOne({ where: { id } });
    if (!pt) {
      throw new NotFoundException({
        code: 'PRODUCT_TYPE_NOT_FOUND',
        message: `Product type ${id} not found`,
      });
    }
    return pt;
  }

  /** Create a new product type */
  async create(dto: CreateProductTypeDto): Promise<ProductType> {
    const existing = await this.productTypeRepo.findOne({ where: { code: dto.code } });
    if (existing) {
      throw new ConflictException({
        code: 'PRODUCT_TYPE_CODE_EXISTS',
        message: `Product type code '${dto.code}' already exists`,
      });
    }
    const pt = this.productTypeRepo.create({
      ...dto,
      nameZgh: dto.nameZgh ?? null,
      hsCode: dto.hsCode ?? null,
      onssaCategory: dto.onssaCategory ?? null,
      isActive: true,
    });
    const saved = await this.productTypeRepo.save(pt);
    this.logger.log({ productTypeId: saved.id, code: saved.code }, 'Product type created');
    return saved;
  }

  /** Update a product type */
  async update(id: string, dto: UpdateProductTypeDto): Promise<ProductType> {
    await this.findById(id);
    await this.productTypeRepo.update({ id }, { ...dto });
    return this.findById(id);
  }

  /** Soft-deactivate a product type (sets isActive = false) */
  async deactivate(id: string): Promise<ProductType> {
    const pt = await this.findById(id);
    if (!pt.isActive) {
      throw new ConflictException({
        code: 'PRODUCT_TYPE_ALREADY_INACTIVE',
        message: 'Product type is already inactive',
      });
    }
    await this.productTypeRepo.update({ id }, { isActive: false });
    this.logger.log({ productTypeId: id }, 'Product type deactivated');
    return this.findById(id);
  }
}
```

---

### Task 11 — US-016: `ProductTypeController`

**File — create:** `src/modules/product/controllers/product-type.controller.ts`

```ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ProductTypeService } from '../services/product-type.service';
import { CreateProductTypeDto } from '../dto/create-product-type.dto';
import { UpdateProductTypeDto } from '../dto/update-product-type.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ProductType } from '../entities/product-type.entity';
import { PaginationDto } from '../../../common/dto/pagination.dto';

@ApiTags('product-types')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('product-types')
export class ProductTypeController {
  constructor(private readonly productTypeService: ProductTypeService) {}

  /** US-016 — List active product types */
  @Get()
  @ApiOperation({ summary: 'US-016: List active SDOQ product types' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @Query() query: PaginationDto,
  ): Promise<{ data: ProductType[]; meta: { page: number; limit: number; total: number } }> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(query.limit ?? 20, 100);
    const [data, total] = await this.productTypeService.findAll(page, limit);
    return { data, meta: { page, limit, total } };
  }

  /** US-016 — Get product type by ID */
  @Get(':id')
  @ApiOperation({ summary: 'US-016: Get product type by ID' })
  async findOne(@Param('id') id: string): Promise<ProductType> {
    return this.productTypeService.findById(id);
  }

  /** US-016 — Create product type (super-admin) */
  @Post()
  @UseGuards(RolesGuard)
  @Roles('super-admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'US-016: Create SDOQ product type (super-admin)' })
  async create(@Body() dto: CreateProductTypeDto): Promise<ProductType> {
    return this.productTypeService.create(dto);
  }

  /** US-016 — Update product type (super-admin) */
  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('super-admin')
  @ApiOperation({ summary: 'US-016: Update SDOQ product type (super-admin)' })
  async update(@Param('id') id: string, @Body() dto: UpdateProductTypeDto): Promise<ProductType> {
    return this.productTypeService.update(id, dto);
  }

  /** US-016 — Deactivate product type (super-admin) */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('super-admin')
  @ApiOperation({ summary: 'US-016: Deactivate SDOQ product type (super-admin)' })
  async deactivate(@Param('id') id: string): Promise<ProductType> {
    return this.productTypeService.deactivate(id);
  }
}
```

---

### Task 12 — US-016: Register in `ProductModule`

**File — modify:** `src/modules/product/product.module.ts`

Add `ProductTypeController` to `controllers` array and `ProductTypeService` to `providers` array.

---

**Batch 4 checkpoint:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 5 — US-044 Kafka Interface + DTO + Service + Controller + Notification Handler

### Task 13 — US-044: `InspectionInspectorAssignedEvent` interface (2 files)

**File 1 — modify:** `src/common/interfaces/events/certification.events.ts`

Add at end of file:

```ts
export interface InspectionInspectorAssignedEvent extends BaseEvent {
  inspectionId: string;
  certificationId: string;
  cooperativeId: string;
  inspectorId: string;
  inspectorName: string;
  scheduledDate: string;
  assignedBy: string;
}
```

**File 2 — modify:** `src/modules/certification/events/certification-events.ts`

Add `InspectionInspectorAssignedEvent` to the re-export list:

```ts
export type {
  // ... existing exports ...
  InspectionInspectorAssignedEvent,
} from '../../../common/interfaces/events/certification.events';
```

---

### Task 14 — US-044: `AssignInspectorDto` + `InspectionService.assignInspector()`

**File — create:** `src/modules/certification/dto/assign-inspector.dto.ts`

```ts
import { IsUUID, IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignInspectorDto {
  @ApiProperty({ description: 'Keycloak UUID of the inspector to assign' })
  @IsUUID()
  inspectorId: string;

  @ApiProperty({ description: 'Display name of the inspector', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  inspectorName: string;
}
```

**File — modify:** `src/modules/certification/services/inspection.service.ts`

Add method:

```ts
/**
 * US-044 — Assigns an inspector to a scheduled inspection.
 * Publishes certification.inspection.inspector-assigned Kafka event.
 */
async assignInspector(
  id: string,
  inspectorId: string,
  inspectorName: string,
  assignedBy: string,
  correlationId: string,
): Promise<Inspection> {
  const inspection = await this.inspectionRepo.findOne({ where: { id } });
  if (!inspection) {
    throw new NotFoundException({ code: 'INSPECTION_NOT_FOUND', message: `Inspection ${id} not found` });
  }
  if (inspection.status === 'completed' || inspection.status === 'cancelled') {
    throw new ConflictException({
      code: 'INSPECTION_ALREADY_CLOSED',
      message: `Cannot assign inspector to ${inspection.status} inspection`,
    });
  }
  await this.inspectionRepo.update({ id }, { inspectorId, inspectorName });
  const updated = await this.findById(id);
  await this.producer.publishInspectorAssigned(updated, assignedBy, correlationId);
  this.logger.log({ inspectionId: id, inspectorId, assignedBy }, 'Inspector assigned');
  return updated;
}
```

Also add `ConflictException` to the imports from `@nestjs/common`.

**File — modify:** `src/modules/certification/events/certification.producer.ts`

Add method:

```ts
/** Publish inspector assigned event (US-044) */
async publishInspectorAssigned(
  inspection: Inspection,
  assignedBy: string,
  correlationId: string,
): Promise<void> {
  const event: InspectionInspectorAssignedEvent = {
    eventId: uuidv4(),
    correlationId,
    timestamp: new Date().toISOString(),
    version: 1,
    source: 'certification',
    inspectionId: inspection.id,
    certificationId: inspection.certificationId,
    cooperativeId: inspection.cooperativeId,
    inspectorId: inspection.inspectorId,
    inspectorName: inspection.inspectorName ?? '',
    scheduledDate: inspection.scheduledDate,
    assignedBy,
  };
  try {
    await this.kafkaClient.emit('certification.inspection.inspector-assigned', event).toPromise();
    this.logger.log({ eventId: event.eventId, inspectionId: inspection.id }, 'Inspector assigned event published');
  } catch (error) {
    this.logger.error({ error, inspectionId: inspection.id }, 'Failed to publish inspector assigned event');
  }
}
```

Add `InspectionInspectorAssignedEvent` and `Inspection` entity to imports in `certification.producer.ts`.

---

### Task 15 — US-044: Controller endpoint + Notification handler

**File — modify:** `src/modules/certification/controllers/inspection.controller.ts`

Add endpoint before the existing `@Get(':id')`:

```ts
/** US-044 — Assign inspector to inspection (super-admin) */
@Put(':id/assign-inspector')
@UseGuards(RolesGuard)
@Roles('super-admin')
@ApiOperation({ summary: 'US-044: Assign inspector to an inspection (super-admin)' })
async assignInspector(
  @Param('id') id: string,
  @Body() dto: AssignInspectorDto,
  @CurrentUser() user: CurrentUserPayload,
  @Headers('x-correlation-id') correlationId = '',
): Promise<Inspection> {
  return this.inspectionService.assignInspector(
    id,
    dto.inspectorId,
    dto.inspectorName,
    user.sub,
    correlationId,
  );
}
```

Add `Put` to the `@nestjs/common` imports, and import `AssignInspectorDto`.

**File — modify:** `src/modules/notification/listeners/notification.listener.ts`

Add handler:

```ts
@EventPattern('certification.inspection.inspector-assigned')
async handleInspectorAssigned(
  @Payload() data: InspectionInspectorAssignedEvent,
  @Ctx() _context: KafkaContext,
): Promise<void> {
  try {
    this.logger.log(
      { eventId: data.eventId, inspectionId: data.inspectionId, inspectorId: data.inspectorId },
      'Inspector assigned — sending notification',
    );
    await this.notificationService.send({
      recipientId: data.inspectorId,
      channel: 'email',
      templateCode: 'inspection-assigned',
      language: 'fr-MA',
      context: {
        inspectorName: data.inspectorName,
        scheduledDate: data.scheduledDate,
        certificationId: data.certificationId,
      },
      triggerEventId: data.eventId,
      correlationId: data.correlationId,
    });
  } catch (error) {
    this.logger.error(
      { error, eventId: data.eventId },
      'Failed to process certification.inspection.inspector-assigned',
    );
  }
}
```

Add `InspectionInspectorAssignedEvent` to the imports in `notification.listener.ts`.

---

**Batch 5 checkpoint:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 6 — US-076 + US-086

### Task 16 — US-076: `NotificationStats` interface + `StatsQueryDto` + `NotificationService.getStats()`

**File — create:** `src/modules/notification/interfaces/notification-stats.interface.ts`

```ts
export interface NotificationStats {
  total: number;
  byStatus: {
    sent: number;
    failed: number;
    pending: number;
  };
  from: string | null;
  to: string | null;
  generatedAt: string;
}
```

**File — create:** `src/modules/notification/dto/stats-query.dto.ts`

```ts
import { IsOptional, IsISO8601 } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class NotificationStatsQueryDto {
  @ApiPropertyOptional({ description: 'Filter from date (ISO 8601)', example: '2026-01-01' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'Filter to date (ISO 8601)', example: '2026-12-31' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
```

**File — modify:** `src/modules/notification/services/notification.service.ts`

Add import for `DataSource` and `NotificationStats` interface, then add method:

```ts
/**
 * US-076 — Returns notification delivery counts grouped by status.
 * Redis-cached for 300s. Key: stats:notifications:{from|all}:{to|all}
 */
async getStats(from?: string, to?: string): Promise<NotificationStats> {
  const cacheKey = `stats:notifications:${from ?? 'all'}:${to ?? 'all'}`;
  const cached = await this.cacheManager.get<NotificationStats>(cacheKey);
  if (cached) return cached;

  const qb = this.notificationRepo
    .createQueryBuilder('n')
    .select('n.status', 'status')
    .addSelect('COUNT(*)', 'count')
    .groupBy('n.status');

  if (from) qb.andWhere('n.created_at >= :from', { from });
  if (to) qb.andWhere('n.created_at <= :to', { to });

  const rows: Array<{ status: string; count: string }> = await qb.getRawMany();

  const byStatus = { sent: 0, failed: 0, pending: 0 };
  let total = 0;
  for (const row of rows) {
    const count = Number(row.count);
    total += count;
    if (row.status === 'sent') byStatus.sent = count;
    else if (row.status === 'failed') byStatus.failed = count;
    else if (row.status === 'pending') byStatus.pending = count;
  }

  const result: NotificationStats = {
    total,
    byStatus,
    from: from ?? null,
    to: to ?? null,
    generatedAt: new Date().toISOString(),
  };

  await this.cacheManager.set(cacheKey, result, 300_000);
  return result;
}
```

---

### Task 17 — US-076: `GET /notifications/stats` endpoint

**File — modify:** `src/modules/notification/controllers/notification.controller.ts`

Add import for `RolesGuard`, `Roles`, `NotificationStatsQueryDto`, and `NotificationStats`.

Add endpoint **before** `@Get('history')` (to avoid route conflicts):

```ts
/** US-076 — Notification delivery stats (super-admin) */
@Get('stats')
@UseGuards(RolesGuard)
@Roles('super-admin')
@ApiOperation({ summary: 'US-076: Notification delivery counts by status (super-admin)' })
@ApiQuery({ name: 'from', required: false, type: String })
@ApiQuery({ name: 'to', required: false, type: String })
async getStats(@Query() query: NotificationStatsQueryDto): Promise<NotificationStats> {
  return this.notificationService.getStats(query.from, query.to);
}
```

---

### Task 18 — US-086: `UserController` + `AppModule` registration

**File — create:** `src/common/controllers/user.controller.ts`

```ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../decorators/current-user.decorator';

/**
 * User controller — read-only view of the authenticated user's profile and roles.
 * US-086: Roles are read from the Keycloak JWT (realm_access.roles claim).
 * No Keycloak Admin API call — YAGNI for v1.
 */
@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  /** US-086 — Get current user profile (id, email, roles, cooperative_id) */
  @Get('me')
  @ApiOperation({ summary: 'US-086: Get current user profile from JWT claims' })
  getMe(@CurrentUser() user: CurrentUserPayload): CurrentUserPayload {
    return user;
  }

  /** US-086 — Get current user role list */
  @Get('me/roles')
  @ApiOperation({ summary: 'US-086: Get current user Keycloak roles' })
  getMyRoles(@CurrentUser() user: CurrentUserPayload): { roles: string[] } {
    const roles: string[] =
      (user as unknown as { realm_access?: { roles?: string[] } })?.realm_access?.roles ?? [];
    return { roles };
  }
}
```

**File — modify:** `src/app.module.ts`

Add `UserController` to the `controllers` array (or import and include in the module).

---

**Batch 6 checkpoint:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 7 — Unit Tests (Part 1): US-010, US-016

### Task 19 — Tests: `CooperativeService.deactivate()`

**File — modify:** `test/unit/cooperative/cooperative.service.spec.ts`

Add test suite `describe('deactivate')`:

```
- should set status to suspended and publish Kafka event
- should throw ConflictException if cooperative is already suspended
- should throw NotFoundException if cooperative not found
```

Mock `producer.publishCooperativeDeactivated` as `jest.fn().mockResolvedValue(undefined)`.

---

### Task 20 — Tests: `ProductTypeService`

**File — create:** `test/unit/product/product-type.service.spec.ts`

Test cases:

```
describe('findAll') — returns paginated active types
describe('findById') — returns type; throws NotFoundException for unknown id
describe('create') — saves and returns; throws ConflictException on duplicate code
describe('update') — calls update and returns fresh record; throws NotFoundException
describe('deactivate') — sets isActive=false; throws ConflictException if already inactive
```

Total: ~8 test cases.

---

**Batch 7 checkpoint:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 8 — Unit Tests (Part 2): US-044, US-076, US-086

### Task 21 — Tests: `InspectionService.assignInspector()`

**File — modify:** `test/unit/certification/inspection.service.spec.ts` (create if not exists)

Add test suite `describe('assignInspector')`:

```
- should update inspectorId/Name and publish Kafka event
- should throw ConflictException for completed inspection
- should throw ConflictException for cancelled inspection
- should throw NotFoundException for unknown inspection id
```

---

### Task 22 — Tests: `NotificationService.getStats()`

**File — modify:** `test/unit/notification/notification.service.spec.ts`

Add test suite `describe('getStats')`:

```
- should return cached result on cache hit
- should query DB, cache result, and return stats on cache miss
- should apply from/to date filter to query
```

Mock `notificationRepo.createQueryBuilder` chain returning sample rows.

---

### Task 23 — Tests: `UserController`

**File — create:** `test/unit/common/user.controller.spec.ts`

Test cases:

```
describe('getMe') — returns CurrentUserPayload from decorator
describe('getMyRoles') — extracts realm_access.roles from payload; returns [] when missing
```

---

**Batch 8 checkpoint:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Post-Sprint Checklist

- [ ] Backlog: mark US-010, US-016, US-044, US-076, US-086 as Done in `PRODUCT-BACKLOG.md`
- [ ] TM-3: If Docker available — run migration and document result; else mark deferred (3rd time)
- [ ] Font assets: Amiri + DejaVu still needed in `assets/fonts/` for PDF generation at runtime
- [ ] Update `current-state.json` and daily log
- [ ] Run `/sprint-status`, `/retro`, `/daily-standup`

---

## Summary Table

| Batch | Tasks | Stories                      | Verifies with        |
| ----- | ----- | ---------------------------- | -------------------- |
| 1     | 1–3   | TM-3, US-010                 | typecheck + lint     |
| 2     | 4–6   | US-010                       | full unit test suite |
| 3     | 7–9   | US-016                       | typecheck + lint     |
| 4     | 10–12 | US-016                       | full unit test suite |
| 5     | 13–15 | US-044                       | full unit test suite |
| 6     | 16–18 | US-076, US-086               | full unit test suite |
| 7     | 19–20 | US-010, US-016 tests         | full unit test suite |
| 8     | 21–23 | US-044, US-076, US-086 tests | full unit test suite |

**Target:** 23 tasks, 8 batches, ~20 new unit tests, suite grows from 271 → ~291 tests.
