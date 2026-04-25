# P2-S3 Execution Progress

**Plan:** `docs/plans/2026-04-24-phase2-schema-registry/plan.md`
**Last updated:** 2026-04-25

## Status

| Task | Title                                                              | Status       |
| ---- | ------------------------------------------------------------------ | ------------ |
| 1    | Install packages, env config, nest-cli.json                        | ✅ completed |
| 2    | Avro schemas — cooperative (4) + product (5)                       | ✅ completed |
| 3    | Avro schemas — certification (9)                                   | ✅ completed |
| 4    | SchemaRegistryService                                              | ✅ completed |
| 5    | KafkaProducerService                                               | ✅ completed |
| 6    | KafkaConsumerService + KafkaModule                                 | ✅ completed |
| 7    | Wire KafkaModule in AppModule + onApplicationBootstrap             | ✅ completed |
| 8    | Migrate cooperative.producer + product.producer                    | ✅ completed |
| 9    | Migrate certification.producer                                     | ✅ completed |
| 10   | Refactor NotificationListener (fix dormant @EventPattern)          | ✅ completed |
| 11   | Update notification.listener.spec.ts + NotificationModule          | ✅ completed |
| 12   | Producer unit tests (cooperative + product + certification)        | ✅ completed |
| 13   | schema-registry.service.spec.ts                                    | ✅ completed |
| 14   | kafka-producer.service.spec.ts + kafka-consumer.service.spec.ts    | ✅ completed |
| 15   | Integration test — Avro round-trip (avro-roundtrip.integration.ts) | ✅ completed |

## Batch Log

### Batch 1 (Tasks 1–3) — 2026-04-25

- ✅ Task 1: `npm install @kafkajs/confluent-schema-registry avsc`; added `SCHEMA_REGISTRY_URL` to `.env.example`, `infrastructure/docker/.env.example`, `infrastructure/docker/.env.docker`, `src/config/env.validation.ts`; updated `nest-cli.json` with avsc assets config
- ✅ Task 2: 9 `.avsc` files created in `src/common/schemas/avro/` — cooperative (4) + product (5); all valid JSON
- ✅ Task 3: 9 `.avsc` files created — certification (9); all valid JSON; total 18 schemas
- Verification: lint ✅ (0 errors) | typecheck ✅ | test:unit ✅ 400/400

### Batch 2 (Tasks 4–6) — 2026-04-25

- ✅ Task 4: `src/common/kafka/schema-registry.service.ts` — wraps `@kafkajs/confluent-schema-registry`, reads `.avsc` files, sets BACKWARD compat, caches schema IDs, idempotent `registerAll()`
- ✅ Task 5: `src/common/kafka/kafka-producer.service.ts` — raw KafkaJS producer, `send<T>(topic, payload)` calls `schemaRegistry.encode()` then `producer.send()`
- ✅ Task 6: `src/common/kafka/kafka-consumer.service.ts` + `kafka.module.ts` — raw KafkaJS consumer, `subscribe()` registers handlers pre-start, `startConsuming()` connects + decodes Avro messages
- Verification: lint ✅ | typecheck ✅ | test:unit ✅ 400/400

### Batch 3 (Tasks 7–9) — 2026-04-25

- ✅ Task 7: `AppModule` imports `KafkaModule`, implements `OnApplicationBootstrap`, calls `registerAll()` then `startConsuming()` at boot
- ✅ Task 8: `cooperative.producer.ts` + `product.producer.ts` migrated — removed `ClientKafka`, injecting `KafkaProducerService`; `testValues` in `publishLabTestCompleted()` is `JSON.stringify`-ed (Avro schema stores as string)
- ✅ Task 9: `certification.producer.ts` migrated — all 9 topics now use `kafkaProducer.send()`
- Verification: lint ✅ | typecheck ✅ | test:unit ✅ 400/400

### Batch 4 (Tasks 10–12) — 2026-04-25

- ✅ Task 10: `NotificationListener` completely refactored — removed `@Controller()`, `@EventPattern()`, `@Ctx()`, `KafkaContext`; added `OnModuleInit`, registers 5 handlers via `KafkaConsumerService.subscribe()` in `onModuleInit()`; fixes previously-dormant Kafka notifications
- ✅ Task 11: `notification.listener.spec.ts` updated — added `KafkaConsumerService` mock, removed `{} as never` second arg from all handler calls, added `onModuleInit()` test verifying 5 topic registrations
- ✅ Task 12: 3 new producer spec files created (`cooperative.producer.spec.ts`, `product.producer.spec.ts`, `certification.producer.spec.ts`) with happy-path + error-swallow tests
- Verification: lint ✅ | typecheck ✅ | test:unit ✅ 413/413

### Batch 5 (Tasks 13–15) — 2026-04-25

- ✅ Task 13: `schema-registry.service.spec.ts` — 7 tests covering encode/decode/registerAll idempotency/BACKWARD compat/throws-if-not-registered
- ✅ Task 14: `kafka-producer.service.spec.ts` (5 tests) + `kafka-consumer.service.spec.ts` (7 tests) — mock kafkajs; verify encode→send pipeline; verify subscribe→decode→handler dispatch
- ✅ Task 15: `test/integration/kafka/avro-roundtrip.integration.ts` — full round-trip test using Testcontainers Redpanda
- Verification: lint ✅ | typecheck ✅ | test:unit ✅ **432/432** (+32 new tests)

## Final Test Results

| Suite             | Before | After | Delta                            |
| ----------------- | ------ | ----- | -------------------------------- |
| Unit test suites  | 39     | 45    | +6                               |
| Unit tests        | 400    | 432   | +32                              |
| Integration tests | 29     | 29    | ±0 (avro-roundtrip needs Docker) |
| E2E tests         | 35     | 35    | ±0                               |

## Files Created

| File                                                     | Type             |
| -------------------------------------------------------- | ---------------- |
| `src/common/schemas/avro/*.avsc` (18 files)              | Avro schemas     |
| `src/common/kafka/schema-registry.service.ts`            | Service          |
| `src/common/kafka/kafka-producer.service.ts`             | Service          |
| `src/common/kafka/kafka-consumer.service.ts`             | Service          |
| `src/common/kafka/kafka.module.ts`                       | Module           |
| `test/unit/common/schema-registry.service.spec.ts`       | Unit test        |
| `test/unit/common/kafka-producer.service.spec.ts`        | Unit test        |
| `test/unit/common/kafka-consumer.service.spec.ts`        | Unit test        |
| `test/unit/cooperative/cooperative.producer.spec.ts`     | Unit test        |
| `test/unit/product/product.producer.spec.ts`             | Unit test        |
| `test/unit/certification/certification.producer.spec.ts` | Unit test        |
| `test/integration/kafka/avro-roundtrip.integration.ts`   | Integration test |

## Files Modified

| File                                                          | Change                                                           |
| ------------------------------------------------------------- | ---------------------------------------------------------------- |
| `.env.example`                                                | Added `SCHEMA_REGISTRY_URL`                                      |
| `infrastructure/docker/.env.example`                          | Added `SCHEMA_REGISTRY_URL=http://redpanda:8081`                 |
| `infrastructure/docker/.env.docker`                           | Added `SCHEMA_REGISTRY_URL=http://redpanda:8081`                 |
| `src/config/env.validation.ts`                                | Added `SCHEMA_REGISTRY_URL` Joi rule                             |
| `nest-cli.json`                                               | Added `.avsc` assets config                                      |
| `src/app.module.ts`                                           | Import `KafkaModule`, implement `OnApplicationBootstrap`         |
| `src/modules/cooperative/events/cooperative.producer.ts`      | Migrated to `KafkaProducerService`                               |
| `src/modules/product/events/product.producer.ts`              | Migrated to `KafkaProducerService`                               |
| `src/modules/certification/events/certification.producer.ts`  | Migrated to `KafkaProducerService`                               |
| `src/modules/notification/listeners/notification.listener.ts` | Removed `@EventPattern`, uses `KafkaConsumerService.subscribe()` |
| `src/modules/notification/notification.module.ts`             | Comment update                                                   |
| `test/unit/notification/notification.listener.spec.ts`        | Updated for new listener API                                     |

## Key Decisions Made

1. **18 schemas, not 27** — the design doc was aspirational; code produces 18 topics; plan matches reality
2. **`testValues` stays `Record<string, unknown>` in TypeScript** — Avro encodes as `string` via `JSON.stringify()`; cast with `as unknown as Record<string, number | string>` bridges the gap; consumer will `JSON.parse()` in a future sprint when ProductListener is migrated
3. **`NotificationListener` was dormant** — no `connectMicroservice()` in `main.ts` meant `@EventPattern` handlers never fired; now fixed via `KafkaConsumerService.subscribe()` in `onModuleInit()`
4. **`KafkaClientModule` left in place** — `CooperativeListener`, `ProductListener`, `CertificationListener` still use `@EventPattern` (dormant); migration to `KafkaConsumerService` is P2-S4 scope
5. **Avro round-trip test uses Testcontainers** — no external service required; `redpandadata/redpanda:v23.3.5` pinned version for reproducibility

## Next Actions

1. Run integration test when Docker is available: `npm run test:integration -- --testPathPattern=avro-roundtrip`
2. Start Redpanda: `docker compose --profile core up -d redpanda` and verify schema registration: `curl http://localhost:8081/subjects`
3. P2-S4: Migrate `CooperativeListener`, `ProductListener`, `CertificationListener` from dormant `@EventPattern` to `KafkaConsumerService.subscribe()`
4. P2-S4: JSON.parse `testValues` in `ProductListener.handleLabTestCompleted()`
5. `/save-session` to persist P2-S3 completion
