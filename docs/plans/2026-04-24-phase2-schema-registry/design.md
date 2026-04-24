# Design — Phase 2: Kafka Schema Registry + Avro

**Date:** 2026-04-24  
**Scope:** Migrate ALL 27 existing certification chain events to Avro with Redpanda built-in Schema Registry  
**Phase:** 2  
**Backlog ref:** Phase 2 Kafka Schema Registry

---

## Problem

All 27 Kafka events are currently plain JSON with no enforced schema. A producer can add, rename, or remove fields without consumers failing at compile time. As the certification chain grows this is a correctness risk — especially for immutable chain events (append-only, legally significant under Law 25-06).

---

## Scope (chosen: Option B)

- Migrate all 27 events from JSON → Avro
- Redpanda's built-in Schema Registry (`:8081`) — no extra container needed
- `BACKWARD` compatibility mode: new schemas may only add optional fields
- Coordinated cutover: since this is a modular monolith, all producers and consumers restart together
- `scripts/register-schemas.ts` to register schemas on startup / deploy

---

## Why Avro over Protobuf/JSON Schema

Redpanda supports all three. Avro is chosen because:

- Best tooling with `@kafkajs/confluent-schema-registry`
- Schema evolution rules are explicit and enforced by the registry
- Compact binary wire format (smaller than JSON, unlike Protobuf requires no codegen)

---

## Architecture

```
Producer (e.g. CertificationProducer)
  └── SchemaRegistryService.encode(eventType, payload)
        ├── fetches schema ID from registry (cached in-memory)
        └── encodes payload as Avro binary with magic byte + schema ID prefix
  └── KafkaJS.send({ value: avroBuffer })

Consumer (e.g. NotificationConsumer)
  └── KafkaJS.run({ eachMessage: async ({ message }) => ... })
        └── SchemaRegistryService.decode(message.value)
              ├── reads schema ID from magic byte prefix
              ├── fetches Avro schema from registry (cached)
              └── returns typed JS object

Redpanda Schema Registry
  └── :8081 (same Redpanda container, no extra service)
  └── BACKWARD compatibility enforced per subject
```

---

## Event Inventory — 27 Events

All events are defined in `src/common/interfaces/events/`. Each maps to one Avro schema subject: `<topic>-value`.

| #   | Topic                                   | Event Type                           | Module        |
| --- | --------------------------------------- | ------------------------------------ | ------------- |
| 1   | cooperative.member.registered           | CooperativeMemberRegistered          | cooperative   |
| 2   | cooperative.farm.created                | CooperativeFarmCreated               | cooperative   |
| 3   | cooperative.batch.created               | CooperativeBatchCreated              | cooperative   |
| 4   | product.specification.created           | ProductSpecificationCreated          | product       |
| 5   | product.specification.updated           | ProductSpecificationUpdated          | product       |
| 6   | certification.request.submitted         | CertificationRequestSubmitted        | certification |
| 7   | certification.inspection.scheduled      | CertificationInspectionScheduled     | certification |
| 8   | certification.inspection.completed      | CertificationInspectionCompleted     | certification |
| 9   | certification.sample.collected          | CertificationSampleCollected         | certification |
| 10  | certification.labtest.submitted         | CertificationLabTestSubmitted        | certification |
| 11  | certification.labtest.passed            | CertificationLabTestPassed           | certification |
| 12  | certification.labtest.failed            | CertificationLabTestFailed           | certification |
| 13  | certification.review.started            | CertificationReviewStarted           | certification |
| 14  | certification.decision.granted          | CertificationDecisionGranted         | certification |
| 15  | certification.decision.denied           | CertificationDecisionDenied          | certification |
| 16  | certification.decision.revoked          | CertificationDecisionRevoked         | certification |
| 17  | certification.certificate.issued        | CertificationCertificateIssued       | certification |
| 18  | certification.qr.generated              | CertificationQrGenerated             | certification |
| 19  | certification.qr.scanned                | CertificationQrScanned               | certification |
| 20  | certification.export.document.created   | CertificationExportDocumentCreated   | certification |
| 21  | certification.export.document.validated | CertificationExportDocumentValidated | certification |
| 22  | notification.email.requested            | NotificationEmailRequested           | notification  |
| 23  | notification.email.sent                 | NotificationEmailSent                | notification  |
| 24  | notification.email.failed               | NotificationEmailFailed              | notification  |
| 25  | notification.sms.requested              | NotificationSmsRequested             | notification  |
| 26  | audit.event.logged                      | AuditEventLogged                     | common        |
| 27  | certification.chain.integrity.checked   | CertificationChainIntegrityChecked   | certification |

---

## Avro Schema Structure

All events share a common envelope. Example for `certification.decision.granted`:

```json
{
  "type": "record",
  "name": "CertificationDecisionGranted",
  "namespace": "ma.terroir.events.certification",
  "fields": [
    { "name": "eventId", "type": "string" },
    { "name": "correlationId", "type": "string" },
    { "name": "timestamp", "type": "string" },
    { "name": "version", "type": "string", "default": "1" },
    { "name": "certificationId", "type": "string" },
    { "name": "grantedBy", "type": "string" },
    { "name": "certificationNumber", "type": "string" },
    { "name": "validFrom", "type": "string" },
    { "name": "validUntil", "type": "string" },
    { "name": "notes", "type": ["null", "string"], "default": null }
  ]
}
```

**JSONB lab parameters** (event #10-12): encoded as `"type": "string"` (JSON-stringified) since Avro has no native map-of-unknown-type. This is the YAGNI approach — typed Avro record for lab params is Phase 3 when product types stabilize.

---

## SchemaRegistryService

```typescript
// src/common/kafka/schema-registry.service.ts
class SchemaRegistryService {
  private readonly registry: SchemaRegistry; // @kafkajs/confluent-schema-registry

  async encode<T>(subject: string, payload: T): Promise<Buffer>;
  async decode<T>(buffer: Buffer): Promise<T>;
  async registerAll(): Promise<void>; // called on app bootstrap
}
```

`registerAll()` is called once in `AppModule.onApplicationBootstrap()`. It reads all `.avsc` files from `src/common/schemas/avro/`, registers each subject with `BACKWARD` compatibility. Idempotent — Redpanda returns existing schema ID if unchanged.

---

## Migration Cutover Plan

Since this is a modular monolith (single process), the cutover is a simple restart:

1. Register all schemas (`registerAll()` on bootstrap)
2. Update all producers to use `SchemaRegistryService.encode()`
3. Update all consumers to use `SchemaRegistryService.decode()`
4. Restart app — consumers immediately read Avro; producers immediately write Avro
5. **No dual-write needed** — topics are not durable across the restart window in dev; in staging, drain topics before restart

**Risk:** Unconsumed messages in topics during restart will be encoded in old JSON format but decoded as Avro → will fail. Mitigation: restart Redpanda topics with `--from-beginning` after cutover in dev. For staging: coordinate a maintenance window.

---

## Files to Create / Modify

| Action | Path                                                                              |
| ------ | --------------------------------------------------------------------------------- |
| CREATE | `src/common/schemas/avro/` — 27 `.avsc` files                                     |
| CREATE | `src/common/kafka/schema-registry.service.ts`                                     |
| CREATE | `scripts/register-schemas.ts` — standalone registration script                    |
| MODIFY | `src/common/kafka/kafka.module.ts` — export SchemaRegistryService                 |
| MODIFY | `src/common/kafka/kafka-producer.service.ts` — use SchemaRegistryService.encode() |
| MODIFY | `src/common/kafka/kafka-consumer.service.ts` — use SchemaRegistryService.decode() |
| MODIFY | `src/app.module.ts` — call registerAll() on bootstrap                             |
| MODIFY | `.env.example` — add SCHEMA_REGISTRY_URL                                          |
| MODIFY | `docker-compose.yml` — expose Redpanda Schema Registry port :8081                 |

---

## Dependencies

```
@kafkajs/confluent-schema-registry@3.x   — encode/decode + registry client
avsc@5.x                                  — Avro schema parsing (peer dep)
```

---

## Environment Variables

```
SCHEMA_REGISTRY_URL=http://redpanda:8081
```

---

## Testing

- Unit: `SchemaRegistryService` — mock registry client; verify encode returns Buffer; verify decode returns typed object; verify unknown schema ID throws
- Integration (Testcontainers): spin up Redpanda with Schema Registry enabled; register a schema; encode a test event; decode it back; assert round-trip equality
- Regression: all 391 existing unit tests must still pass (producers/consumers are mocked in unit tests — no change to mock surface)

---

## YAGNI Notes

- No Avro code generation (avro-typescript etc.) — use plain `.avsc` + runtime encode/decode; typed interfaces already exist in `src/common/interfaces/events/`
- No schema versioning UI — Redpanda Console (already in docker-compose) handles this
- JSONB lab params stay as `string` — fully typed Avro for lab params is Phase 3
- No consumer group migration scripts — dev environment; staging gets a maintenance window
