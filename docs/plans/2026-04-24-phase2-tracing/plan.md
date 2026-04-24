# P2-S2 — Jaeger Distributed Tracing — Implementation Plan

> **For Claude:** Use /execute to implement this plan task-by-task.

**Goal:** Auto-instrument the NestJS app with OpenTelemetry so every HTTP request, Kafka event, and TypeORM query produces a linked trace visible in Jaeger UI — and inject `traceId`/`spanId` into every Pino log line for log-trace correlation.

**Architecture:** `src/tracing.ts` bootstraps OTel SDK before NestJS starts; `@opentelemetry/auto-instrumentations-node` patches express/pg/kafkajs automatically; `pino-otel-mixin.ts` injects active span context into every HTTP log via `customProps`; Jaeger all-in-one receives OTLP gRPC on :4317 and serves UI on :16686.

**Tech Stack:** NestJS 10, TypeScript 5.4, OpenTelemetry Node.js SDK, Jaeger 1.57, Docker Compose v2, pino 9, nestjs-pino 4

**Modules Affected:** `src/` root (tracing.ts, main.ts), `src/app.module.ts`, `src/common/logger/`, `infrastructure/docker/docker-compose.yml`

**Stories:** US-094 (8 SP) · US-095 (3 SP) · US-096 (2 SP)

**Estimated Story Points:** 13

---

## Batch 1 — OTel SDK Bootstrap (US-094)

### Task 1 — Install OpenTelemetry packages

```bash
npm install \
  @opentelemetry/sdk-node \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-trace-otlp-grpc \
  @opentelemetry/api
```

**Verify:** All 4 packages appear in `package.json` `dependencies`. No peer-dependency errors.

```bash
node -e "require('@opentelemetry/sdk-node'); require('@opentelemetry/api'); console.log('OTel OK')"
```

---

### Task 2 — Create src/tracing.ts

**File:** `src/tracing.ts` (CREATE)

```typescript
// src/tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';

const sdk = new NodeSDK({
  serviceName: process.env.OTEL_SERVICE_NAME ?? 'terroir-api',
  // OTLPTraceExporter reads OTEL_EXPORTER_OTLP_ENDPOINT automatically.
  // Default when unset: http://localhost:4317
  // Docker monitoring: http://terroir-jaeger:4317 (via env file)
  traceExporter: new OTLPTraceExporter(),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false }, // too noisy
      '@opentelemetry/instrumentation-dns': { enabled: false },
    }),
  ],
});

sdk.start();

process.on('SIGTERM', () => {
  void sdk.shutdown();
});
```

**Verify:** `npx tsc --noEmit` — no errors on `src/tracing.ts`.

---

### Task 3 — Prepend import to src/main.ts

**File:** `src/main.ts` (MODIFY)

Add `import './tracing';` as the **absolute first line** — before all other imports. OTel must patch require/import hooks before any instrumented library loads.

```typescript
// src/main.ts
import './tracing';
import { NestFactory } from '@nestjs/core';
// ... rest unchanged
```

**Verify:**

```bash
npm run lint
npm run typecheck
npm run test:unit
```

391+ tests must still pass (tracing.ts is never imported by unit tests — they don't load main.ts).

---

## Batch 2 — Pino Mixin + Docker (US-095, US-096)

### Task 4 — Create pino-otel-mixin.ts

**File:** `src/common/logger/pino-otel-mixin.ts` (CREATE)

```typescript
// src/common/logger/pino-otel-mixin.ts
import { trace } from '@opentelemetry/api';

/**
 * Returns traceId + spanId from the active OTel span, or {} if no span is active.
 * Used as pino-http customProps to correlate log lines with Jaeger traces.
 */
export function otelMixin(): Record<string, string> {
  const span = trace.getActiveSpan();
  if (!span) return {};
  const { traceId, spanId } = span.spanContext();
  return { traceId, spanId };
}
```

**Verify:** `npx tsc --noEmit` — no errors.

---

### Task 5 — Wire mixin into app.module.ts LoggerModule

**File:** `src/app.module.ts` (MODIFY)

Add import after the existing logger-related import block:

```typescript
import { otelMixin } from './common/logger/pino-otel-mixin';
```

Add `customProps` to the `pinoHttp` config inside `LoggerModule.forRootAsync`:

```typescript
    // Logging
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        pinoHttp: {
          level: configService.get('app.logLevel', 'info'),
          redact: ['req.headers.authorization', 'body.password', 'body.cin', 'body.phone'],
          transport:
            configService.get('NODE_ENV') !== 'production'
              ? { target: 'pino-pretty', options: { colorize: true } }
              : undefined,
          customProps: () => otelMixin(),
        },
      }),
      inject: [ConfigService],
    }),
```

**Verify:** `npx tsc --noEmit` — no errors.

---

### Task 6 — Add Jaeger service to docker-compose.yml

**File:** `infrastructure/docker/docker-compose.yml` (MODIFY)

Append after the `terroir-grafana` service (before end of file):

```yaml
# ─────────────────────────────────────────────
# 14. Jaeger (distributed tracing)
# ─────────────────────────────────────────────
terroir-jaeger:
  image: jaegertracing/all-in-one:1.57
  container_name: terroir-jaeger
  profiles: [monitoring, full]
  environment:
    COLLECTOR_OTLP_ENABLED: 'true'
  ports:
    - '16686:16686' # Jaeger UI
    - '4317:4317' # OTLP gRPC receiver
    - '4318:4318' # OTLP HTTP receiver
  networks:
    - terroir-network
  healthcheck:
    test: ['CMD-SHELL', 'wget -q --spider http://localhost:16686 || exit 1']
    interval: 15s
    timeout: 5s
    start_period: 20s
    retries: 3
  restart: unless-stopped
```

**Verify:**

```bash
cd infrastructure/docker && docker compose config --quiet
```

Must show no errors. Confirm `terroir-jaeger` in service list.

---

## Batch 3 — Env Vars + Tests (US-095 tests)

### Task 7 — Update env files

**File 1:** `.env.example` (root) — append:

```dotenv
# Distributed Tracing (Jaeger — monitoring/full Docker profile)
# OTEL_SDK_DISABLED=true skips tracing without a running Jaeger instance
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
OTEL_SERVICE_NAME=terroir-api
OTEL_SDK_DISABLED=true
```

**File 2:** `infrastructure/docker/.env.example` — append:

```dotenv
# ── Distributed Tracing ───────────────────────────────────────────────────────
# Points to the terroir-jaeger container when running with --profile monitoring
OTEL_EXPORTER_OTLP_ENDPOINT=http://terroir-jaeger:4317
OTEL_SERVICE_NAME=terroir-api
OTEL_SDK_DISABLED=false
```

**Note:** `OTEL_SDK_DISABLED=true` in root `.env.example` prevents gRPC connection errors when developing locally without the monitoring Docker profile. The Docker env enables it (`false`) since Jaeger runs alongside.

**Verify:** Both files saved, no YAML/format errors.

---

### Task 8 — Unit tests for pino-otel-mixin

**File:** `test/unit/common/pino-otel-mixin.spec.ts` (CREATE)

```typescript
// test/unit/common/pino-otel-mixin.spec.ts
import { trace, Span, SpanContext } from '@opentelemetry/api';
import { otelMixin } from '@common/logger/pino-otel-mixin';

jest.mock('@opentelemetry/api', () => ({
  trace: {
    getActiveSpan: jest.fn(),
  },
}));

describe('otelMixin', () => {
  const mockGetActiveSpan = trace.getActiveSpan as jest.Mock;

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty object when getActiveSpan returns undefined', () => {
    mockGetActiveSpan.mockReturnValue(undefined);
    expect(otelMixin()).toEqual({});
  });

  it('returns empty object when getActiveSpan returns null', () => {
    mockGetActiveSpan.mockReturnValue(null);
    expect(otelMixin()).toEqual({});
  });

  it('returns traceId and spanId from the active span context', () => {
    const fakeContext: SpanContext = {
      traceId: 'aabbccdd00112233aabbccdd00112233',
      spanId: '0011223344556677',
      traceFlags: 1,
    };
    const fakeSpan = { spanContext: () => fakeContext } as unknown as Span;
    mockGetActiveSpan.mockReturnValue(fakeSpan);

    const result = otelMixin();
    expect(result).toEqual({
      traceId: 'aabbccdd00112233aabbccdd00112233',
      spanId: '0011223344556677',
    });
  });
});
```

**Verify:**

```bash
npm run lint
npm run typecheck
npm run test:unit
```

Test count must reach **400+** (397 existing + 3 new mixin tests). All must pass.

---

### Task 9 — Final batch verification

Run the full check:

```bash
npm run lint
npm run typecheck
npm run test:unit
```

Expected:

- Lint: 0 errors (2 pre-existing warnings in `export-openapi.ts` are acceptable)
- Typecheck: clean
- Tests: **400/400** passing

**Manual smoke test (optional — requires Docker monitoring profile):**

```bash
cd infrastructure/docker
docker compose --profile monitoring up -d
# Wait ~30s for Jaeger to start

# Generate traffic
curl http://localhost:3000/health

# Open Jaeger UI
# http://localhost:16686
# Service: terroir-api → Find Traces → should show HTTP GET /health span
```

---

## Summary

| Batch | Tasks | Stories        | Deliverable                                                           |
| ----- | ----- | -------------- | --------------------------------------------------------------------- |
| 1     | 1–3   | US-094         | OTel SDK installed, `tracing.ts` bootstrap, `main.ts` patched         |
| 2     | 4–6   | US-095, US-096 | `pino-otel-mixin.ts`, `customProps` in LoggerModule, Jaeger in Docker |
| 3     | 7–9   | US-095 tests   | Env vars in both env files, 3 unit tests, final gate                  |

**Files created (3):**

- `src/tracing.ts`
- `src/common/logger/pino-otel-mixin.ts`
- `test/unit/common/pino-otel-mixin.spec.ts`

**Files modified (4):**

- `src/main.ts` — `import './tracing'` prepended
- `src/app.module.ts` — `customProps: () => otelMixin()` added to LoggerModule
- `infrastructure/docker/docker-compose.yml` — `terroir-jaeger` service added
- `.env.example` + `infrastructure/docker/.env.example` — OTel vars added

**Key behaviour note:** `OTEL_SDK_DISABLED=true` (default in root `.env.example`) prevents connection errors in local dev without Jaeger. Set to `false` (or omit) when the monitoring Docker profile is running.
