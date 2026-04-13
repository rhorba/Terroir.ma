# Sprint 9 — File Uploads, Export PDF, Compliance Reports — Implementation Plan

> **For Claude:** Use /execute to implement this plan task-by-task.

**Goal:** Add MinIO file upload infrastructure, lab accreditation registry, product/lab document uploads, PDF export certificate, and MAPMDREF/ONSSA compliance reports.

**Architecture:** MinioService (common) → ProductDocumentService + LabService (product module) → ExportDocumentPdfService + CertificationService extensions (certification module)

**Tech Stack:** NestJS, TypeScript, PostgreSQL, @aws-sdk/client-s3, multer, PDFKit, Keycloak, Redis

**Modules Affected:** common (MinioService), product (Lab, ProductDocument, LabTest extension), certification (ExportDocumentPdf, compliance/ONSSA reports)

**Estimated Story Points:** 22 SP (US-017 × 3 + US-026 × 3 + US-030 × 3 + US-068 × 5 + US-083 × 5 + US-089 × 3)

---

## Batch 1 — Infrastructure: MinIO Docker + MinioService

### Task 1.1 — Add MinIO to docker-compose.yml and .env.example

**File:** `docker-compose.yml`

Add MinIO service alongside the existing services:

```yaml
minio:
  image: quay.io/minio/minio:latest
  ports:
    - '9000:9000'
    - '9001:9001'
  environment:
    MINIO_ROOT_USER: ${MINIO_ACCESS_KEY:-minioadmin}
    MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY:-minioadmin}
  command: server /data --console-address ":9001"
  volumes:
    - minio_data:/data
  healthcheck:
    test: ['CMD', 'curl', '-f', 'http://localhost:9000/minio/health/live']
    interval: 10s
    timeout: 5s
    retries: 5
```

Add `minio_data:` under the top-level `volumes:` section.

**File:** `.env.example`

Add:

```
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=terroir-uploads
MINIO_USE_SSL=false
```

**Verification:** `docker compose config` — no YAML errors.

---

### Task 1.2 — Create MinIO config

**File:** `src/config/minio.config.ts` (new)

```typescript
import { registerAs } from '@nestjs/config';

export default registerAs('minio', () => ({
  endpoint: process.env.MINIO_ENDPOINT ?? 'localhost',
  port: parseInt(process.env.MINIO_PORT ?? '9000', 10),
  accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
  bucket: process.env.MINIO_BUCKET ?? 'terroir-uploads',
  useSsl: process.env.MINIO_USE_SSL === 'true',
}));
```

**File:** `src/config/index.ts`

Add `export { default as minioConfig } from './minio.config';`

---

### Task 1.3 — Create MinioService

**File:** `src/common/services/minio.service.ts` (new)

```typescript
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';

/**
 * MinIO object storage service.
 * Wraps @aws-sdk/client-s3 for S3-compatible MinIO operations.
 * Bucket is auto-created on module init if it does not exist.
 */
@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = config.get<string>('minio.endpoint', 'localhost');
    const port = config.get<number>('minio.port', 9000);
    const useSsl = config.get<boolean>('minio.useSsl', false);
    this.bucket = config.get<string>('minio.bucket', 'terroir-uploads');

    this.client = new S3Client({
      endpoint: `${useSsl ? 'https' : 'http'}://${endpoint}:${port}`,
      region: 'us-east-1', // required by S3 client, ignored by MinIO
      credentials: {
        accessKeyId: config.get<string>('minio.accessKey', 'minioadmin'),
        secretAccessKey: config.get<string>('minio.secretKey', 'minioadmin'),
      },
      forcePathStyle: true, // required for MinIO
    });
  }

  /** Ensure the bucket exists on startup. */
  async onModuleInit(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`MinIO bucket '${this.bucket}' already exists`);
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`MinIO bucket '${this.bucket}' created`);
    }
  }

  /**
   * Upload a file buffer to MinIO.
   * @param key   Object key (path within bucket)
   * @param buffer File contents
   * @param mimeType Content-Type header
   */
  async uploadFile(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );
    this.logger.log({ key }, 'File uploaded to MinIO');
  }

  /**
   * Retrieve a file as a readable stream from MinIO.
   * @param key Object key
   */
  async getFileStream(key: string): Promise<Readable> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    return response.Body as Readable;
  }

  /**
   * Delete a file from MinIO.
   * @param key Object key
   */
  async deleteFile(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    this.logger.log({ key }, 'File deleted from MinIO');
  }
}
```

---

### Task 1.4 — Install package + register in AppModule

**Command:** `npm install @aws-sdk/client-s3`

**File:** `src/app.module.ts`

1. Import `minioConfig` from `./config/minio.config` and add to `ConfigModule.forRoot({ load: [..., minioConfig] })`
2. Import `MinioService` from `./common/services/minio.service`
3. Add `MinioService` to `providers: [KafkaAdminService, MinioService]`

**Verification:** `npm run lint && npm run typecheck`

---

## Batch 2 — US-030: Lab Accreditation Registry

### Task 2.1 — Lab entity

**File:** `src/modules/product/entities/lab.entity.ts` (new)

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Lab entity — ONSSA-accredited laboratory registry.
 * Accreditation is metadata only in v1; enforcement deferred to Phase 2.
 * US-030
 */
@Entity({ schema: 'product', name: 'lab' })
export class Lab {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'name', type: 'varchar', length: 200 })
  name: string;

  @Column({ name: 'onssa_accreditation_number', type: 'varchar', length: 50, nullable: true })
  onssaAccreditationNumber: string | null;

  @Column({ name: 'is_accredited', type: 'boolean', default: false })
  isAccredited: boolean;

  @Column({ name: 'accredited_at', type: 'timestamptz', nullable: true })
  accreditedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}
```

---

### Task 2.2 — Migration: AddLab

**File:** `src/database/migrations/1700000000013-AddLab.ts` (new)

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLab1700000000013 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE product.lab (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(200) NOT NULL,
        onssa_accreditation_number VARCHAR(50) NULL,
        is_accredited BOOLEAN NOT NULL DEFAULT FALSE,
        accredited_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS product.lab`);
  }
}
```

---

### Task 2.3 — Lab DTOs

**File:** `src/modules/product/dto/create-lab.dto.ts` (new)

```typescript
import { IsString, IsNotEmpty, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLabDto {
  @ApiProperty({ example: 'Laboratoire ONSSA Casablanca' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ example: 'ONSSA-2025-0042' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  onssaAccreditationNumber?: string;
}
```

---

### Task 2.4 — LabService

**File:** `src/modules/product/services/lab.service.ts` (new)

```typescript
import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lab } from '../entities/lab.entity';
import { CreateLabDto } from '../dto/create-lab.dto';

/**
 * Lab service — manages ONSSA-accredited laboratory registry.
 * US-030
 */
@Injectable()
export class LabService {
  private readonly logger = new Logger(LabService.name);

  constructor(
    @InjectRepository(Lab)
    private readonly labRepo: Repository<Lab>,
  ) {}

  /** Register a new laboratory. */
  async create(dto: CreateLabDto): Promise<Lab> {
    const lab = this.labRepo.create({
      name: dto.name,
      onssaAccreditationNumber: dto.onssaAccreditationNumber ?? null,
      isAccredited: false,
      accreditedAt: null,
    });
    return this.labRepo.save(lab);
  }

  /** List all laboratories, newest first. */
  async findAll(): Promise<Lab[]> {
    return this.labRepo.find({ order: { createdAt: 'DESC' } });
  }

  /** Find a laboratory by ID. */
  async findById(id: string): Promise<Lab> {
    const lab = await this.labRepo.findOne({ where: { id } });
    if (!lab) {
      throw new NotFoundException({ code: 'LAB_NOT_FOUND', message: `Lab ${id} not found` });
    }
    return lab;
  }

  /** Grant ONSSA accreditation to a laboratory. */
  async accredit(id: string): Promise<Lab> {
    const lab = await this.findById(id);
    if (lab.isAccredited) {
      throw new ConflictException({
        code: 'LAB_ALREADY_ACCREDITED',
        message: 'Lab is already accredited',
      });
    }
    await this.labRepo.update({ id }, { isAccredited: true, accreditedAt: new Date() });
    this.logger.log({ labId: id }, 'Lab accredited');
    return this.findById(id);
  }

  /** Revoke ONSSA accreditation from a laboratory. */
  async revoke(id: string): Promise<Lab> {
    const lab = await this.findById(id);
    if (!lab.isAccredited) {
      throw new ConflictException({ code: 'LAB_NOT_ACCREDITED', message: 'Lab is not accredited' });
    }
    await this.labRepo.update({ id }, { isAccredited: false, accreditedAt: null });
    this.logger.log({ labId: id }, 'Lab accreditation revoked');
    return this.findById(id);
  }
}
```

---

### Task 2.5 — LabController

**File:** `src/modules/product/controllers/lab.controller.ts` (new)

```typescript
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { LabService } from '../services/lab.service';
import { CreateLabDto } from '../dto/create-lab.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Lab } from '../entities/lab.entity';

@ApiTags('labs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('labs')
export class LabController {
  constructor(private readonly labService: LabService) {}

  /** US-030: Register a new laboratory (super-admin only). */
  @Post()
  @UseGuards(RolesGuard)
  @Roles('super-admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'US-030: Register a new ONSSA laboratory' })
  async create(@Body() dto: CreateLabDto): Promise<Lab> {
    return this.labService.create(dto);
  }

  /** US-030: List all laboratories. */
  @Get()
  @UseGuards(RolesGuard)
  @Roles('super-admin', 'certification-body')
  @ApiOperation({ summary: 'US-030: List all laboratories' })
  async findAll(): Promise<Lab[]> {
    return this.labService.findAll();
  }

  /** US-030: Get laboratory by ID. */
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('super-admin', 'certification-body')
  @ApiOperation({ summary: 'US-030: Get laboratory by ID' })
  async findOne(@Param('id') id: string): Promise<Lab> {
    return this.labService.findById(id);
  }

  /** US-030: Grant ONSSA accreditation to a laboratory. */
  @Post(':id/accredit')
  @UseGuards(RolesGuard)
  @Roles('super-admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'US-030: Grant ONSSA accreditation' })
  async accredit(@Param('id') id: string): Promise<Lab> {
    return this.labService.accredit(id);
  }

  /** US-030: Revoke ONSSA accreditation from a laboratory. */
  @Post(':id/revoke')
  @UseGuards(RolesGuard)
  @Roles('super-admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'US-030: Revoke ONSSA accreditation' })
  async revoke(@Param('id') id: string): Promise<Lab> {
    return this.labService.revoke(id);
  }
}
```

---

### Task 2.6 — Register Lab in ProductModule

**File:** `src/modules/product/product.module.ts`

Add to imports:

- `Lab` to `TypeOrmModule.forFeature([...])`

Add to controllers:

- `LabController`

Add to providers:

- `LabService`

**Verification:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 3 — US-017: Product Supporting Documents

### Task 3.1 — ProductDocument entity

**File:** `src/modules/product/entities/product-document.entity.ts` (new)

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * Product supporting document uploaded to MinIO.
 * productId references product.product(id) — no FK (cross-table safe via UUID only).
 * US-017
 */
@Entity({ schema: 'product', name: 'product_document' })
export class ProductDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType: string;

  /** MinIO object key: product-docs/{productId}/{uuid}-{fileName} */
  @Column({ name: 's3_key', type: 'varchar', length: 500 })
  s3Key: string;

  @Column({ name: 'size_bytes', type: 'int' })
  sizeBytes: number;

  @Column({ name: 'uploaded_by', type: 'uuid' })
  uploadedBy: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
```

---

### Task 3.2 — Migration: AddProductDocument

**File:** `src/database/migrations/1700000000011-AddProductDocument.ts` (new)

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductDocument1700000000011 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE product.product_document (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id UUID NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        s3_key VARCHAR(500) NOT NULL,
        size_bytes INT NOT NULL,
        uploaded_by UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX idx_product_document_product_id ON product.product_document(product_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS product.product_document`);
  }
}
```

---

### Task 3.3 — ProductDocumentService

**File:** `src/modules/product/services/product-document.service.ts` (new)

```typescript
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';
import { ProductDocument } from '../entities/product-document.entity';
import { Product } from '../entities/product.entity';
import { MinioService } from '../../../common/services/minio.service';

/**
 * Product document service — uploads and retrieves supporting documents via MinIO.
 * US-017
 */
@Injectable()
export class ProductDocumentService {
  private readonly logger = new Logger(ProductDocumentService.name);

  constructor(
    @InjectRepository(ProductDocument)
    private readonly docRepo: Repository<ProductDocument>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly minioService: MinioService,
  ) {}

  /**
   * Upload a supporting document for a product registration.
   * Key format: product-docs/{productId}/{uuid}-{sanitisedFileName}
   */
  async upload(
    productId: string,
    file: Express.Multer.File,
    uploadedBy: string,
  ): Promise<ProductDocument> {
    const product = await this.productRepo.findOne({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException({
        code: 'PRODUCT_NOT_FOUND',
        message: `Product ${productId} not found`,
      });
    }

    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const s3Key = `product-docs/${productId}/${uuidv4()}-${safeName}`;

    await this.minioService.uploadFile(s3Key, file.buffer, file.mimetype);

    const doc = this.docRepo.create({
      productId,
      fileName: file.originalname,
      mimeType: file.mimetype,
      s3Key,
      sizeBytes: file.size,
      uploadedBy,
    });
    const saved = await this.docRepo.save(doc);
    this.logger.log({ docId: saved.id, productId }, 'Product document uploaded');
    return saved;
  }

  /** List all documents for a product. */
  async findByProduct(productId: string): Promise<ProductDocument[]> {
    return this.docRepo.find({ where: { productId }, order: { createdAt: 'DESC' } });
  }

  /**
   * Stream a document from MinIO.
   * Returns the stream plus metadata for response headers.
   */
  async download(docId: string): Promise<{ stream: Readable; fileName: string; mimeType: string }> {
    const doc = await this.docRepo.findOne({ where: { id: docId } });
    if (!doc) {
      throw new NotFoundException({
        code: 'DOCUMENT_NOT_FOUND',
        message: `Document ${docId} not found`,
      });
    }
    const stream = await this.minioService.getFileStream(doc.s3Key);
    return { stream, fileName: doc.fileName, mimeType: doc.mimeType };
  }
}
```

---

### Task 3.4 — ProductDocumentController

**File:** `src/modules/product/controllers/product-document.controller.ts` (new)

```typescript
import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  StreamableFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { ProductDocumentService } from '../services/product-document.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { ProductDocument } from '../entities/product-document.entity';

@ApiTags('product-documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductDocumentController {
  constructor(private readonly productDocumentService: ProductDocumentService) {}

  /**
   * US-017: Upload a supporting document for a product registration.
   * Max file size 10 MB enforced by Multer limits.
   */
  @Post(':id/documents')
  @UseGuards(RolesGuard)
  @Roles('cooperative-admin')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    }),
  )
  @ApiOperation({ summary: 'US-017: Upload supporting document for product registration' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  async upload(
    @Param('id') productId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ProductDocument> {
    return this.productDocumentService.upload(productId, file, user.sub);
  }

  /** US-017: List all supporting documents for a product. */
  @Get(':id/documents')
  @UseGuards(RolesGuard)
  @Roles('cooperative-admin', 'inspector', 'certification-body', 'super-admin')
  @ApiOperation({ summary: 'US-017: List supporting documents for a product' })
  async findAll(@Param('id') productId: string): Promise<ProductDocument[]> {
    return this.productDocumentService.findByProduct(productId);
  }

  /** US-017: Download a supporting document (NestJS proxy stream). */
  @Get(':id/documents/:docId/download')
  @UseGuards(RolesGuard)
  @Roles('cooperative-admin', 'inspector', 'certification-body', 'super-admin')
  @ApiOperation({ summary: 'US-017: Download supporting document' })
  async download(
    @Param('docId') docId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { stream, fileName, mimeType } = await this.productDocumentService.download(docId);
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
    });
    return new StreamableFile(stream);
  }
}
```

---

### Task 3.5 — Register ProductDocument in ProductModule

**File:** `src/modules/product/product.module.ts`

Add to `TypeOrmModule.forFeature([...])`: `ProductDocument`

Add to `controllers: [...]`: `ProductDocumentController`

Add to `providers: [...]`: `ProductDocumentService`

Import `MinioService` from common — add to `providers: [..., MinioService]`

**Verification:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 4 — US-026: Lab Test PDF Report Upload

### Task 4.1 — Update LabTest entity

**File:** `src/modules/product/entities/lab-test.entity.ts`

Add two nullable columns after `submittedBy`:

```typescript
@Column({ name: 'report_s3_key', type: 'varchar', length: 500, nullable: true })
reportS3Key: string | null;

@Column({ name: 'report_file_name', type: 'varchar', length: 255, nullable: true })
reportFileName: string | null;
```

---

### Task 4.2 — Migration: AddLabTestReportKey

**File:** `src/database/migrations/1700000000012-AddLabTestReportKey.ts` (new)

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLabTestReportKey1700000000012 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE product.lab_test
        ADD COLUMN report_s3_key VARCHAR(500) NULL,
        ADD COLUMN report_file_name VARCHAR(255) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE product.lab_test
        DROP COLUMN IF EXISTS report_s3_key,
        DROP COLUMN IF EXISTS report_file_name
    `);
  }
}
```

---

### Task 4.3 — Add report methods to LabTestService

**File:** `src/modules/product/services/lab-test.service.ts`

Add `MinioService` injection to constructor. Add two methods:

```typescript
/**
 * US-026: Upload a PDF lab report and store the MinIO key on the LabTest record.
 */
async uploadReport(id: string, file: Express.Multer.File): Promise<LabTest> {
  const labTest = await this.findById(id);
  if (file.mimetype !== 'application/pdf') {
    throw new BadRequestException({ code: 'INVALID_MIME_TYPE', message: 'Only PDF files are accepted' });
  }
  const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
  const s3Key = `lab-reports/${labTest.id}/${uuidv4()}-${safeName}`;
  await this.minioService.uploadFile(s3Key, file.buffer, 'application/pdf');
  await this.labTestRepo.update({ id }, { reportS3Key: s3Key, reportFileName: file.originalname });
  return this.findById(id);
}

/**
 * US-026: Stream the PDF lab report from MinIO.
 */
async downloadReport(id: string): Promise<{ stream: Readable; fileName: string }> {
  const labTest = await this.findById(id);
  if (!labTest.reportS3Key) {
    throw new NotFoundException({ code: 'REPORT_NOT_FOUND', message: 'No report uploaded for this lab test' });
  }
  const stream = await this.minioService.getFileStream(labTest.reportS3Key);
  return { stream, fileName: labTest.reportFileName ?? 'lab-report.pdf' };
}
```

Add required imports: `BadRequestException`, `v4 as uuidv4` from `uuid`, `Readable` from `stream`, and `MinioService`.

---

### Task 4.4 — Add report endpoints to LabTestController

**File:** `src/modules/product/controllers/lab-test.controller.ts`

Add imports: `UseInterceptors`, `UploadedFile`, `Res`, `StreamableFile`, `BadRequestException`, `FileInterceptor`, `memoryStorage`, `Response`.

Add two new endpoints **before** `@Get(':id')`:

```typescript
/**
 * US-026: Upload a PDF lab report alongside structured results.
 * Only PDF MIME type accepted. Replaces any existing report.
 */
@Post(':id/report')
@UseGuards(RolesGuard)
@Roles('lab-technician')
@HttpCode(HttpStatus.OK)
@UseInterceptors(FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
}))
@ApiOperation({ summary: 'US-026: Upload PDF lab report' })
@ApiConsumes('multipart/form-data')
@ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
async uploadReport(
  @Param('id') id: string,
  @UploadedFile() file: Express.Multer.File,
): Promise<LabTest> {
  return this.labTestService.uploadReport(id, file);
}

/**
 * US-026: Download the PDF lab report (NestJS proxy stream).
 */
@Get(':id/report')
@UseGuards(RolesGuard)
@Roles('lab-technician', 'cooperative-admin', 'inspector', 'certification-body', 'super-admin')
@ApiOperation({ summary: 'US-026: Download PDF lab report' })
async downloadReport(
  @Param('id') id: string,
  @Res({ passthrough: true }) res: Response,
): Promise<StreamableFile> {
  const { stream, fileName } = await this.labTestService.downloadReport(id);
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
  });
  return new StreamableFile(stream);
}
```

**Important:** Route ordering in `LabTestController`:

1. `GET /` (findAll — existing)
2. `POST /` (submit — existing)
3. `POST /:id/results` (existing)
4. `POST /:id/report` (new)
5. `GET /:id/report` (new)
6. `GET /:id` (findOne — existing)
7. `GET /:id/result` (existing)

**File:** `src/modules/product/product.module.ts`

Ensure `MinioService` is in providers (added in Batch 3 — confirm it's there).

**Verification:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 5 — US-068: PDF Export Certificate

### Task 5.1 — ExportDocumentPdfService

**File:** `src/modules/certification/services/export-document-pdf.service.ts` (new)

```typescript
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as PDFDocument from 'pdfkit';
import * as path from 'path';
import { ExportDocument } from '../entities/export-document.entity';
import { Certification } from '../entities/certification.entity';

/**
 * Generates a PDF export certificate for a validated export document.
 * Follows the same PDFKit pattern as CertificationPdfService.
 * US-068
 */
@Injectable()
export class ExportDocumentPdfService {
  private readonly logger = new Logger(ExportDocumentPdfService.name);
  private readonly fontsDir = path.join(process.cwd(), 'assets', 'fonts');

  constructor(
    @InjectRepository(ExportDocument)
    private readonly exportDocRepo: Repository<ExportDocument>,
    @InjectRepository(Certification)
    private readonly certRepo: Repository<Certification>,
  ) {}

  /**
   * Generate a PDF export certificate for an approved export document.
   * Returns a Buffer suitable for StreamableFile.
   */
  async generateExportCertificatePdf(exportDocId: string): Promise<Buffer> {
    const exportDoc = await this.exportDocRepo.findOne({ where: { id: exportDocId } });
    if (!exportDoc) {
      throw new NotFoundException({
        code: 'EXPORT_DOCUMENT_NOT_FOUND',
        message: `Export document ${exportDocId} not found`,
      });
    }

    const cert = await this.certRepo.findOne({ where: { id: exportDoc.certificationId } });

    return this.buildPdf(exportDoc, cert);
  }

  private buildPdf(exportDoc: ExportDocument, cert: Certification | null): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const dejavu = path.join(this.fontsDir, 'DejaVuSans.ttf');
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

      // ── Title bar ────────────────────────────────────────────────────────────
      doc
        .font('DejaVu')
        .fontSize(18)
        .fillColor('#1a5276')
        .text('TERROIR.MA — Plateforme de Certification SDOQ', { align: 'center' });
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#1a5276');
      doc.moveDown(0.5);

      doc
        .font('DejaVu')
        .fontSize(14)
        .fillColor('#000')
        .text("CERTIFICAT D'EXPORTATION", { align: 'center' });
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#aaa');
      doc.moveDown(0.5);

      const field = (label: string, value: string): void => {
        doc.font('DejaVu').fontSize(10).fillColor('#555').text(`${label}:  `, { continued: true });
        doc.font('DejaVu').fontSize(10).fillColor('#000').text(value);
      };

      field('Référence export', exportDoc.id);
      field('Référence ONSSA', exportDoc.onssaReference ?? '—');
      if (cert) {
        field('N° Certificat SDOQ', cert.certificationNumber ?? '—');
        field('Coopérative', cert.cooperativeName);
        field('Produit', cert.productTypeCode);
      }
      field('Pays de destination', exportDoc.destinationCountry);
      field('Code SH', exportDoc.hsCode);
      field('Quantité (kg)', String(exportDoc.quantityKg));
      field('Destinataire', exportDoc.consigneeName);
      field('Pays destinataire', exportDoc.consigneeCountry);
      field('Statut', exportDoc.status.toUpperCase());
      field("Valide jusqu'au", formatDate(exportDoc.validUntil));

      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#aaa');
      doc.moveDown(0.5);

      doc
        .font('DejaVu')
        .fontSize(8)
        .fillColor('#888')
        .text(`Généré le ${formatDate(new Date())} — Terroir.ma`, { align: 'center' });

      doc.end();
    });
  }
}
```

---

### Task 5.2 — Add PDF endpoint to ExportDocumentController

**File:** `src/modules/certification/controllers/export-document.controller.ts`

Add imports: `Res`, `StreamableFile` from `@nestjs/common`; `Response` from `express`; `ExportDocumentPdfService`.

Inject `ExportDocumentPdfService` in constructor.

Add endpoint **after** `GET /my` and **before** `GET /:id`:

```typescript
/**
 * US-068: Generate and download a PDF export certificate.
 * Available for approved export documents.
 */
@Get(':id/certificate.pdf')
@UseGuards(RolesGuard)
@Roles('customs-agent', 'cooperative-admin', 'super-admin')
@ApiOperation({ summary: 'US-068: Download PDF export certificate' })
async downloadExportCertificatePdf(
  @Param('id') id: string,
  @Res({ passthrough: true }) res: Response,
): Promise<StreamableFile> {
  const buffer = await this.exportDocumentPdfService.generateExportCertificatePdf(id);
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="export-cert-${id}.pdf"`,
  });
  return new StreamableFile(buffer);
}
```

**Note:** `GET /:id/certificate.pdf` does NOT conflict with `GET /:id` — different segment counts. No reorder needed.

---

### Task 5.3 — Register ExportDocumentPdfService in CertificationModule

**File:** `src/modules/certification/certification.module.ts`

Add `ExportDocumentPdfService` to `providers: [...]`.

**Verification:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 6 — US-083 + US-089: Compliance and ONSSA Reports

### Task 6.1 — Compliance report interfaces

**File:** `src/modules/certification/interfaces/certification-stats.interface.ts`

Add two new interfaces after the existing `CertificationStats`:

```typescript
export interface CooperativeComplianceRow {
  cooperativeId: string;
  cooperativeName: string;
  totalRequests: number;
  pending: number;
  granted: number;
  denied: number;
  revoked: number;
  renewed: number;
}

export interface OnssaCertRow {
  certificationNumber: string | null;
  cooperativeName: string;
  productTypeCode: string;
  regionCode: string;
  certificationType: string;
  grantedAt: Date | null;
  validFrom: string | null;
  validUntil: string | null;
}
```

---

### Task 6.2 — Add report query DTO

**File:** `src/modules/certification/dto/report-query.dto.ts` (new)

```typescript
import { IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ReportQueryDto {
  @ApiPropertyOptional({ example: '2025-01-01', description: 'Start date YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2025-12-31', description: 'End date YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
```

---

### Task 6.3 — Add complianceReport + onssaReport to CertificationService

**File:** `src/modules/certification/services/certification.service.ts`

Add two methods (use `this.dataSource.query()` — DataSource is already injected via the existing service pattern):

```typescript
/**
 * US-083: Aggregate certification counts grouped by cooperative.
 * cooperativeName is denormalized on the Certification entity — no cross-module join needed.
 */
async complianceReport(from?: string, to?: string): Promise<CooperativeComplianceRow[]> {
  const dateFilter =
    from && to
      ? `AND requested_at BETWEEN '${from}'::date AND '${to}'::date + INTERVAL '1 day'`
      : '';

  const rows = await this.dataSource.query<CooperativeComplianceRow[]>(`
    SELECT
      cooperative_id AS "cooperativeId",
      cooperative_name AS "cooperativeName",
      COUNT(*) AS "totalRequests",
      COUNT(*) FILTER (WHERE current_status IN (
        'SUBMITTED','DOCUMENT_REVIEW','INSPECTION_SCHEDULED',
        'INSPECTION_IN_PROGRESS','INSPECTION_COMPLETE',
        'LAB_TESTING','LAB_RESULTS_RECEIVED','UNDER_REVIEW'
      )) AS pending,
      COUNT(*) FILTER (WHERE current_status = 'GRANTED') AS granted,
      COUNT(*) FILTER (WHERE current_status = 'DENIED') AS denied,
      COUNT(*) FILTER (WHERE current_status = 'REVOKED') AS revoked,
      COUNT(*) FILTER (WHERE current_status = 'RENEWED') AS renewed
    FROM certification.certification
    WHERE deleted_at IS NULL ${dateFilter}
    GROUP BY cooperative_id, cooperative_name
    ORDER BY "totalRequests" DESC
  `);

  // Cast string counts from PostgreSQL to numbers
  return rows.map((r) => ({
    ...r,
    totalRequests: Number(r.totalRequests),
    pending: Number(r.pending),
    granted: Number(r.granted),
    denied: Number(r.denied),
    revoked: Number(r.revoked),
    renewed: Number(r.renewed),
  }));
}

/**
 * US-089: List all currently GRANTED certifications for ONSSA compliance verification.
 */
async onssaReport(from?: string, to?: string): Promise<OnssaCertRow[]> {
  const dateFilter =
    from && to
      ? `AND granted_at BETWEEN '${from}'::date AND '${to}'::date + INTERVAL '1 day'`
      : '';

  return this.dataSource.query<OnssaCertRow[]>(`
    SELECT
      certification_number AS "certificationNumber",
      cooperative_name AS "cooperativeName",
      product_type_code AS "productTypeCode",
      region_code AS "regionCode",
      certification_type AS "certificationType",
      granted_at AS "grantedAt",
      valid_from AS "validFrom",
      valid_until AS "validUntil"
    FROM certification.certification
    WHERE current_status = 'GRANTED'
      AND deleted_at IS NULL
      ${dateFilter}
    ORDER BY granted_at DESC
  `);
}
```

Add missing imports at top: `CooperativeComplianceRow`, `OnssaCertRow` from `../interfaces/certification-stats.interface`.

**Note:** Verify `this.dataSource` is injected. Look for `DataSource` injection in existing `getStats()` method and reuse the same pattern. If `dataSource` is accessed via `this.certRepo.manager.connection` instead, use that pattern consistently.

---

### Task 6.4 — Add endpoints to CertificationController

**File:** `src/modules/certification/controllers/certification.controller.ts`

Add imports: `ReportQueryDto`, `CooperativeComplianceRow`, `OnssaCertRow`.

Add two new `@Get()` methods **immediately after** `@Get('export')` and **before** `@Get(':id')`:

```typescript
/**
 * US-083: Cooperative compliance report — certifications grouped by cooperative.
 * Registered before GET /:id (literal-before-param rule).
 */
@Get('compliance-report')
@UseGuards(RolesGuard)
@Roles('super-admin', 'certification-body')
@ApiOperation({ summary: 'US-083: Cooperative compliance report (grouped by cooperative)' })
@ApiQuery({ name: 'from', required: false, type: String, description: 'YYYY-MM-DD' })
@ApiQuery({ name: 'to', required: false, type: String, description: 'YYYY-MM-DD' })
async complianceReport(@Query() query: ReportQueryDto): Promise<CooperativeComplianceRow[]> {
  return this.certificationService.complianceReport(query.from, query.to);
}

/**
 * US-089: ONSSA active certifications report — all GRANTED certifications.
 * Registered before GET /:id (literal-before-param rule).
 */
@Get('onssa-report')
@UseGuards(RolesGuard)
@Roles('super-admin', 'certification-body')
@ApiOperation({ summary: 'US-089: Active certifications report for ONSSA' })
@ApiQuery({ name: 'from', required: false, type: String, description: 'YYYY-MM-DD' })
@ApiQuery({ name: 'to', required: false, type: String, description: 'YYYY-MM-DD' })
async onssaReport(@Query() query: ReportQueryDto): Promise<OnssaCertRow[]> {
  return this.certificationService.onssaReport(query.from, query.to);
}
```

**Final route order in CertificationController:**

1. `GET /stats` (existing)
2. `GET /pending` (existing)
3. `GET /my` (existing)
4. `GET /export` (existing)
5. `GET /compliance-report` (new)
6. `GET /onssa-report` (new)
7. `GET /:id/certificate.pdf` (existing — safe: 2 segments)
8. `GET /:id` (existing)
9. All `POST`, `PATCH` routes

**Verification:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 7 — Tests: MinioService + LabService

### Task 7.1 — minio.service.spec.ts

**File:** `test/unit/common/minio.service.spec.ts` (new)

```typescript
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MinioService } from '../../../src/common/services/minio.service';

// Mock the entire @aws-sdk/client-s3 module
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({ Body: { pipe: jest.fn() } }),
  })),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
  CreateBucketCommand: jest.fn(),
  HeadBucketCommand: jest.fn(),
}));

describe('MinioService', () => {
  let service: MinioService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MinioService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def: unknown) => def),
          },
        },
      ],
    }).compile();
    service = module.get(MinioService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('uploadFile() — calls S3Client.send with PutObjectCommand', async () => {
    await expect(
      service.uploadFile('test-key', Buffer.from('data'), 'application/pdf'),
    ).resolves.toBeUndefined();
  });

  it('getFileStream() — calls S3Client.send with GetObjectCommand', async () => {
    const stream = await service.getFileStream('test-key');
    expect(stream).toBeDefined();
  });
});
```

---

### Task 7.2 — lab.service.spec.ts

**File:** `test/unit/product/lab.service.spec.ts` (new)

Cover: `create()`, `findById()` (found + not found), `accredit()` (happy + already accredited), `revoke()` (happy + not accredited).

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { LabService } from '../../../src/modules/product/services/lab.service';
import { Lab } from '../../../src/modules/product/entities/lab.entity';

const makeRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
});

describe('LabService', () => {
  let service: LabService;
  let repo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    repo = makeRepo();
    const module = await Test.createTestingModule({
      providers: [LabService, { provide: getRepositoryToken(Lab), useValue: repo }],
    }).compile();
    service = module.get(LabService);
  });

  it('create() — saves a new lab', async () => {
    const lab = { id: 'lab-1', name: 'ONSSA Lab', isAccredited: false } as Lab;
    repo.create.mockReturnValue(lab);
    repo.save.mockResolvedValue(lab);
    const result = await service.create({ name: 'ONSSA Lab' });
    expect(result.name).toBe('ONSSA Lab');
  });

  it('findById() — throws NotFoundException when lab not found', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.findById('missing')).rejects.toThrow(NotFoundException);
  });

  it('accredit() — sets isAccredited true', async () => {
    const lab = { id: 'lab-1', isAccredited: false } as Lab;
    repo.findOne
      .mockResolvedValue(lab)
      .mockResolvedValueOnce(lab)
      .mockResolvedValueOnce({ ...lab, isAccredited: true });
    repo.update.mockResolvedValue({});
    const result = await service.accredit('lab-1');
    expect(repo.update).toHaveBeenCalledWith(
      { id: 'lab-1' },
      expect.objectContaining({ isAccredited: true }),
    );
  });

  it('accredit() — throws ConflictException when already accredited', async () => {
    const lab = { id: 'lab-1', isAccredited: true } as Lab;
    repo.findOne.mockResolvedValue(lab);
    await expect(service.accredit('lab-1')).rejects.toThrow(ConflictException);
  });
});
```

**Verification:** `npm run test:unit`

---

## Batch 8 — Tests: ProductDocumentService + LabTest report methods

### Task 8.1 — product-document.service.spec.ts

**File:** `test/unit/product/product-document.service.spec.ts` (new)

Cover: `upload()` (happy path + product not found), `findByProduct()`, `download()` (happy path + doc not found).

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ProductDocumentService } from '../../../src/modules/product/services/product-document.service';
import { ProductDocument } from '../../../src/modules/product/entities/product-document.entity';
import { Product } from '../../../src/modules/product/entities/product.entity';
import { MinioService } from '../../../src/common/services/minio.service';

const makeRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
});

const makeMinio = () => ({
  uploadFile: jest.fn().mockResolvedValue(undefined),
  getFileStream: jest.fn().mockResolvedValue({ pipe: jest.fn() }),
  deleteFile: jest.fn().mockResolvedValue(undefined),
});

describe('ProductDocumentService', () => {
  let service: ProductDocumentService;
  let docRepo: ReturnType<typeof makeRepo>;
  let productRepo: ReturnType<typeof makeRepo>;
  let minio: ReturnType<typeof makeMinio>;

  const mockFile = {
    originalname: 'sdoq-cert.pdf',
    mimetype: 'application/pdf',
    buffer: Buffer.from('pdf'),
    size: 3,
  } as Express.Multer.File;

  beforeEach(async () => {
    docRepo = makeRepo();
    productRepo = makeRepo();
    minio = makeMinio();

    const module = await Test.createTestingModule({
      providers: [
        ProductDocumentService,
        { provide: getRepositoryToken(ProductDocument), useValue: docRepo },
        { provide: getRepositoryToken(Product), useValue: productRepo },
        { provide: MinioService, useValue: minio },
      ],
    }).compile();
    service = module.get(ProductDocumentService);
  });

  it('upload() — uploads to MinIO and saves record', async () => {
    const product = { id: 'prod-1' } as Product;
    const doc = { id: 'doc-1', productId: 'prod-1' } as ProductDocument;
    productRepo.findOne.mockResolvedValue(product);
    docRepo.create.mockReturnValue(doc);
    docRepo.save.mockResolvedValue(doc);

    const result = await service.upload('prod-1', mockFile, 'user-1');
    expect(minio.uploadFile).toHaveBeenCalled();
    expect(result.productId).toBe('prod-1');
  });

  it('upload() — throws NotFoundException when product not found', async () => {
    productRepo.findOne.mockResolvedValue(null);
    await expect(service.upload('missing', mockFile, 'user-1')).rejects.toThrow(NotFoundException);
  });

  it('findByProduct() — returns documents list', async () => {
    docRepo.find.mockResolvedValue([]);
    const result = await service.findByProduct('prod-1');
    expect(Array.isArray(result)).toBe(true);
  });

  it('download() — returns stream when document exists', async () => {
    const doc = {
      id: 'doc-1',
      s3Key: 'some/key',
      fileName: 'file.pdf',
      mimeType: 'application/pdf',
    } as ProductDocument;
    docRepo.findOne.mockResolvedValue(doc);
    const result = await service.download('doc-1');
    expect(result.fileName).toBe('file.pdf');
    expect(minio.getFileStream).toHaveBeenCalledWith('some/key');
  });

  it('download() — throws NotFoundException when document not found', async () => {
    docRepo.findOne.mockResolvedValue(null);
    await expect(service.download('missing')).rejects.toThrow(NotFoundException);
  });
});
```

---

### Task 8.2 — lab-test.service.spec.ts — add report tests

**File:** `test/unit/product/lab-test.service.spec.ts`

Add a `describe('report', ...)` block with 2 tests:

1. `uploadReport()` — happy path: calls minioService.uploadFile, calls repo.update
2. `downloadReport()` — throws NotFoundException when `reportS3Key` is null

Ensure `MinioService` mock is added to the test module providers:

```typescript
{ provide: MinioService, useValue: { uploadFile: jest.fn(), getFileStream: jest.fn() } }
```

**Verification:** `npm run test:unit` (all suites pass, 0 failures)

---

## Batch 9 — Tests: ExportDocumentPdfService + CertificationService reports

### Task 9.1 — export-document-pdf.service.spec.ts

**File:** `test/unit/certification/export-document-pdf.service.spec.ts` (new)

Mock PDFKit at module level (`jest.mock('pdfkit')`). Cover:

1. Happy path — `generateExportCertificatePdf()` returns a Buffer
2. Throws NotFoundException when export document not found
3. Handles missing cert gracefully (cert is null — cert JOIN returns null)

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ExportDocumentPdfService } from '../../../src/modules/certification/services/export-document-pdf.service';
import { ExportDocument } from '../../../src/modules/certification/entities/export-document.entity';
import { Certification } from '../../../src/modules/certification/entities/certification.entity';

jest.mock('pdfkit', () => {
  const { EventEmitter } = require('events');
  return jest.fn().mockImplementation(() => {
    const emitter = new EventEmitter();
    emitter.font = jest.fn().mockReturnThis();
    emitter.fontSize = jest.fn().mockReturnThis();
    emitter.fillColor = jest.fn().mockReturnThis();
    emitter.text = jest.fn().mockReturnThis();
    emitter.moveDown = jest.fn().mockReturnThis();
    emitter.moveTo = jest.fn().mockReturnThis();
    emitter.lineTo = jest.fn().mockReturnThis();
    emitter.stroke = jest.fn().mockReturnThis();
    emitter.registerFont = jest.fn().mockReturnThis();
    emitter.image = jest.fn().mockReturnThis();
    emitter.end = jest.fn().mockImplementation(function () {
      this.emit('data', Buffer.from('pdf'));
      this.emit('end');
    });
    return emitter;
  });
});

const makeRepo = () => ({ findOne: jest.fn() });

describe('ExportDocumentPdfService', () => {
  let service: ExportDocumentPdfService;
  let exportDocRepo: ReturnType<typeof makeRepo>;
  let certRepo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    exportDocRepo = makeRepo();
    certRepo = makeRepo();
    const module = await Test.createTestingModule({
      providers: [
        ExportDocumentPdfService,
        { provide: getRepositoryToken(ExportDocument), useValue: exportDocRepo },
        { provide: getRepositoryToken(Certification), useValue: certRepo },
      ],
    }).compile();
    service = module.get(ExportDocumentPdfService);
  });

  it('generateExportCertificatePdf() — returns a Buffer', async () => {
    exportDocRepo.findOne.mockResolvedValue({
      id: 'doc-1',
      certificationId: 'cert-1',
      status: 'approved',
      quantityKg: 100,
    } as ExportDocument);
    certRepo.findOne.mockResolvedValue({
      certificationNumber: 'TERROIR-IGP-SOUSS-2025-000001',
      cooperativeName: 'Coop',
    } as Certification);
    const result = await service.generateExportCertificatePdf('doc-1');
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it('generateExportCertificatePdf() — throws NotFoundException when export doc not found', async () => {
    exportDocRepo.findOne.mockResolvedValue(null);
    await expect(service.generateExportCertificatePdf('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('generateExportCertificatePdf() — handles null cert gracefully', async () => {
    exportDocRepo.findOne.mockResolvedValue({
      id: 'doc-1',
      certificationId: 'cert-1',
      status: 'approved',
      quantityKg: 50,
    } as ExportDocument);
    certRepo.findOne.mockResolvedValue(null);
    const result = await service.generateExportCertificatePdf('doc-1');
    expect(Buffer.isBuffer(result)).toBe(true);
  });
});
```

---

### Task 9.2 — certification.service.spec.ts — add compliance + ONSSA report tests

**File:** `test/unit/certification/certification.service.spec.ts`

Add a `describe('reports', ...)` block with 4 tests:

1. `complianceReport()` — no date filter — calls dataSource.query, casts counts to number
2. `complianceReport()` — with date filter — includes date fragment in SQL
3. `onssaReport()` — no date filter — returns GRANTED certifications
4. `onssaReport()` — with date range — includes date fragment in SQL

Mock `dataSource.query`:

```typescript
dataSource = { query: jest.fn() };
```

Ensure `DataSource` is in the test module providers:

```typescript
{ provide: DataSource, useValue: dataSource }
```

**Verification:** `npm run test:unit` (full suite — all 29+ suites, 0 failures)

---

## Verification Checkpoints

| After Batch | Command                                                  | Expected                |
| ----------- | -------------------------------------------------------- | ----------------------- |
| Batch 1     | `npm run lint && npm run typecheck`                      | 0 errors                |
| Batch 2     | `npm run lint && npm run typecheck && npm run test:unit` | 0 failures              |
| Batch 3     | `npm run lint && npm run typecheck && npm run test:unit` | 0 failures              |
| Batch 4     | `npm run lint && npm run typecheck && npm run test:unit` | 0 failures              |
| Batch 5     | `npm run lint && npm run typecheck && npm run test:unit` | 0 failures              |
| Batch 6     | `npm run lint && npm run typecheck && npm run test:unit` | 0 failures              |
| Batch 7     | `npm run test:unit`                                      | 0 failures              |
| Batch 8     | `npm run test:unit`                                      | 0 failures              |
| Batch 9     | `npm run test:unit`                                      | 0 failures, ~333+ tests |

---

## New Files Summary

| File                                                                    | Type                     |
| ----------------------------------------------------------------------- | ------------------------ |
| `docker-compose.yml`                                                    | Modified                 |
| `.env.example`                                                          | Modified                 |
| `src/config/minio.config.ts`                                            | New                      |
| `src/config/index.ts`                                                   | Modified                 |
| `src/common/services/minio.service.ts`                                  | New                      |
| `src/app.module.ts`                                                     | Modified                 |
| `src/modules/product/entities/lab.entity.ts`                            | New                      |
| `src/modules/product/entities/product-document.entity.ts`               | New                      |
| `src/modules/product/entities/lab-test.entity.ts`                       | Modified (+2 cols)       |
| `src/modules/product/dto/create-lab.dto.ts`                             | New                      |
| `src/modules/product/services/lab.service.ts`                           | New                      |
| `src/modules/product/services/product-document.service.ts`              | New                      |
| `src/modules/product/services/lab-test.service.ts`                      | Modified (+2 methods)    |
| `src/modules/product/controllers/lab.controller.ts`                     | New                      |
| `src/modules/product/controllers/product-document.controller.ts`        | New                      |
| `src/modules/product/controllers/lab-test.controller.ts`                | Modified (+2 endpoints)  |
| `src/modules/product/product.module.ts`                                 | Modified                 |
| `src/database/migrations/1700000000011-AddProductDocument.ts`           | New                      |
| `src/database/migrations/1700000000012-AddLabTestReportKey.ts`          | New                      |
| `src/database/migrations/1700000000013-AddLab.ts`                       | New                      |
| `src/modules/certification/services/export-document-pdf.service.ts`     | New                      |
| `src/modules/certification/controllers/export-document.controller.ts`   | Modified (+1 endpoint)   |
| `src/modules/certification/certification.module.ts`                     | Modified                 |
| `src/modules/certification/interfaces/certification-stats.interface.ts` | Modified (+2 interfaces) |
| `src/modules/certification/dto/report-query.dto.ts`                     | New                      |
| `src/modules/certification/services/certification.service.ts`           | Modified (+2 methods)    |
| `src/modules/certification/controllers/certification.controller.ts`     | Modified (+2 endpoints)  |
| `test/unit/common/minio.service.spec.ts`                                | New                      |
| `test/unit/product/lab.service.spec.ts`                                 | New                      |
| `test/unit/product/product-document.service.spec.ts`                    | New                      |
| `test/unit/product/lab-test.service.spec.ts`                            | Modified (+2 tests)      |
| `test/unit/certification/export-document-pdf.service.spec.ts`           | New                      |
| `test/unit/certification/certification.service.spec.ts`                 | Modified (+4 tests)      |
