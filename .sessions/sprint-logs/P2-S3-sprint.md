# Sprint Log — P2-S3: Kafka Schema Registry + Avro

**Sprint:** P2-S3
**Dates:** 2026-04-25
**Goal:** Migrate all 18 Kafka event topics from plain JSON to Avro with Redpanda Schema Registry; wire raw KafkaJS producer/consumer; fix dormant NotificationListener

## Story Points

| Story | Title | SP | Status |
|-------|-------|----|--------|
| US-097 | Avro schemas for all event topics | 5 | ✅ Done |
| US-098 | SchemaRegistryService + KafkaProducerService + KafkaConsumerService | 8 | ✅ Done |
| US-099 | Migrate producers + consumers + integration test | 5 | ✅ Done |
| **Total** | | **18** | **100%** |

## Velocity

- Planned: 18 SP
- Completed: 18 SP
- Velocity: **100%**

## What Was Delivered

- 18 Avro schemas (`.avsc`) in `src/common/schemas/avro/` — BACKWARD compatible, registered with Redpanda Schema Registry on bootstrap
- `SchemaRegistryService` — encode/decode with schema ID cache; idempotent `registerAll()`
- `KafkaProducerService` — raw KafkaJS producer; replaces `ClientKafka.emit()` for all 3 modules
- `KafkaConsumerService` — raw KafkaJS consumer; `subscribe()`/`startConsuming()` lifecycle
- `KafkaModule` — global NestJS module wiring all 3 services
- All 3 producers migrated: `cooperative.producer`, `product.producer`, `certification.producer`
- `NotificationListener` fixed: was dormant (no `connectMicroservice()`); now uses `KafkaConsumerService.subscribe()` — Kafka notifications live for the first time
- 32 new unit tests; Avro round-trip integration test (Testcontainers Redpanda)

## Key Technical Decisions

1. **18 schemas, not 27** — design doc was aspirational; actual code produces 18 topics
2. **`testValues` JSON-stringified** — Avro `"string"` type; TypeScript interface stays `Record<string, number|string>`; consumer-side `JSON.parse` in P2-S4
3. **KafkaClientModule kept** — `CooperativeListener`/`ProductListener`/`CertificationListener` still dormant; P2-S4 migrates them
4. **Integration test pinned** — `redpandadata/redpanda:v23.3.5` for reproducibility

## Bugs Fixed

| Bug | Impact |
|-----|--------|
| `NotificationListener @EventPattern` handlers never fired | All Kafka-driven email notifications were silently dropped since v1 |

## Phase 2 Progress

| Sprint | SP | Status |
|--------|-----|--------|
| P2-S1: Prometheus + Grafana | 11 | ✅ |
| P2-S2: Jaeger Distributed Tracing | 13 | ✅ |
| P2-S3: Kafka Schema Registry + Avro | 18 | ✅ |
| P2-S4: Consumer Migration + E2E Auth | 13 | 🔜 |
| P2-S5: OWASP ZAP + Contract Testing | 10 | 🔜 |
| **Phase 2 Total** | **65** | **65% (42 SP done)** |
