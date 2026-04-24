# Execution Progress — P2-S2 Jaeger Distributed Tracing

**Plan:** `docs/plans/2026-04-24-phase2-tracing/plan.md`
**Last updated:** 2026-04-24

## Status

| Task | Title                                      | Status       |
| ---- | ------------------------------------------ | ------------ |
| 1    | Install OpenTelemetry packages             | ✅ completed |
| 2    | Create src/tracing.ts                      | ✅ completed |
| 3    | Prepend import './tracing' to main.ts      | ✅ completed |
| 4    | Create pino-otel-mixin.ts                  | ✅ completed |
| 5    | Wire mixin into app.module.ts LoggerModule | ✅ completed |
| 6    | Add Jaeger service to docker-compose.yml   | ✅ completed |
| 7    | Update both .env.example files             | ✅ completed |
| 8    | Unit tests for pino-otel-mixin             | ✅ completed |
| 9    | Final lint + typecheck + test:unit         | ✅ completed |

## Batch Log

### Batch 1 (Tasks 1–3) — 2026-04-24 — US-094

- ✅ Task 1: Installed `@opentelemetry/sdk-node@^0.215.0`, `@opentelemetry/auto-instrumentations-node@^0.73.0`, `@opentelemetry/exporter-trace-otlp-grpc@^0.215.0`, `@opentelemetry/api@^1.9.1`.
- ✅ Task 2: `src/tracing.ts` — NodeSDK bootstrapped with OTLPTraceExporter (reads `OTEL_EXPORTER_OTLP_ENDPOINT` from env), auto-instrumentations (fs + dns disabled), SIGTERM shutdown hook.
- ✅ Task 3: `import './tracing'` prepended as first line of `src/main.ts`.
- Verification: lint ✅ (0 errors) · typecheck ✅ · tests ✅ 397/397

### Batch 2 (Tasks 4–6) — 2026-04-24 — US-095 + US-096

- ✅ Task 4: `src/common/logger/pino-otel-mixin.ts` — `otelMixin()` returns `{ traceId, spanId }` from active OTel span or `{}` when no span is active.
- ✅ Task 5: `app.module.ts` — added `import { otelMixin }` and `customProps: () => otelMixin()` to LoggerModule `pinoHttp` config. Every HTTP request log now carries `traceId` + `spanId`.
- ✅ Task 6: `terroir-jaeger` service added to `monitoring` + `full` profiles. Ports: 16686 (UI), 4317 (OTLP gRPC), 4318 (OTLP HTTP). `docker compose config --quiet` — clean.

### Batch 3 (Tasks 7–9) — 2026-04-24 — US-095 tests

- ✅ Task 7: Root `.env.example` — added `OTEL_*` vars with `OTEL_SDK_DISABLED=true` default (prevents gRPC errors in local dev without Jaeger). `infrastructure/docker/.env.example` — added same vars with `OTEL_SDK_DISABLED=false` + `OTEL_EXPORTER_OTLP_ENDPOINT=http://terroir-jaeger:4317` for Docker usage.
- ✅ Task 8: `test/unit/common/pino-otel-mixin.spec.ts` — 3 tests: undefined span → `{}`, null span → `{}`, valid span → `{ traceId, spanId }`. Uses `jest.mock('@opentelemetry/api')`.
- ✅ Task 9: lint ✅ · typecheck ✅ · **400/400 tests** (+3 new). Note: Jest worker teardown warning present (OTel background exporter timer in worker process) — non-blocking, all suites pass.

## Files Created (3)

- `src/tracing.ts`
- `src/common/logger/pino-otel-mixin.ts`
- `test/unit/common/pino-otel-mixin.spec.ts`

## Files Modified (4)

- `src/main.ts` — `import './tracing'` prepended
- `src/app.module.ts` — `otelMixin` import + `customProps` in LoggerModule
- `infrastructure/docker/docker-compose.yml` — `terroir-jaeger` service added
- `.env.example` + `infrastructure/docker/.env.example` — OTel vars added

## Plan Status: ✅ COMPLETE
