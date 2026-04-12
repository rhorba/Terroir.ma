# Sprint 6 Implementation Plan — PDF Certificate, Stats, Export View & Notification Templates

> **For Claude:** Use /execute to implement this plan task-by-task.

**Goal:** Deliver US-047 (PDF cert), US-048 (certification stats), US-067 (export clearances view), US-075 (notification template management), and TM-3 (migration verification) — 22 SP.

**Architecture:** certification module (US-047/048/067), notification module (US-075), infra (TM-3). No new Kafka events. No new entities. No cross-module imports.

**Tech Stack:** NestJS, TypeScript, PostgreSQL, Redis (`@nestjs/cache-manager`), PDFKit, Keycloak

**Modules Affected:** certification, notification

**Estimated Story Points:** 22

---

## Batch 1 — TM-3 + US-067 (4 SP)

### Task 1.1 — TM-3: Run migration chain verification

**Command (requires Docker):**

```bash
docker compose --profile core up -d postgres
npm run migration:run
npm run migration:generate -- --check
docker compose --profile core down
```

**Pass criterion:** `migration:generate -- --check` outputs `No changes in database schema were found`.
Record result in `docs/plans/2026-04-12-sprint-6/progress.md`.

---

### Task 1.2 — US-067: Add `findAll()` to `ExportDocumentService`

**File:** `src/modules/certification/services/export-document.service.ts`

Add after `findByCooperativePaginated()`:

```ts
/**
 * Returns all export documents across all cooperatives (super-admin view).
 * US-067
 */
async findAll(page: number, limit: number): Promise<PagedResult<ExportDocument>> {
  const [data, total] = await this.exportDocRepo.findAndCount({
    order: { createdAt: 'DESC' },
    skip: (page - 1) * limit,
    take: limit,
  });
  return { data, meta: { page, limit, total } };
}
```

---

### Task 1.3 — US-067: Add `GET /export-documents` endpoint (super-admin)

**File:** `src/modules/certification/controllers/export-document.controller.ts`

Add **before** the existing `@Get('my')` handler (top of route list):

```ts
/**
 * US-067 — Super-admin views all export clearances across all cooperatives.
 */
@Get()
@UseGuards(RolesGuard)
@Roles('super-admin')
@ApiOperation({ summary: 'US-067: List all export documents (super-admin)' })
@ApiQuery({ name: 'page', required: false, type: Number })
@ApiQuery({ name: 'limit', required: false, type: Number })
async findAll(@Query() query: PaginationDto): Promise<PagedResult<ExportDocument>> {
  return this.exportDocumentService.findAll(query.page, query.limit);
}
```

---

### Task 1.4 — Batch 1 checkpoint

```bash
npm run lint
npm run typecheck
npm run test:unit
```

All 245 existing tests must pass. No new failures.

---

## Batch 2 — US-048: Certification Statistics (5 SP)

### Task 2.1 — Add `CertificationStats` interface

**File:** `src/modules/certification/interfaces/certification-stats.interface.ts` _(new)_

```ts
export interface StatusCount {
  status: string;
  count: number;
}

export interface RegionCount {
  regionCode: string;
  count: number;
}

export interface ProductTypeCount {
  productTypeCode: string;
  count: number;
}

export interface CertificationStats {
  period: { from: string | null; to: string | null };
  byStatus: StatusCount[];
  byRegion: RegionCount[];
  byProductType: ProductTypeCount[];
}
```

---

### Task 2.2 — Add `StatsQueryDto`

**File:** `src/modules/certification/dto/stats-query.dto.ts` _(new)_

```ts
import { IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class StatsQueryDto {
  @ApiPropertyOptional({ example: '2026-01-01', description: 'Start date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'End date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
```

---

### Task 2.3 — Add `getStats()` to `CertificationService`

**File:** `src/modules/certification/services/certification.service.ts`

1. Add `CACHE_MANAGER` injection to constructor:

```ts
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { CertificationStats } from '../interfaces/certification-stats.interface';
```

In constructor, add:

```ts
@Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
```

2. Add method after existing `findByCooperativePaginated()`:

```ts
/**
 * Returns certification counts by status, region, and product type.
 * Results cached in Redis for 300s. US-048.
 */
async getStats(from?: string, to?: string): Promise<CertificationStats> {
  const fromKey = from ?? 'all';
  const toKey = to ?? 'all';
  const cacheKey = `stats:certifications:${fromKey}:${toKey}`;

  const cached = await this.cacheManager.get<CertificationStats>(cacheKey);
  if (cached) return cached;

  const dateFilter = from && to
    ? `WHERE requested_at BETWEEN '${from}'::date AND '${to}'::date`
    : '';

  const [byStatus, byRegion, byProductType] = await Promise.all([
    this.dataSource.query<{ current_status: string; count: string }[]>(
      `SELECT current_status, COUNT(*)::int AS count
       FROM certification.certification ${dateFilter}
       GROUP BY current_status ORDER BY count DESC`,
    ),
    this.dataSource.query<{ region_code: string; count: string }[]>(
      `SELECT region_code, COUNT(*)::int AS count
       FROM certification.certification ${dateFilter}
       GROUP BY region_code ORDER BY count DESC`,
    ),
    this.dataSource.query<{ product_type_code: string; count: string }[]>(
      `SELECT product_type_code, COUNT(*)::int AS count
       FROM certification.certification ${dateFilter}
       GROUP BY product_type_code ORDER BY count DESC`,
    ),
  ]);

  const stats: CertificationStats = {
    period: { from: from ?? null, to: to ?? null },
    byStatus: byStatus.map(r => ({ status: r.current_status, count: Number(r.count) })),
    byRegion: byRegion.map(r => ({ regionCode: r.region_code, count: Number(r.count) })),
    byProductType: byProductType.map(r => ({ productTypeCode: r.product_type_code, count: Number(r.count) })),
  };

  await this.cacheManager.set(cacheKey, stats, 300_000);
  return stats;
}
```

> **SQL injection note:** `from`/`to` are validated as `@IsDateString()` in the DTO before reaching the service. The raw interpolation is safe given that guard. For extra safety, use parameterized form: `WHERE requested_at BETWEEN $1::date AND $2::date` with `[from, to]` as second arg to `dataSource.query()`.
>
> **Preferred parameterized version:**
>
> ```ts
> const params = from && to ? [from, to] : [];
> const dateFilter = from && to ? `WHERE requested_at BETWEEN $1::date AND $2::date` : '';
> // pass params as second argument to each dataSource.query() call
> ```

---

### Task 2.4 — Add `GET /certifications/stats` endpoint

**File:** `src/modules/certification/controllers/certification.controller.ts`

Add **before** `@Get('pending')` (must appear before any `@Get(':id')` route):

```ts
import { StatsQueryDto } from '../dto/stats-query.dto';
import { CertificationStats } from '../interfaces/certification-stats.interface';
```

```ts
/**
 * US-048 — Super-admin views certification statistics by status, region, and product type.
 * Results cached in Redis for 5 minutes.
 */
@Get('stats')
@UseGuards(RolesGuard)
@Roles('super-admin')
@ApiOperation({ summary: 'US-048: Certification statistics by status / region / product type' })
@ApiQuery({ name: 'from', required: false, type: String, description: 'YYYY-MM-DD' })
@ApiQuery({ name: 'to', required: false, type: String, description: 'YYYY-MM-DD' })
async getStats(@Query() query: StatsQueryDto): Promise<CertificationStats> {
  return this.certificationService.getStats(query.from, query.to);
}
```

---

### Task 2.5 — Batch 2 checkpoint

```bash
npm run lint
npm run typecheck
npm run test:unit
```

---

## Batch 3 — US-047: PDF Certificate (5 SP)

### Task 3.1 — Install PDFKit

```bash
npm install pdfkit
npm install --save-dev @types/pdfkit
```

Verify `package.json` has `"pdfkit"` in `dependencies` and `"@types/pdfkit"` in `devDependencies`.

---

### Task 3.2 — Add font assets

Create directory `assets/fonts/` and place two font files:

- `assets/fonts/Amiri-Regular.ttf` — Arabic font (download from Google Fonts / amiri-font.github.io, OFL licensed)
- `assets/fonts/DejaVuSans.ttf` — Latin + Tifinagh (download from dejavu-fonts.github.io, free license)

> **Note on Arabic shaping:** PDFKit renders Arabic using the font glyphs as-is. For proper Arabic ligature shaping (connecting letters), the `pdfkit-arabic` npm package can be added as a Phase 2 enhancement. For v1, Amiri-Regular renders legibly with `align: 'right'`.

---

### Task 3.3 — Create `CertificationPdfService`

**File:** `src/modules/certification/services/certification-pdf.service.ts` _(new)_

```ts
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import * as path from 'path';
import { Certification, CertificationStatus } from '../entities/certification.entity';
import { QrCode } from '../entities/qr-code.entity';

/**
 * Generates a trilingual (FR / AR / ZGH) PDF conformity certificate using PDFKit.
 * Font assets: assets/fonts/Amiri-Regular.ttf (Arabic), assets/fonts/DejaVuSans.ttf (Latin/Tifinagh).
 * US-047
 */
@Injectable()
export class CertificationPdfService {
  private readonly logger = new Logger(CertificationPdfService.name);
  private readonly fontsDir = path.join(process.cwd(), 'assets', 'fonts');

  constructor(
    @InjectRepository(Certification)
    private readonly certRepo: Repository<Certification>,
    @InjectRepository(QrCode)
    private readonly qrCodeRepo: Repository<QrCode>,
  ) {}

  /**
   * Generates a PDF certificate for a GRANTED or RENEWED certification.
   * Returns a Buffer suitable for StreamableFile.
   */
  async generateCertificatePdf(certificationId: string): Promise<Buffer> {
    const cert = await this.certRepo.findOne({ where: { id: certificationId } });
    if (!cert) {
      throw new NotFoundException({
        code: 'CERTIFICATION_NOT_FOUND',
        message: `Certification ${certificationId} not found`,
      });
    }
    if (
      cert.currentStatus !== CertificationStatus.GRANTED &&
      cert.currentStatus !== CertificationStatus.RENEWED
    ) {
      throw new NotFoundException({
        code: 'CERTIFICATION_NOT_GRANTED',
        message: 'PDF only available for GRANTED or RENEWED certifications',
      });
    }

    const qrCode = await this.qrCodeRepo.findOne({
      where: { certificationId, isActive: true },
    });

    const verifyUrl = qrCode?.verificationUrl ?? '';
    const qrBuffer = verifyUrl ? await QRCode.toBuffer(verifyUrl, { width: 80 }) : null;

    return this.buildPdf(cert, qrBuffer);
  }

  private buildPdf(cert: Certification, qrBuffer: Buffer | null): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const amiri = path.join(this.fontsDir, 'Amiri-Regular.ttf');
      const dejavu = path.join(this.fontsDir, 'DejaVuSans.ttf');

      doc.registerFont('Amiri', amiri);
      doc.registerFont('DejaVu', dejavu);

      const formatDate = (d: string | Date | null): string => {
        if (!d) return '—';
        const date = typeof d === 'string' ? new Date(d) : d;
        return date.toLocaleDateString('fr-MA', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
      };

      // ── Title bar ───────────────────────────────────────────
      doc
        .font('DejaVu')
        .fontSize(18)
        .fillColor('#1a5276')
        .text('TERROIR.MA — Plateforme de Certification SDOQ', { align: 'center' });
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#1a5276');
      doc.moveDown(0.5);

      // ── Trilingual header ────────────────────────────────────
      doc
        .font('DejaVu')
        .fontSize(14)
        .fillColor('#000')
        .text('CERTIFICAT DE CONFORMITÉ', { align: 'center' });
      doc.font('Amiri').fontSize(14).text('شهادة المطابقة', { align: 'right' });
      doc.font('DejaVu').fontSize(12).text('ⴰⵙⵉⴼⵍⵍ ⵏ ⵓⵎⴷⵢⴰⵣ', { align: 'center' });
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#aaa');
      doc.moveDown(0.5);

      // ── Certificate fields ───────────────────────────────────
      const field = (labelFr: string, labelAr: string, value: string) => {
        doc
          .font('DejaVu')
          .fontSize(10)
          .fillColor('#555')
          .text(`${labelFr} / `, { continued: true });
        doc.font('Amiri').fontSize(10).fillColor('#555').text(`${labelAr}:  `, { continued: true });
        doc.font('DejaVu').fontSize(10).fillColor('#000').text(value);
      };

      field('Numéro', 'رقم الشهادة', cert.certificationNumber ?? '—');
      field('Coopérative', 'التعاونية', cert.cooperativeName);
      field('Produit', 'المنتج', cert.productTypeCode);
      field('Type SDOQ', 'نوع التصنيف', cert.certificationType);
      field('Région', 'الجهة', cert.regionCode);
      field(
        'Valide du',
        'صالح من',
        `${formatDate(cert.validFrom)} → ${formatDate(cert.validUntil)}`,
      );
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#aaa');
      doc.moveDown(0.5);

      // ── QR code ──────────────────────────────────────────────
      if (qrBuffer) {
        doc.image(qrBuffer, { fit: [80, 80], align: 'center' });
        doc.moveDown(0.3);
        doc
          .font('DejaVu')
          .fontSize(8)
          .fillColor('#888')
          .text('Scanner pour vérifier / امسح للتحقق', { align: 'center' });
        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#aaa');
        doc.moveDown(0.5);
      }

      // ── Issue date ───────────────────────────────────────────
      field('Délivré le', 'تاريخ الإصدار', formatDate(cert.grantedAt));

      doc.end();
    });
  }
}
```

---

### Task 3.4 — Register `CertificationPdfService` in `CertificationModule`

**File:** `src/modules/certification/certification.module.ts`

Add to `providers` array:

```ts
import { CertificationPdfService } from './services/certification-pdf.service';
// ...
providers: [
  CertificationService,
  InspectionService,
  QrCodeService,
  ExportDocumentService,
  CertificationPdfService,   // ← add
  CertificationProducer,
],
```

---

### Task 3.5 — Add `GET /certifications/:id/certificate.pdf` endpoint

**File:** `src/modules/certification/controllers/certification.controller.ts`

Add imports:

```ts
import { Res, StreamableFile } from '@nestjs/common';
import { Response } from 'express';
import { CertificationPdfService } from '../services/certification-pdf.service';
```

Inject in constructor:

```ts
constructor(
  private readonly certificationService: CertificationService,
  private readonly certificationPdfService: CertificationPdfService,
) {}
```

Add **after** `GET /stats` and **before** `GET /:id`:

```ts
/**
 * US-047 — Generate and download a trilingual PDF conformity certificate.
 * Available for GRANTED and RENEWED certifications only.
 */
@Get(':id/certificate.pdf')
@UseGuards(RolesGuard)
@Roles('cooperative-admin', 'certification-body', 'super-admin')
@ApiOperation({ summary: 'US-047: Download PDF conformity certificate (AR/FR/ZGH)' })
@ApiParam({ name: 'id', description: 'Certification UUID' })
async downloadCertificatePdf(
  @Param('id') id: string,
  @Res({ passthrough: true }) res: Response,
): Promise<StreamableFile> {
  const buffer = await this.certificationPdfService.generateCertificatePdf(id);
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': 'attachment; filename="certificate.pdf"',
  });
  return new StreamableFile(buffer);
}
```

---

### Task 3.6 — Batch 3 checkpoint

```bash
npm run lint
npm run typecheck
npm run test:unit
```

---

## Batch 4 — US-075: Notification Template Management (8 SP)

### Task 4.1 — Create `CreateNotificationTemplateDto`

**File:** `src/modules/notification/dto/create-notification-template.dto.ts` _(new)_

```ts
import { IsString, IsIn, IsOptional, IsBoolean, Length, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNotificationTemplateDto {
  @ApiProperty({
    example: 'certification-granted',
    description: 'Template code matching notification event',
  })
  @IsString()
  @Length(1, 100)
  code: string;

  @ApiProperty({ example: 'email', enum: ['email', 'sms'] })
  @IsIn(['email', 'sms'])
  channel: string;

  @ApiProperty({ example: 'fr-MA', enum: ['fr-MA', 'ar-MA', 'zgh'] })
  @IsIn(['fr-MA', 'ar-MA', 'zgh'])
  language: string;

  @ApiPropertyOptional({ example: 'Votre certificat {{certificationNumber}} a été délivré' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  subjectTemplate?: string;

  @ApiProperty({ example: '<p>Bonjour {{cooperativeName}},</p>' })
  @IsString()
  bodyTemplate: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
```

---

### Task 4.2 — Create `UpdateNotificationTemplateDto`

**File:** `src/modules/notification/dto/update-notification-template.dto.ts` _(new)_

```ts
import { PartialType } from '@nestjs/swagger';
import { CreateNotificationTemplateDto } from './create-notification-template.dto';

export class UpdateNotificationTemplateDto extends PartialType(CreateNotificationTemplateDto) {}
```

---

### Task 4.3 — Create `NotificationTemplateService`

**File:** `src/modules/notification/services/notification-template.service.ts` _(new)_

```ts
import { Injectable, NotFoundException, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import * as fs from 'fs';
import * as path from 'path';
import { NotificationTemplate } from '../entities/notification-template.entity';
import { CreateNotificationTemplateDto } from '../dto/create-notification-template.dto';
import { UpdateNotificationTemplateDto } from '../dto/update-notification-template.dto';

/**
 * Manages notification templates with DB-override + file fallback pattern.
 * Redis cache key: template:{code}:{channel}:{language}, TTL 600s.
 * US-075
 */
@Injectable()
export class NotificationTemplateService implements OnModuleInit {
  private readonly logger = new Logger(NotificationTemplateService.name);
  private readonly templatesDir = path.join(process.cwd(), 'assets', 'templates');

  constructor(
    @InjectRepository(NotificationTemplate)
    private readonly templateRepo: Repository<NotificationTemplate>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /** On startup, seed DB from .hbs files for any missing template records. */
  async onModuleInit(): Promise<void> {
    await this.seedFromFiles();
  }

  private async seedFromFiles(): Promise<void> {
    if (!fs.existsSync(this.templatesDir)) return;
    const files = fs.readdirSync(this.templatesDir).filter((f) => f.endsWith('.hbs'));
    for (const file of files) {
      // filename convention: {code}.{channel}.{language}.hbs
      const parts = file.replace('.hbs', '').split('.');
      if (parts.length < 3) continue;
      const language = parts.pop()!;
      const channel = parts.pop()!;
      const code = parts.join('.');
      const exists = await this.templateRepo.findOne({ where: { code, channel, language } });
      if (!exists) {
        const bodyTemplate = fs.readFileSync(path.join(this.templatesDir, file), 'utf8');
        await this.templateRepo.save(
          this.templateRepo.create({ code, channel, language, bodyTemplate, isActive: true }),
        );
        this.logger.log({ code, channel, language }, 'Template seeded from file');
      }
    }
  }

  async findAll(filters: {
    code?: string;
    channel?: string;
    language?: string;
  }): Promise<NotificationTemplate[]> {
    const where: Record<string, string> = {};
    if (filters.code) where['code'] = filters.code;
    if (filters.channel) where['channel'] = filters.channel;
    if (filters.language) where['language'] = filters.language;
    return this.templateRepo.find({ where, order: { code: 'ASC', language: 'ASC' } });
  }

  async findById(id: string): Promise<NotificationTemplate> {
    const t = await this.templateRepo.findOne({ where: { id } });
    if (!t)
      throw new NotFoundException({
        code: 'TEMPLATE_NOT_FOUND',
        message: `Template ${id} not found`,
      });
    return t;
  }

  async create(dto: CreateNotificationTemplateDto): Promise<NotificationTemplate> {
    const template = this.templateRepo.create({ ...dto, isActive: dto.isActive ?? true });
    return this.templateRepo.save(template);
  }

  async update(id: string, dto: UpdateNotificationTemplateDto): Promise<NotificationTemplate> {
    const existing = await this.findById(id);
    const updated = await this.templateRepo.save({ ...existing, ...dto });
    await this.cacheManager.del(`template:${updated.code}:${updated.channel}:${updated.language}`);
    return updated;
  }

  /** Soft-delete: sets isActive = false and invalidates cache. */
  async deactivate(id: string): Promise<NotificationTemplate> {
    const existing = await this.findById(id);
    const updated = await this.templateRepo.save({ ...existing, isActive: false });
    await this.cacheManager.del(`template:${updated.code}:${updated.channel}:${updated.language}`);
    return updated;
  }

  /** Manually trigger seed (useful after adding new .hbs files). */
  async seed(): Promise<{ seeded: number }> {
    if (!fs.existsSync(this.templatesDir)) return { seeded: 0 };
    const before = await this.templateRepo.count();
    await this.seedFromFiles();
    const after = await this.templateRepo.count();
    return { seeded: after - before };
  }
}
```

---

### Task 4.4 — Create `NotificationTemplateController`

**File:** `src/modules/notification/controllers/notification-template.controller.ts` _(new)_

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
import { NotificationTemplateService } from '../services/notification-template.service';
import { CreateNotificationTemplateDto } from '../dto/create-notification-template.dto';
import { UpdateNotificationTemplateDto } from '../dto/update-notification-template.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { NotificationTemplate } from '../entities/notification-template.entity';

@ApiTags('notification-templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super-admin')
@Controller('notification-templates')
export class NotificationTemplateController {
  constructor(private readonly templateService: NotificationTemplateService) {}

  @Get()
  @ApiOperation({ summary: 'US-075: List notification templates (filterable)' })
  @ApiQuery({ name: 'code', required: false })
  @ApiQuery({ name: 'channel', required: false })
  @ApiQuery({ name: 'language', required: false })
  async findAll(
    @Query('code') code?: string,
    @Query('channel') channel?: string,
    @Query('language') language?: string,
  ): Promise<NotificationTemplate[]> {
    return this.templateService.findAll({ code, channel, language });
  }

  @Get(':id')
  @ApiOperation({ summary: 'US-075: Get notification template by ID' })
  async findOne(@Param('id') id: string): Promise<NotificationTemplate> {
    return this.templateService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'US-075: Create notification template' })
  async create(@Body() dto: CreateNotificationTemplateDto): Promise<NotificationTemplate> {
    return this.templateService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'US-075: Update notification template (invalidates cache)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateNotificationTemplateDto,
  ): Promise<NotificationTemplate> {
    return this.templateService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'US-075: Deactivate notification template (soft delete)' })
  async deactivate(@Param('id') id: string): Promise<NotificationTemplate> {
    return this.templateService.deactivate(id);
  }

  @Post('seed')
  @ApiOperation({ summary: 'US-075: Seed templates from .hbs files into DB' })
  async seed(): Promise<{ seeded: number }> {
    return this.templateService.seed();
  }
}
```

---

### Task 4.5 — Update `NotificationService.send()` with Redis cache + file fallback

**File:** `src/modules/notification/services/notification.service.ts`

1. Add imports:

```ts
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import * as fs from 'fs';
import * as path from 'path';
```

2. Add `cacheManager` to constructor:

```ts
@Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
```

3. Replace the existing template lookup block in `send()` (the `templateRepo.findOne` call) with:

```ts
const language = opts.language ?? 'fr-MA';
const cacheKey = `template:${opts.templateCode}:${opts.channel}:${language}`;

// 1. Redis cache check
let template = await this.cacheManager.get<NotificationTemplate>(cacheKey);

if (!template) {
  // 2. DB lookup
  const dbTemplate = await this.templateRepo.findOne({
    where: { code: opts.templateCode, channel: opts.channel, language, isActive: true },
  });

  if (dbTemplate) {
    await this.cacheManager.set(cacheKey, dbTemplate, 600_000);
    template = dbTemplate;
  } else {
    // 3. File fallback
    const filePath = path.join(
      process.cwd(),
      'assets',
      'templates',
      `${opts.templateCode}.${opts.channel}.${language}.hbs`,
    );
    if (fs.existsSync(filePath)) {
      const bodyTemplate = fs.readFileSync(filePath, 'utf8');
      template = {
        code: opts.templateCode,
        channel: opts.channel,
        language,
        bodyTemplate,
        subjectTemplate: null,
        isActive: true,
      } as NotificationTemplate;
    }
  }
}

if (!template) {
  this.logger.warn(
    { templateCode: opts.templateCode, channel: opts.channel, language },
    'Notification template not found — skipping',
  );
  return;
}
```

---

### Task 4.6 — Update `NotificationModule`

**File:** `src/modules/notification/notification.module.ts`

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-yet';
import { NotificationService } from './services/notification.service';
import { NotificationTemplateService } from './services/notification-template.service';
import { EmailService } from './services/email.service';
import { SmsService } from './services/sms.service';
import { Notification } from './entities/notification.entity';
import { NotificationTemplate } from './entities/notification-template.entity';
import { NotificationListener } from './listeners/notification.listener';
import { NotificationController } from './controllers/notification.controller';
import { NotificationTemplateController } from './controllers/notification-template.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, NotificationTemplate]),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        store: redisStore,
        url: config.get<string>('redis.url'),
        ttl: 0,
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [NotificationController, NotificationTemplateController],
  providers: [
    NotificationService,
    NotificationTemplateService,
    EmailService,
    SmsService,
    NotificationListener,
  ],
  exports: [],
})
export class NotificationModule {}
```

---

### Task 4.7 — Batch 4 checkpoint

```bash
npm run lint
npm run typecheck
npm run test:unit
```

---

## Batch 5 — Tests: Certification (US-047, US-048, US-067)

### Task 5.1 — New spec: `certification-pdf.service.spec.ts`

**File:** `test/unit/certification/certification-pdf.service.spec.ts` _(new)_

Test cases:

- `generateCertificatePdf()` — returns `Buffer` when cert is `GRANTED`
- `generateCertificatePdf()` — returns `Buffer` when cert is `RENEWED`
- `generateCertificatePdf()` — throws `NotFoundException` when cert not found
- `generateCertificatePdf()` — throws `NotFoundException` when cert status is `SUBMITTED`
- `generateCertificatePdf()` — handles null `qrCode` (no active QR code, no QR image in PDF)
- `buildPdf` private logic — PDF contains valid Buffer (length > 0)

Mock pattern:

```ts
jest.mock('pdfkit', () => {
  return jest.fn().mockImplementation(() => {
    const { EventEmitter } = require('events');
    const emitter = new EventEmitter();
    const doc = Object.assign(emitter, {
      registerFont: jest.fn().mockReturnThis(),
      font: jest.fn().mockReturnThis(),
      fontSize: jest.fn().mockReturnThis(),
      fillColor: jest.fn().mockReturnThis(),
      text: jest.fn().mockReturnThis(),
      moveDown: jest.fn().mockReturnThis(),
      moveTo: jest.fn().mockReturnThis(),
      lineTo: jest.fn().mockReturnThis(),
      stroke: jest.fn().mockReturnThis(),
      image: jest.fn().mockReturnThis(),
      end: jest.fn().mockImplementation(function () {
        this.emit('data', Buffer.from('pdf-chunk'));
        this.emit('end');
      }),
      y: 100,
    });
    return doc;
  });
});

jest.mock('qrcode', () => ({ toBuffer: jest.fn().mockResolvedValue(Buffer.from('qr')) }));
```

---

### Task 5.2 — Extend `certification.service.spec.ts` for `getStats()`

**File:** `test/unit/certification/certification.service.spec.ts`

Add to mock setup:

```ts
const mockCacheManager = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
// In providers: { provide: CACHE_MANAGER, useValue: mockCacheManager }
```

Add `dataSource.query` mock to existing `makeDataSource()`:

```ts
query: jest.fn(),
```

Test cases to add:

- `getStats()` — returns stats from Redis cache when cache hit
- `getStats()` — queries DB and caches result when cache miss
- `getStats()` — applies date range filter when `from`/`to` provided
- `getStats()` — uses `'all'` as cache key part when no date range

---

### Task 5.3 — Extend `export-document.service.spec.ts` for `findAll()`

**File:** `test/unit/certification/export-document.service.spec.ts`

Add `findAndCount` mock (already present from Sprint 5). Add test cases:

- `findAll()` — returns paginated result across all cooperatives
- `findAll()` — returns empty result when no documents exist

---

### Task 5.4 — Batch 5 checkpoint

```bash
npm run lint
npm run typecheck
npm run test:unit
```

---

## Batch 6 — Tests: Notification (US-075)

### Task 6.1 — New spec: `notification-template.service.spec.ts`

**File:** `test/unit/notification/notification-template.service.spec.ts` _(new)_

Mock setup:

```ts
const makeRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  count: jest.fn(),
});
const mockCacheManager = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
```

Test cases:

- `findAll()` — returns templates with no filters
- `findAll()` — passes code/channel/language filters to repo
- `findById()` — returns template when found
- `findById()` — throws `NotFoundException` when not found
- `create()` — creates and saves template with `isActive: true` default
- `update()` — merges fields and invalidates Redis cache key
- `deactivate()` — sets `isActive: false` and invalidates Redis cache key
- `seed()` — returns `{ seeded: 0 }` when templates dir does not exist
- `onModuleInit()` — calls `seedFromFiles()` without throwing

---

### Task 6.2 — Extend `notification.service.spec.ts` for Redis + file fallback

**File:** `test/unit/notification/notification.service.spec.ts`

Add `mockCacheManager` to providers. Add test cases:

- `send()` — uses cached template from Redis when cache hit (no DB query)
- `send()` — queries DB, caches result, and sends when Redis miss + DB hit
- `send()` — reads `.hbs` file and sends when Redis miss + DB miss + file exists
- `send()` — logs warn and skips when Redis miss + DB miss + file missing

---

### Task 6.3 — Final checkpoint

```bash
npm run lint
npm run typecheck
npm run test:unit
```

**Pass criterion:** all tests pass, coverage statements ≥ 98%, branches ≥ 85%.

---

## Testing Tasks Summary

| File                                                           | Type   | Story  | New Tests (est.)  |
| -------------------------------------------------------------- | ------ | ------ | ----------------- |
| `test/unit/certification/certification-pdf.service.spec.ts`    | New    | US-047 | 6                 |
| `test/unit/certification/certification.service.spec.ts`        | Extend | US-048 | 4                 |
| `test/unit/certification/export-document.service.spec.ts`      | Extend | US-067 | 2                 |
| `test/unit/notification/notification-template.service.spec.ts` | New    | US-075 | 9                 |
| `test/unit/notification/notification.service.spec.ts`          | Extend | US-075 | 4                 |
| **Total**                                                      |        |        | **~25 new tests** |

**Projected test suite after Sprint 6:** ~270 tests across 25 suites.

---

## No-New-Migration Confirmation

`NotificationTemplate` entity already has all required columns (`code`, `channel`, `language`, `subjectTemplate`, `bodyTemplate`, `isActive`) — covered by the existing Sprint 1 migration. No `TypeORM` migration task required for Sprint 6.

---

## New Files Summary

| File                                                                       | Purpose                        |
| -------------------------------------------------------------------------- | ------------------------------ |
| `assets/fonts/Amiri-Regular.ttf`                                           | Arabic font for PDFKit         |
| `assets/fonts/DejaVuSans.ttf`                                              | Latin/Tifinagh font for PDFKit |
| `src/modules/certification/interfaces/certification-stats.interface.ts`    | Stats response types           |
| `src/modules/certification/dto/stats-query.dto.ts`                         | Date range query params        |
| `src/modules/certification/services/certification-pdf.service.ts`          | PDF generation (PDFKit)        |
| `src/modules/notification/dto/create-notification-template.dto.ts`         | Create DTO                     |
| `src/modules/notification/dto/update-notification-template.dto.ts`         | Update DTO (PartialType)       |
| `src/modules/notification/services/notification-template.service.ts`       | CRUD + Redis + file fallback   |
| `src/modules/notification/controllers/notification-template.controller.ts` | Admin CRUD endpoints           |
| `test/unit/certification/certification-pdf.service.spec.ts`                | PDF service tests              |
| `test/unit/notification/notification-template.service.spec.ts`             | Template service tests         |
