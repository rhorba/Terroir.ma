# Design — Phase 2: Jaeger Distributed Tracing

**Date:** 2026-04-24  
**Scope:** HTTP request spans + Kafka event spans + DB query spans (OpenTelemetry full-stack)  
**Phase:** 2  
**Backlog ref:** Phase 2 distributed tracing

---

## Problem

The certification chain spans HTTP requests, Kafka events, and DB queries across 4 modules. When a certification fails or is slow, there is no way to identify which step (HTTP handler → Kafka producer → consumer → TypeORM query) is the bottleneck. Pino logs have `correlationId` but no parent/child span structure.

---

## Scope (chosen: Option C)

- HTTP spans: every incoming request gets a root span (method, route, status, duration)
- Kafka spans: producer creates a child span; consumer continues the trace via message headers
- DB spans: TypeORM/pg queries are child spans (table, operation, duration)
- Jaeger as OTLP backend (all-in-one image for Phase 2)
- W3C TraceContext propagation throughout

**Out of scope:** Redis spans, external HTTP client spans (Phase 3).

---

## Architecture

```
Incoming HTTP Request
  └── OTel SDK (auto-instrumented express)
        └── root span: HTTP GET /certifications/:id
              ├── child span: TypeORM SELECT certification (pg instrumentation)
              ├── child span: KafkaJS produce certification.event.published
              │     └── [async] consumer span: certification-group consume
              │           └── child span: TypeORM INSERT certification_event
              └── response: X-Trace-Id header injected (for Pino correlation)

Jaeger (docker monitoring profile)
  └── OTLP gRPC receiver :4317
  └── UI :16686
```

---

## OTel Bootstrap Strategy

OTel SDK **must** be initialized before any module code runs. The standard pattern in NestJS is a `tracing.ts` file imported as the very first line of `main.ts`:

```typescript
// src/tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';

const sdk = new NodeSDK({
  serviceName: 'terroir-api',
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'grpc://localhost:4317',
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false }, // too noisy
      '@opentelemetry/instrumentation-dns': { enabled: false },
    }),
  ],
});

sdk.start();
process.on('SIGTERM', () => sdk.shutdown());
```

```typescript
// src/main.ts — first import
import './tracing';
import { NestFactory } from '@nestjs/core';
// ...
```

---

## Kafka Trace Propagation

KafkaJS auto-instrumentation propagates W3C TraceContext via message headers automatically when `@opentelemetry/instrumentation-kafkajs` is enabled (included in auto-instrumentations). The producer span becomes the parent; the consumer continues it by extracting headers.

The existing `correlationId` field in all Kafka events is **kept** (used by Pino for log correlation). The OTel `traceId` and `correlationId` are linked by injecting `traceId` into the Pino log context via a custom Pino mixin:

```typescript
// src/common/logger/pino-otel-mixin.ts
import { trace } from '@opentelemetry/api';

export function otelMixin() {
  const span = trace.getActiveSpan();
  if (!span) return {};
  const { traceId, spanId } = span.spanContext();
  return { traceId, spanId };
}
```

This means every Pino log line automatically includes `traceId` — searchable in both Jaeger and log aggregators.

---

## Infrastructure

### Docker Compose — monitoring profile (add to existing)

```yaml
jaeger:
  image: jaegertracing/all-in-one:1.57
  profiles: [monitoring, full]
  environment:
    COLLECTOR_OTLP_ENABLED: 'true'
  ports:
    - '16686:16686' # Jaeger UI
    - '4317:4317' # OTLP gRPC receiver
    - '4318:4318' # OTLP HTTP receiver
```

### Environment variables (add to .env.example)

```
OTEL_EXPORTER_OTLP_ENDPOINT=grpc://jaeger:4317
OTEL_SERVICE_NAME=terroir-api
```

---

## Files to Create / Modify

| Action | Path                                                                |
| ------ | ------------------------------------------------------------------- |
| CREATE | `src/tracing.ts` — OTel SDK bootstrap                               |
| CREATE | `src/common/logger/pino-otel-mixin.ts` — inject traceId into Pino   |
| MODIFY | `src/main.ts` — `import './tracing'` as first line                  |
| MODIFY | `src/common/logger/logger.module.ts` — add otelMixin to Pino config |
| MODIFY | `docker-compose.yml` — add Jaeger service to monitoring profile     |
| MODIFY | `.env.example` — add OTEL\_\* vars                                  |
| MODIFY | `package.json` — add OTel dependencies                              |

---

## Dependencies

```
@opentelemetry/sdk-node@0.51.x
@opentelemetry/auto-instrumentations-node@0.46.x
@opentelemetry/exporter-trace-otlp-grpc@0.51.x
@opentelemetry/api@1.8.x
```

`auto-instrumentations-node` covers express, pg (TypeORM uses pg under the hood), kafkajs, http, dns (disabled). No per-library instrumentation packages needed.

---

## Testing

- Unit: `pino-otel-mixin` — verify returns `{}` when no active span; verify returns `{ traceId, spanId }` when span is active (mock `trace.getActiveSpan()`)
- Manual: start with monitoring profile → make a `POST /certifications` request → open Jaeger UI at `:16686` → verify trace shows HTTP → Kafka → DB spans

---

## YAGNI Notes

- No custom spans in business logic (Phase 3 — add `tracer.startActiveSpan()` around critical sections after baseline is established)
- No sampling configuration (100% trace rate is fine for Phase 2 low-traffic dev/staging)
- No Tempo/Loki integration (Phase 3 — full observability stack)
- `all-in-one` Jaeger image acceptable for Phase 2; production would use separate collector + storage
