# P2-S3: Kafka Schema Registry + Avro — Implementation Plan

> **For Claude:** Use /execute to implement this plan task-by-task.

**Goal:** Migrate all 18 active Kafka event topics from plain JSON to Avro with Redpanda's built-in Schema Registry, wire a raw-KafkaJS `KafkaProducerService` + `KafkaConsumerService`, and fix the currently-dormant `NotificationListener` so Kafka-based notifications actually fire.

**Architecture:** `KafkaProducerService` (raw KafkaJS producer) → `SchemaRegistryService.encode()` → Avro binary → Redpanda → `KafkaConsumerService` (raw KafkaJS consumer) → `SchemaRegistryService.decode()` → handler. Schema registration happens once in `AppModule.onApplicationBootstrap()`. The existing `ClientKafka` / `@EventPattern` transport is replaced for all topics.

**Tech Stack:** NestJS, TypeScript, Redpanda Schema Registry (`:8081`), `@kafkajs/confluent-schema-registry`, raw `kafkajs` (already installed)

**Modules Affected:** common/kafka, cooperative, product, certification, notification, AppModule

**Estimated Story Points:** 18 (US-097, US-098, US-099)

**Critical finding:** `NotificationListener` uses `@EventPattern()` decorators but `main.ts` has NO `connectMicroservice()` call — Kafka notifications are currently DORMANT. This sprint fixes that by replacing `@EventPattern` with `KafkaConsumerService.subscribe()`.

---

## Key Design Decisions

- **18 actual event topics** (the design doc mentions 27 but the code only produces 18)
- **Subject naming:** `<topic>-value` (Confluent convention, e.g., `certification.decision.granted-value`)
- **File naming:** `src/common/schemas/avro/<topic>.avsc` (filename without `.avsc` → subject root)
- **BACKWARD compatibility** set per-subject via Redpanda Schema Registry HTTP API before registering
- **Schema loading:** `SchemaRegistryService` reads `.avsc` files from filesystem; `nest-cli.json` assets ensures they copy to `dist/`
- **Ordering:** `NotificationListener.onModuleInit()` registers handlers → `AppModule.onApplicationBootstrap()` calls `registerAll()` then `startConsuming()`
- **Producers:** Remove `ClientKafka.emit()` → replace with `KafkaProducerService.send()`
- **JSONB fields** (`testValues: Record<string,unknown>`) → `"string"` in Avro (JSON-stringified) per YAGNI

---

## Avro Schema Type Mapping

| TypeScript                       | Avro                                                          |
| -------------------------------- | ------------------------------------------------------------- |
| `string`                         | `"string"`                                                    |
| `number` (float/decimal)         | `"double"`                                                    |
| `number` (integer version/count) | `"int"`                                                       |
| `boolean`                        | `"boolean"`                                                   |
| `string \| null`                 | `["null","string"]` with `"default":null`                     |
| `string[]`                       | `{"type":"array","items":"string"}`                           |
| `Record<string,unknown>`         | `"string"` (JSON.stringify on produce, JSON.parse on consume) |

---

## Batch 1 — Dependencies + Avro Schemas

### Task 1 — Install packages, update env config + env validation + nest-cli.json

**Files to create / modify:**

- `package.json` (via npm install)
- `.env.example` — add `SCHEMA_REGISTRY_URL`
- `infrastructure/docker/.env.example` — add `SCHEMA_REGISTRY_URL` (Docker value)
- `src/config/env.validation.ts` — add `SCHEMA_REGISTRY_URL` Joi rule
- `nest-cli.json` — add `assets` to copy `.avsc` files to `dist/`

**Commands:**

```bash
npm install @kafkajs/confluent-schema-registry avsc
```

**Exact changes:**

`.env.example` — add after `KAFKA_CLIENT_ID=terroir-ma`:

```
# Redpanda Schema Registry
SCHEMA_REGISTRY_URL=http://localhost:8081
```

`infrastructure/docker/.env.example` (or `.env.docker`) — add:

```
SCHEMA_REGISTRY_URL=http://redpanda:8081
```

`src/config/env.validation.ts` — add inside `Joi.object({...})`:

```typescript
// Schema Registry
SCHEMA_REGISTRY_URL: Joi.string().uri().required(),
```

`nest-cli.json` — replace with:

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "assets": [{ "include": "**/*.avsc", "watchAssets": true }]
  }
}
```

**Verification:** `npm run typecheck` — must compile clean

---

### Task 2 — Create 9 Avro schemas: cooperative (4) + product (5)

Create directory `src/common/schemas/avro/`.

All schemas share BaseEvent fields: `eventId`, `correlationId`, `timestamp` (all `string`), `version` (`int`), `source` (`string`).

**`src/common/schemas/avro/cooperative.registration.submitted.avsc`:**

```json
{
  "type": "record",
  "name": "CooperativeRegistrationSubmitted",
  "namespace": "ma.terroir.events.cooperative",
  "fields": [
    { "name": "eventId", "type": "string" },
    { "name": "correlationId", "type": "string" },
    { "name": "timestamp", "type": "string" },
    { "name": "version", "type": "int" },
    { "name": "source", "type": "string" },
    { "name": "cooperativeId", "type": "string" },
    { "name": "cooperativeName", "type": "string" },
    { "name": "ice", "type": "string" },
    { "name": "regionCode", "type": "string" },
    { "name": "presidentName", "type": "string" },
    { "name": "presidentCin", "type": "string" }
  ]
}
```

**`src/common/schemas/avro/cooperative.registration.verified.avsc`:**

```json
{
  "type": "record",
  "name": "CooperativeRegistrationVerified",
  "namespace": "ma.terroir.events.cooperative",
  "fields": [
    { "name": "eventId", "type": "string" },
    { "name": "correlationId", "type": "string" },
    { "name": "timestamp", "type": "string" },
    { "name": "version", "type": "int" },
    { "name": "source", "type": "string" },
    { "name": "cooperativeId", "type": "string" },
    { "name": "cooperativeName", "type": "string" },
    { "name": "ice", "type": "string" },
    { "name": "regionCode", "type": "string" },
    { "name": "verifiedBy", "type": "string" },
    { "name": "verifiedAt", "type": "string" }
  ]
}
```

**`src/common/schemas/avro/cooperative.cooperative.deactivated.avsc`:**

```json
{
  "type": "record",
  "name": "CooperativeDeactivated",
  "namespace": "ma.terroir.events.cooperative",
  "fields": [
    { "name": "eventId", "type": "string" },
    { "name": "correlationId", "type": "string" },
    { "name": "timestamp", "type": "string" },
    { "name": "version", "type": "int" },
    { "name": "source", "type": "string" },
    { "name": "cooperativeId", "type": "string" },
    { "name": "cooperativeName", "type": "string" },
    { "name": "ice", "type": "string" },
    { "name": "regionCode", "type": "string" },
    { "name": "deactivatedBy", "type": "string" },
    { "name": "reason", "type": ["null", "string"], "default": null }
  ]
}
```

**`src/common/schemas/avro/cooperative.farm.mapped.avsc`:**

```json
{
  "type": "record",
  "name": "CooperativeFarmMapped",
  "namespace": "ma.terroir.events.cooperative",
  "fields": [
    { "name": "eventId", "type": "string" },
    { "name": "correlationId", "type": "string" },
    { "name": "timestamp", "type": "string" },
    { "name": "version", "type": "int" },
    { "name": "source", "type": "string" },
    { "name": "cooperativeId", "type": "string" },
    { "name": "farmId", "type": "string" },
    { "name": "farmName", "type": "string" },
    { "name": "latitude", "type": "double" },
    { "name": "longitude", "type": "double" },
    { "name": "areaHectares", "type": "double" },
    { "name": "cropTypes", "type": { "type": "array", "items": "string" } }
  ]
}
```

**`src/common/schemas/avro/product.harvest.logged.avsc`:**

```json
{
  "type": "record",
  "name": "ProductHarvestLogged",
  "namespace": "ma.terroir.events.product",
  "fields": [
    { "name": "eventId", "type": "string" },
    { "name": "correlationId", "type": "string" },
    { "name": "timestamp", "type": "string" },
    { "name": "version", "type": "int" },
    { "name": "source", "type": "string" },
    { "name": "harvestId", "type": "string" },
    { "name": "farmId", "type": "string" },
    { "name": "cooperativeId", "type": "string" },
    { "name": "productTypeCode", "type": "string" },
    { "name": "quantityKg", "type": "double" },
    { "name": "harvestDate", "type": "string" },
    { "name": "campaignYear", "type": "string" },
    { "name": "method", "type": "string" }
  ]
}
```

**`src/common/schemas/avro/product.batch.created.avsc`:**

```json
{
  "type": "record",
  "name": "ProductBatchCreated",
  "namespace": "ma.terroir.events.product",
  "fields": [
    { "name": "eventId", "type": "string" },
    { "name": "correlationId", "type": "string" },
    { "name": "timestamp", "type": "string" },
    { "name": "version", "type": "int" },
    { "name": "source", "type": "string" },
    { "name": "batchId", "type": "string" },
    { "name": "batchNumber", "type": "string" },
    { "name": "cooperativeId", "type": "string" },
    { "name": "productTypeCode", "type": "string" },
    { "name": "harvestIds", "type": { "type": "array", "items": "string" } },
    { "name": "totalQuantityKg", "type": "double" },
    { "name": "processingDate", "type": "string" }
  ]
}
```

**`src/common/schemas/avro/lab.test.submitted.avsc`:**

```json
{
  "type": "record",
  "name": "LabTestSubmitted",
  "namespace": "ma.terroir.events.product",
  "fields": [
    { "name": "eventId", "type": "string" },
    { "name": "correlationId", "type": "string" },
    { "name": "timestamp", "type": "string" },
    { "name": "version", "type": "int" },
    { "name": "source", "type": "string" },
    { "name": "labTestId", "type": "string" },
    { "name": "batchId", "type": "string" },
    { "name": "cooperativeId", "type": "string" },
    { "name": "productTypeCode", "type": "string" },
    { "name": "laboratoryId", "type": "string" },
    { "name": "submittedBy", "type": "string" },
    { "name": "expectedResultDate", "type": "string" }
  ]
}
```

**`src/common/schemas/avro/product.batch.processing_step_added.avsc`:**

```json
{
  "type": "record",
  "name": "ProductBatchProcessingStepAdded",
  "namespace": "ma.terroir.events.product",
  "fields": [
    { "name": "eventId", "type": "string" },
    { "name": "correlationId", "type": "string" },
    { "name": "timestamp", "type": "string" },
    { "name": "version", "type": "int" },
    { "name": "source", "type": "string" },
    { "name": "batchId", "type": "string" },
    { "name": "processingStepId", "type": "string" },
    { "name": "cooperativeId", "type": "string" },
    { "name": "stepType", "type": "string" },
    { "name": "doneAt", "type": "string" },
    { "name": "doneBy", "type": "string" },
    { "name": "notes", "type": ["null", "string"], "default": null }
  ]
}
```

**`src/common/schemas/avro/lab.test.completed.avsc`:**

```json
{
  "type": "record",
  "name": "LabTestCompleted",
  "namespace": "ma.terroir.events.product",
  "fields": [
    { "name": "eventId", "type": "string" },
    { "name": "correlationId", "type": "string" },
    { "name": "timestamp", "type": "string" },
    { "name": "version", "type": "int" },
    { "name": "source", "type": "string" },
    { "name": "labTestId", "type": "string" },
    { "name": "batchId", "type": "string" },
    { "name": "batchReference", "type": "string" },
    { "name": "cooperativeId", "type": "string" },
    { "name": "productTypeCode", "type": "string" },
    { "name": "productName", "type": "string" },
    { "name": "passed", "type": "boolean" },
    { "name": "testValues", "type": "string" },
    { "name": "failedParameters", "type": { "type": "array", "items": "string" } },
    { "name": "completedAt", "type": "string" },
    { "name": "technician", "type": "string" },
    { "name": "labName", "type": "string" }
  ]
}
```

**Verification:** All 9 files are valid JSON (`node -e "JSON.parse(require('fs').readFileSync('src/common/schemas/avro/cooperative.registration.submitted.avsc','utf8'))" -- no error`)

---

### Task 3 — Create 9 Avro schemas: certification

**`src/common/schemas/avro/certification.request.submitted.avsc`:**

```json
{
  "type": "record",
  "name": "CertificationRequestSubmitted",
  "namespace": "ma.terroir.events.certification",
  "fields": [
    { "name": "eventId", "type": "string" },
    { "name": "correlationId", "type": "string" },
    { "name": "timestamp", "type": "string" },
    { "name": "version", "type": "int" },
    { "name": "source", "type": "string" },
    { "name": "certificationRequestId", "type": "string" },
    { "name": "cooperativeId", "type": "string" },
    { "name": "batchId", "type": "string" },
    { "name": "productTypeCode", "type": "string" },
    { "name": "certificationType", "type": "string" },
    { "name": "requestedBy", "type": "string" }
  ]
}
```

**`src/common/schemas/avro/certification.inspection.scheduled.avsc`:**

```json
{
  "type": "record",
  "name": "CertificationInspectionScheduled",
  "namespace": "ma.terroir.events.certification",
  "fields": [
    { "name": "eventId", "type": "string" },
    { "name": "correlationId", "type": "string" },
    { "name": "timestamp", "type": "string" },
    { "name": "version", "type": "int" },
    { "name": "source", "type": "string" },
    { "name": "inspectionId", "type": "string" },
    { "name": "certificationRequestId", "type": "string" },
    { "name": "cooperativeId", "type": "string" },
    { "name": "cooperativeName", "type": "string" },
    { "name": "inspectorId", "type": "string" },
    { "name": "inspectorName", "type": "string" },
    { "name": "scheduledDate", "type": "string" },
    { "name": "location", "type": "string" },
    { "name": "farmIds", "type": { "type": "array", "items": "string" } }
  ]
}
```

**`src/common/schemas/avro/certification.decision.granted.avsc`:**

```json
{
  "type": "record",
  "name": "CertificationDecisionGranted",
  "namespace": "ma.terroir.events.certification",
  "fields": [
    { "name": "eventId", "type": "string" },
    { "name": "correlationId", "type": "string" },
    { "name": "timestamp", "type": "string" },
    { "name": "version", "type": "int" },
    { "name": "source", "type": "string" },
    { "name": "certificationId", "type": "string" },
    { "name": "certificationNumber", "type": "string" },
    { "name": "certificationType", "type": "string" },
    { "name": "cooperativeId", "type": "string" },
    { "name": "cooperativeName", "type": "string" },
    { "name": "productName", "type": "string" },
    { "name": "productTypeCode", "type": "string" },
    { "name": "batchId", "type": "string" },
    { "name": "regionCode", "type": "string" },
    { "name": "grantedBy", "type": "string" },
    { "name": "grantedAt", "type": "string" },
    { "name": "validFrom", "type": "string" },
    { "name": "validUntil", "type": "string" },
    { "name": "qrCodeId", "type": "string" }
  ]
}
```

**`src/common/schemas/avro/certification.decision.denied.avsc`:**

```json
{
  "type": "record",
  "name": "CertificationDecisionDenied",
  "namespace": "ma.terroir.events.certification",
  "fields": [
    { "name": "eventId", "type": "string" },
    { "name": "correlationId", "type": "string" },
    { "name": "timestamp", "type": "string" },
    { "name": "version", "type": "int" },
    { "name": "source", "type": "string" },
    { "name": "certificationRequestId", "type": "string" },
    { "name": "cooperativeId", "type": "string" },
    { "name": "batchId", "type": "string" },
    { "name": "deniedBy", "type": "string" },
    { "name": "reason", "type": "string" },
    { "name": "deniedAt", "type": "string" }
  ]
}
```

**`src/common/schemas/avro/certification.decision.revoked.avsc`:**

```json
{
  "type": "record",
  "name": "CertificationDecisionRevoked",
  "namespace": "ma.terroir.events.certification",
  "fields": [
    { "name": "eventId", "type": "string" },
    { "name": "correlationId", "type": "string" },
    { "name": "timestamp", "type": "string" },
    { "name": "version", "type": "int" },
    { "name": "source", "type": "string" },
    { "name": "certificationId", "type": "string" },
    { "name": "certificationNumber", "type": "string" },
    { "name": "cooperativeId", "type": "string" },
    { "name": "revokedBy", "type": "string" },
    { "name": "reason", "type": "string" },
    { "name": "revokedAt", "type": "string" }
  ]
}
```

**`src/common/schemas/avro/qrcode.generated.avsc`:**

```json
{
  "type": "record",
  "name": "QrCodeGenerated",
  "namespace": "ma.terroir.events.certification",
  "fields": [
    { "name": "eventId", "type": "string" },
    { "name": "correlationId", "type": "string" },
    { "name": "timestamp", "type": "string" },
    { "name": "version", "type": "int" },
    { "name": "source", "type": "string" },
    { "name": "qrCodeId", "type": "string" },
    { "name": "certificationId", "type": "string" },
    { "name": "certificationNumber", "type": "string" },
    { "name": "cooperativeId", "type": "string" },
    { "name": "verificationUrl", "type": "string" },
    { "name": "generatedAt", "type": "string" }
  ]
}
```

**`src/common/schemas/avro/certification.review.final-started.avsc`:**

```json
{
  "type": "record",
  "name": "CertificationReviewFinalStarted",
  "namespace": "ma.terroir.events.certification",
  "fields": [
    { "name": "eventId", "type": "string" },
    { "name": "correlationId", "type": "string" },
    { "name": "timestamp", "type": "string" },
    { "name": "version", "type": "int" },
    { "name": "source", "type": "string" },
    { "name": "certificationId", "type": "string" },
    { "name": "cooperativeId", "type": "string" },
    { "name": "actorId", "type": "string" }
  ]
}
```

**`src/common/schemas/avro/certification.renewed.avsc`:**

```json
{
  "type": "record",
  "name": "CertificationRenewed",
  "namespace": "ma.terroir.events.certification",
  "fields": [
    { "name": "eventId", "type": "string" },
    { "name": "correlationId", "type": "string" },
    { "name": "timestamp", "type": "string" },
    { "name": "version", "type": "int" },
    { "name": "source", "type": "string" },
    { "name": "oldCertificationId", "type": "string" },
    { "name": "newCertificationId", "type": "string" },
    { "name": "cooperativeId", "type": "string" },
    { "name": "renewedBy", "type": "string" }
  ]
}
```

**`src/common/schemas/avro/certification.inspection.inspector-assigned.avsc`:**

```json
{
  "type": "record",
  "name": "InspectionInspectorAssigned",
  "namespace": "ma.terroir.events.certification",
  "fields": [
    { "name": "eventId", "type": "string" },
    { "name": "correlationId", "type": "string" },
    { "name": "timestamp", "type": "string" },
    { "name": "version", "type": "int" },
    { "name": "source", "type": "string" },
    { "name": "inspectionId", "type": "string" },
    { "name": "certificationId", "type": "string" },
    { "name": "cooperativeId", "type": "string" },
    { "name": "inspectorId", "type": "string" },
    { "name": "inspectorName", "type": "string" },
    { "name": "scheduledDate", "type": "string" },
    { "name": "assignedBy", "type": "string" }
  ]
}
```

**Checkpoint:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 2 — Core Kafka Services

### Task 4 — Create `SchemaRegistryService`

**File:** `src/common/kafka/schema-registry.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchemaRegistry, SchemaType } from '@kafkajs/confluent-schema-registry';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SchemaRegistryService {
  private readonly logger = new Logger(SchemaRegistryService.name);
  private readonly registry: SchemaRegistry;
  private readonly schemaIdCache = new Map<string, number>();
  private registered = false;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SCHEMA_REGISTRY_URL', 'http://localhost:8081');
    this.registry = new SchemaRegistry({ host });
  }

  async encode<T>(subject: string, payload: T): Promise<Buffer> {
    const schemaId = this.schemaIdCache.get(subject);
    if (schemaId === undefined) {
      throw new Error(`No schema registered for subject "${subject}". Call registerAll() first.`);
    }
    return this.registry.encode(schemaId, payload);
  }

  async decode<T>(buffer: Buffer): Promise<T> {
    return this.registry.decode(buffer) as Promise<T>;
  }

  async registerAll(): Promise<void> {
    if (this.registered) return;

    const schemaDir = path.join(__dirname, '../schemas/avro');
    let files: string[];
    try {
      files = fs.readdirSync(schemaDir).filter((f) => f.endsWith('.avsc'));
    } catch {
      this.logger.warn({ schemaDir }, 'Avro schema directory not found — skipping registration');
      return;
    }

    const registryUrl = this.configService.get<string>(
      'SCHEMA_REGISTRY_URL',
      'http://localhost:8081',
    );

    for (const file of files) {
      const topic = file.replace('.avsc', '');
      const subject = `${topic}-value`;
      const schemaContent = fs.readFileSync(path.join(schemaDir, file), 'utf8');

      try {
        await fetch(`${registryUrl}/config/${subject}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/vnd.schemaregistry.v1+json' },
          body: JSON.stringify({ compatibility: 'BACKWARD' }),
        });

        const { id } = await this.registry.register(
          { type: SchemaType.AVRO, schema: schemaContent },
          { subject },
        );
        this.schemaIdCache.set(subject, id);
        this.logger.log({ subject, schemaId: id }, 'Avro schema registered');
      } catch (error) {
        this.logger.error({ error, subject }, 'Failed to register Avro schema');
        throw error;
      }
    }

    this.registered = true;
    this.logger.log({ count: files.length }, 'All Avro schemas registered');
  }
}
```

**Verification:** `npm run typecheck`

---

### Task 5 — Create `KafkaProducerService`

**File:** `src/common/kafka/kafka-producer.service.ts`

```typescript
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer } from 'kafkajs';
import { SchemaRegistryService } from './schema-registry.service';

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);
  private readonly producer: Producer;

  constructor(
    private readonly configService: ConfigService,
    private readonly schemaRegistry: SchemaRegistryService,
  ) {
    const brokers = this.configService.get<string>('KAFKA_BROKERS', 'localhost:19092').split(',');
    const clientId = this.configService.get<string>('KAFKA_CLIENT_ID', 'terroir-ma');
    const kafka = new Kafka({ clientId, brokers });
    this.producer = kafka.producer({ allowAutoTopicCreation: true });
  }

  async onModuleInit(): Promise<void> {
    await this.producer.connect();
    this.logger.log('Kafka producer connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.producer.disconnect();
    this.logger.log('Kafka producer disconnected');
  }

  async send<T>(topic: string, payload: T): Promise<void> {
    const subject = `${topic}-value`;
    const value = await this.schemaRegistry.encode(subject, payload);
    await this.producer.send({ topic, messages: [{ value }] });
  }
}
```

**Verification:** `npm run typecheck`

---

### Task 6 — Create `KafkaConsumerService` + `KafkaModule`

**File:** `src/common/kafka/kafka-consumer.service.ts`

```typescript
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Consumer } from 'kafkajs';
import { SchemaRegistryService } from './schema-registry.service';

type MessageHandler = (payload: unknown) => Promise<void>;

@Injectable()
export class KafkaConsumerService implements OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerService.name);
  private readonly consumer: Consumer;
  private readonly handlers = new Map<string, MessageHandler>();

  constructor(
    private readonly configService: ConfigService,
    private readonly schemaRegistry: SchemaRegistryService,
  ) {
    const brokers = this.configService.get<string>('KAFKA_BROKERS', 'localhost:19092').split(',');
    const clientId = this.configService.get<string>('KAFKA_CLIENT_ID', 'terroir-ma');
    const groupId = 'notification-group';
    const kafka = new Kafka({ clientId, brokers });
    this.consumer = kafka.consumer({ groupId });
  }

  subscribe<T>(topic: string, handler: (payload: T) => Promise<void>): void {
    this.handlers.set(topic, handler as MessageHandler);
    this.logger.log({ topic }, 'Handler registered for topic');
  }

  async startConsuming(): Promise<void> {
    if (this.handlers.size === 0) return;

    await this.consumer.connect();

    for (const topic of this.handlers.keys()) {
      await this.consumer.subscribe({ topic, fromBeginning: false });
    }

    await this.consumer.run({
      eachMessage: async ({ topic, message }) => {
        const handler = this.handlers.get(topic);
        if (!handler || !message.value) return;

        try {
          const payload = await this.schemaRegistry.decode(message.value);
          await handler(payload);
        } catch (error) {
          this.logger.error({ error, topic }, 'Failed to process Kafka message');
        }
      },
    });

    this.logger.log({ topics: [...this.handlers.keys()] }, 'Kafka consumer started');
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumer.disconnect();
    this.logger.log('Kafka consumer disconnected');
  }
}
```

**File:** `src/common/kafka/kafka.module.ts`

```typescript
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SchemaRegistryService } from './schema-registry.service';
import { KafkaProducerService } from './kafka-producer.service';
import { KafkaConsumerService } from './kafka-consumer.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [SchemaRegistryService, KafkaProducerService, KafkaConsumerService],
  exports: [SchemaRegistryService, KafkaProducerService, KafkaConsumerService],
})
export class KafkaModule {}
```

**Checkpoint:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 3 — AppModule Wiring + Producer Migration

### Task 7 — Wire `KafkaModule` in `AppModule` + `onApplicationBootstrap`

**File:** `src/app.module.ts` — modify to:

1. Import `KafkaModule` from `./common/kafka/kafka.module`
2. Add to `imports` array (alongside existing `KafkaClientModule`)
3. Implement `OnApplicationBootstrap`:

```typescript
// Add to imports at top of file:
import { OnApplicationBootstrap } from '@nestjs/common';
import { KafkaModule } from './common/kafka/kafka.module';
import { SchemaRegistryService } from './common/kafka/schema-registry.service';
import { KafkaConsumerService } from './common/kafka/kafka-consumer.service';

// Change class declaration:
export class AppModule implements OnApplicationBootstrap {
  constructor(
    private readonly schemaRegistryService: SchemaRegistryService,
    private readonly kafkaConsumerService: KafkaConsumerService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.schemaRegistryService.registerAll();
    await this.kafkaConsumerService.startConsuming();
  }
}
```

Add `KafkaModule` to `imports: [...]` array inside `@Module()`.

**Verification:** `npm run typecheck`

---

### Task 8 — Migrate `cooperative.producer.ts` + `product.producer.ts`

**`src/modules/cooperative/events/cooperative.producer.ts`:**

- Replace `@Inject('KAFKA_CLIENT') private readonly kafkaClient: ClientKafka` with `private readonly kafkaProducer: KafkaProducerService`
- Remove `import { ClientKafka }` and `import { Inject }` (keep `Injectable`, `Logger`)
- Add `import { KafkaProducerService } from '../../../common/kafka/kafka-producer.service'`
- Replace every `await this.kafkaClient.emit('topic', event).toPromise()` with `await this.kafkaProducer.send('topic', event)`

**`src/modules/product/events/product.producer.ts`:**

- Same pattern as cooperative producer
- Topics: `product.harvest.logged`, `product.batch.created`, `lab.test.submitted`, `product.batch.processing_step_added`, `lab.test.completed`

**Note:** The existing `ClientsModule` / `KAFKA_CLIENT` injection in `CooperativeModule` / `ProductModule` must also be removed since producers no longer need it. Check `cooperative.module.ts` and `product.module.ts` for `KafkaClientModule` / `ClientsModule` imports and remove if unused.

**Verification:** `npm run typecheck`

---

### Task 9 — Migrate `certification.producer.ts`

**`src/modules/certification/events/certification.producer.ts`:**

- Same pattern as Task 8
- Replace `ClientKafka` injection with `KafkaProducerService`
- Topics: `certification.request.submitted`, `certification.inspection.scheduled`, `certification.decision.granted`, `certification.decision.denied`, `certification.decision.revoked`, `qrcode.generated`, `certification.review.final-started`, `certification.renewed`, `certification.inspection.inspector-assigned`
- Remove import of `ClientKafka`, `Inject` (keep `Injectable`, `Logger`)

**Checkpoint:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 4 — Consumer Migration

### Task 10 — Refactor `NotificationListener` (fix dormant @EventPattern)

**File:** `src/modules/notification/listeners/notification.listener.ts`

Complete rewrite — remove `@Controller()`, `@EventPattern`, `@Payload()`, `@Ctx()`, `KafkaContext`. Keep handler methods, add `OnModuleInit`.

```typescript
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type {
  CertificationDecisionGrantedEvent,
  CertificationInspectionScheduledEvent,
  InspectionInspectorAssignedEvent,
} from '../../../common/interfaces/events/certification.events';
import type { CooperativeDeactivatedEvent } from '../../../common/interfaces/events/cooperative.events';
import type { LabTestCompletedEvent } from '../../../common/interfaces/events/certification.events';
import { KafkaConsumerService } from '../../../common/kafka/kafka-consumer.service';
import { NotificationService } from '../services/notification.service';

@Injectable()
export class NotificationListener implements OnModuleInit {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly kafkaConsumerService: KafkaConsumerService,
  ) {}

  onModuleInit(): void {
    this.kafkaConsumerService.subscribe('certification.decision.granted', (p) =>
      this.handleCertificationGranted(p as CertificationDecisionGrantedEvent),
    );
    this.kafkaConsumerService.subscribe('lab.test.completed', (p) =>
      this.handleLabTestCompleted(p as LabTestCompletedEvent),
    );
    this.kafkaConsumerService.subscribe('cooperative.cooperative.deactivated', (p) =>
      this.handleCooperativeDeactivated(p as CooperativeDeactivatedEvent),
    );
    this.kafkaConsumerService.subscribe('certification.inspection.inspector-assigned', (p) =>
      this.handleInspectorAssigned(p as InspectionInspectorAssignedEvent),
    );
    this.kafkaConsumerService.subscribe('certification.inspection.scheduled', (p) =>
      this.handleInspectionScheduled(p as CertificationInspectionScheduledEvent),
    );
  }

  async handleCertificationGranted(data: CertificationDecisionGrantedEvent): Promise<void> {
    try {
      this.logger.log(
        { eventId: data.eventId, certificationId: data.certificationId },
        'Certification granted — sending notification',
      );
      await this.notificationService.send({
        recipientId: data.cooperativeId,
        channel: 'email',
        templateCode: 'certification-granted',
        language: 'fr-MA',
        context: {
          certificationNumber: data.certificationNumber,
          productName: data.productName,
          cooperativeName: data.cooperativeName,
          grantedAt: data.grantedAt,
        },
        triggerEventId: data.eventId,
        correlationId: data.correlationId,
      });
    } catch (error) {
      this.logger.error(
        { error, eventId: data.eventId },
        'Failed to process certification.decision.granted',
      );
    }
  }

  async handleLabTestCompleted(data: LabTestCompletedEvent): Promise<void> {
    try {
      this.logger.log(
        { eventId: data.eventId, batchId: data.batchId, passed: data.passed },
        'Lab test completed — sending notification',
      );
      await this.notificationService.send({
        recipientId: data.cooperativeId,
        channel: 'email',
        templateCode: 'lab-test-completed',
        language: 'fr-MA',
        context: {
          batchReference: data.batchReference,
          productName: data.productName,
          passed: data.passed,
          completedAt: data.completedAt,
          labName: data.labName,
        },
        triggerEventId: data.eventId,
        correlationId: data.correlationId,
      });
    } catch (error) {
      this.logger.error({ error, eventId: data.eventId }, 'Failed to process lab.test.completed');
    }
  }

  async handleCooperativeDeactivated(data: CooperativeDeactivatedEvent): Promise<void> {
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

  async handleInspectorAssigned(data: InspectionInspectorAssignedEvent): Promise<void> {
    try {
      this.logger.log(
        { eventId: data.eventId, inspectionId: data.inspectionId },
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

  async handleInspectionScheduled(data: CertificationInspectionScheduledEvent): Promise<void> {
    try {
      this.logger.log(
        { eventId: data.eventId, inspectionId: data.inspectionId },
        'Inspection scheduled — sending notification',
      );
      await this.notificationService.send({
        recipientId: data.cooperativeId,
        channel: 'email',
        templateCode: 'inspection-scheduled',
        language: 'fr-MA',
        context: {
          cooperativeName: data.cooperativeName,
          inspectorName: data.inspectorName,
          scheduledDate: data.scheduledDate,
          location: data.location,
        },
        triggerEventId: data.eventId,
        correlationId: data.correlationId,
      });
    } catch (error) {
      this.logger.error(
        { error, eventId: data.eventId },
        'Failed to process certification.inspection.scheduled',
      );
    }
  }
}
```

**Note:** `LabTestCompletedEvent` is in `certification.events.ts` (it's imported as `LabTestCompletedEvent` from there in the current code). Verify import path — it may be `product` events. Adjust as needed.

**Note:** Move `NotificationListener` from `controllers` array to `providers` array in `NotificationModule` (it was already in providers, but remove from controllers if it appears there).

**Verification:** `npm run typecheck`

---

### Task 11 — Update `notification.listener.spec.ts` + `NotificationModule`

**`test/unit/notification/notification.listener.spec.ts`:**

- Add `KafkaConsumerService` mock to `Test.createTestingModule`
- Remove `{} as never` second argument from all `handler.handleXxx(event, {} as never)` calls → `handler.handleXxx(event)`
- Add test for `onModuleInit()` registering all 5 topics

```typescript
const mockKafkaConsumerService = {
  subscribe: jest.fn(),
};

// In beforeEach:
{ provide: KafkaConsumerService, useValue: mockKafkaConsumerService }

// New test:
it('onModuleInit() registers handlers for all 5 topics', () => {
  listener.onModuleInit();
  expect(mockKafkaConsumerService.subscribe).toHaveBeenCalledTimes(5);
  expect(mockKafkaConsumerService.subscribe).toHaveBeenCalledWith('certification.decision.granted', expect.any(Function));
  expect(mockKafkaConsumerService.subscribe).toHaveBeenCalledWith('lab.test.completed', expect.any(Function));
  expect(mockKafkaConsumerService.subscribe).toHaveBeenCalledWith('cooperative.cooperative.deactivated', expect.any(Function));
  expect(mockKafkaConsumerService.subscribe).toHaveBeenCalledWith('certification.inspection.inspector-assigned', expect.any(Function));
  expect(mockKafkaConsumerService.subscribe).toHaveBeenCalledWith('certification.inspection.scheduled', expect.any(Function));
});
```

**`src/modules/notification/notification.module.ts`:**

- `KafkaConsumerService` is provided by `KafkaModule` which is `@Global()` — no explicit import needed
- Ensure `NotificationListener` is in `providers` array (not `controllers`)

**Verification:** `npm run typecheck`

---

### Task 12 — Create producer unit tests (cooperative + product + certification)

**`test/unit/cooperative/cooperative.producer.spec.ts`** (NEW):

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { CooperativeProducer } from '../../../src/modules/cooperative/events/cooperative.producer';
import { KafkaProducerService } from '../../../src/common/kafka/kafka-producer.service';

const mockKafkaProducer = { send: jest.fn().mockResolvedValue(undefined) };

describe('CooperativeProducer', () => {
  let producer: CooperativeProducer;
  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CooperativeProducer,
        { provide: KafkaProducerService, useValue: mockKafkaProducer },
      ],
    }).compile();
    producer = module.get<CooperativeProducer>(CooperativeProducer);
  });

  it('publishRegistrationSubmitted() sends to cooperative.registration.submitted', async () => {
    await producer.publishRegistrationSubmitted(
      {
        id: 'c-001',
        name: 'Test',
        ice: '001234567000012',
        regionCode: 'SFI',
        presidentName: 'Ali',
        presidentCin: 'AB123456',
      } as never,
      'corr-001',
    );
    expect(mockKafkaProducer.send).toHaveBeenCalledWith(
      'cooperative.registration.submitted',
      expect.objectContaining({ cooperativeId: 'c-001' }),
    );
  });

  it('swallows producer errors without rethrowing', async () => {
    mockKafkaProducer.send.mockRejectedValueOnce(new Error('broker down'));
    await expect(
      producer.publishRegistrationSubmitted({ id: 'c-001' } as never, 'corr-001'),
    ).resolves.toBeUndefined();
  });
});
```

Create similar spec files for `product.producer.spec.ts` and `certification.producer.spec.ts` with 2 tests each (happy path + error swallow).

**Checkpoint:** `npm run lint && npm run typecheck && npm run test:unit`

---

## Batch 5 — Tests

### Task 13 — `schema-registry.service.spec.ts`

**File:** `test/unit/common/schema-registry.service.spec.ts`

```typescript
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SchemaRegistryService } from '@common/kafka/schema-registry.service';

jest.mock('@kafkajs/confluent-schema-registry', () => ({
  SchemaRegistry: jest.fn().mockImplementation(() => ({
    register: jest.fn().mockResolvedValue({ id: 42 }),
    encode: jest.fn().mockResolvedValue(Buffer.from('avro-encoded')),
    decode: jest.fn().mockResolvedValue({ eventId: 'test' }),
  })),
  SchemaType: { AVRO: 'AVRO' },
}));

jest.mock('fs', () => ({
  readdirSync: jest.fn().mockReturnValue(['cooperative.registration.submitted.avsc']),
  readFileSync: jest
    .fn()
    .mockReturnValue(JSON.stringify({ type: 'record', name: 'Test', fields: [] })),
}));

jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response);

describe('SchemaRegistryService', () => {
  let service: SchemaRegistryService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SchemaRegistryService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('http://localhost:8081') },
        },
      ],
    }).compile();
    service = module.get(SchemaRegistryService);
  });

  it('encode() returns a Buffer after registerAll()', async () => {
    await service.registerAll();
    const result = await service.encode('cooperative.registration.submitted-value', {
      eventId: 'test',
    });
    expect(result).toBeInstanceOf(Buffer);
  });

  it('decode() returns typed payload', async () => {
    const result = await service.decode<{ eventId: string }>(Buffer.from('avro'));
    expect(result.eventId).toBe('test');
  });

  it('encode() throws if registerAll() was not called', async () => {
    await expect(service.encode('unknown-value', {})).rejects.toThrow('No schema registered');
  });

  it('registerAll() is idempotent (calls register once per subject)', async () => {
    await service.registerAll();
    await service.registerAll();
    const { SchemaRegistry } = await import('@kafkajs/confluent-schema-registry');
    const instance = (SchemaRegistry as jest.Mock).mock.results[0].value;
    expect(instance.register).toHaveBeenCalledTimes(1);
  });
});
```

**Verification:** `npm run test:unit -- --testPathPattern=schema-registry`

---

### Task 14 — `kafka-producer.service.spec.ts` + `kafka-consumer.service.spec.ts`

**`test/unit/common/kafka-producer.service.spec.ts`:**

```typescript
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { KafkaProducerService } from '@common/kafka/kafka-producer.service';
import { SchemaRegistryService } from '@common/kafka/schema-registry.service';

const mockProducer = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  send: jest.fn().mockResolvedValue(undefined),
};
jest.mock('kafkajs', () => ({ Kafka: jest.fn(() => ({ producer: jest.fn(() => mockProducer) })) }));

const mockSchemaRegistry = { encode: jest.fn().mockResolvedValue(Buffer.from('avro')) };

describe('KafkaProducerService', () => {
  let service: KafkaProducerService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        KafkaProducerService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'KAFKA_BROKERS' ? 'localhost:19092' : 'terroir-ma',
            ),
          },
        },
        { provide: SchemaRegistryService, useValue: mockSchemaRegistry },
      ],
    }).compile();
    service = module.get(KafkaProducerService);
  });

  it('send() encodes payload and calls producer.send()', async () => {
    await service.send('certification.decision.granted', { eventId: 'test' });
    expect(mockSchemaRegistry.encode).toHaveBeenCalledWith('certification.decision.granted-value', {
      eventId: 'test',
    });
    expect(mockProducer.send).toHaveBeenCalledWith(
      expect.objectContaining({ topic: 'certification.decision.granted' }),
    );
  });

  it('onModuleInit() connects the producer', async () => {
    await service.onModuleInit();
    expect(mockProducer.connect).toHaveBeenCalled();
  });

  it('onModuleDestroy() disconnects the producer', async () => {
    await service.onModuleDestroy();
    expect(mockProducer.disconnect).toHaveBeenCalled();
  });
});
```

**`test/unit/common/kafka-consumer.service.spec.ts`** — similar pattern: mock `kafkajs` Consumer; verify `subscribe()` stores handler; verify `startConsuming()` calls consumer.connect + consumer.subscribe + consumer.run (3 tests).

**Checkpoint:** `npm run lint && npm run typecheck && npm run test:unit`

---

### Task 15 — Integration test: Avro round-trip with Testcontainers Redpanda

**File:** `test/integration/kafka/avro-roundtrip.integration.ts`

```typescript
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { Kafka, Producer, Consumer } from 'kafkajs';
import { SchemaRegistry, SchemaType } from '@kafkajs/confluent-schema-registry';

describe('Avro round-trip integration', () => {
  let container: StartedTestContainer;
  let producer: Producer;
  let consumer: Consumer;
  let registry: SchemaRegistry;

  const TOPIC = 'test.certification.decision.granted';
  const SUBJECT = `${TOPIC}-value`;
  const TEST_SCHEMA = {
    type: 'record',
    name: 'TestEvent',
    namespace: 'ma.terroir.test',
    fields: [
      { name: 'eventId', type: 'string' },
      { name: 'certificationId', type: 'string' },
    ],
  };

  beforeAll(async () => {
    container = await new GenericContainer('redpandadata/redpanda:latest')
      .withExposedPorts(9092, 8081)
      .withCommand([
        'redpanda',
        'start',
        '--smp=1',
        '--memory=256M',
        '--reserve-memory=0M',
        '--overprovisioned',
        '--node-id=0',
        '--check=false',
        '--kafka-addr=0.0.0.0:9092',
        '--advertise-kafka-addr=localhost:9092',
        '--schema-registry-addr=0.0.0.0:8081',
      ])
      .start();

    const brokerPort = container.getMappedPort(9092);
    const registryPort = container.getMappedPort(8081);
    const brokers = [`localhost:${brokerPort}`];
    const registryUrl = `http://localhost:${registryPort}`;

    registry = new SchemaRegistry({ host: registryUrl });

    const kafka = new Kafka({ clientId: 'test-client', brokers });
    producer = kafka.producer();
    consumer = kafka.consumer({ groupId: 'test-group' });

    await producer.connect();
    await consumer.connect();
  }, 120_000);

  afterAll(async () => {
    await producer.disconnect();
    await consumer.disconnect();
    await container.stop();
  });

  it('encodes an event as Avro and decodes it back to the original payload', async () => {
    const { id: schemaId } = await registry.register(
      { type: SchemaType.AVRO, schema: JSON.stringify(TEST_SCHEMA) },
      { subject: SUBJECT },
    );

    const original = { eventId: 'evt-001', certificationId: 'cert-001' };
    const encoded = await registry.encode(schemaId, original);

    await producer.send({ topic: TOPIC, messages: [{ value: encoded }] });

    let decoded: typeof original | null = null;
    await consumer.subscribe({ topic: TOPIC, fromBeginning: true });
    await new Promise<void>((resolve) => {
      consumer.run({
        eachMessage: async ({ message }) => {
          decoded = await registry.decode(message.value!);
          resolve();
        },
      });
    });

    expect(decoded).toEqual(original);
  }, 60_000);
});
```

**Final checkpoint:**

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration -- --testPathPattern=avro-roundtrip
```

---

## Testing Summary

| Test file                                                | Type        | Count      | Covers                                      |
| -------------------------------------------------------- | ----------- | ---------- | ------------------------------------------- |
| `test/unit/common/schema-registry.service.spec.ts`       | Unit        | 4          | encode, decode, throws, idempotent          |
| `test/unit/common/kafka-producer.service.spec.ts`        | Unit        | 3          | send, connect, disconnect                   |
| `test/unit/common/kafka-consumer.service.spec.ts`        | Unit        | 3          | subscribe, startConsuming, handler dispatch |
| `test/unit/cooperative/cooperative.producer.spec.ts`     | Unit        | 2          | happy path + error swallow                  |
| `test/unit/product/product.producer.spec.ts`             | Unit        | 2          | happy path + error swallow                  |
| `test/unit/certification/certification.producer.spec.ts` | Unit        | 2          | happy path + error swallow                  |
| `test/unit/notification/notification.listener.spec.ts`   | Unit        | +1 updated | onModuleInit registers 5 handlers           |
| `test/integration/kafka/avro-roundtrip.integration.ts`   | Integration | 1          | full encode→produce→consume→decode cycle    |

**Target:** 400 → 417+ unit tests passing (18 new), 29 → 30+ integration tests passing

---

## Risks

| Risk                                                                                                                | Mitigation                                                                         |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `@kafkajs/confluent-schema-registry` v3 `register()` options differ from v2                                         | Check package docs after install; fallback: call compatibility endpoint separately |
| `LabTestCompletedEvent` import path — currently lives in `certification.events.ts` but logically belongs to product | Leave in place; don't move types during this sprint                                |
| Testcontainers Redpanda image takes >60s to start                                                                   | `beforeAll` timeout set to 120s                                                    |
| `schemaIdCache` not populated if `registerAll()` fails silently                                                     | `registerAll()` re-throws on error; test coverage verifies this                    |
| Avro `"int"` vs `"long"` for `version: number`                                                                      | Use `"int"` — version is always 1–9999                                             |
