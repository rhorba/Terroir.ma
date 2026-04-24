# Sprint P2-S1 + P2-S2 Retrospective — 2026-04-24

> Both sprints delivered in the same session. Combined retro covers the full observability stack.

---

## P2-S1 Metrics — Prometheus + Grafana

- **Committed:** 11 SP | **Completed:** 11 SP | **Velocity:** 100%
- **Session duration:** 1 session (2026-04-24)
- **Files created:** 11 (MetricsModule × 5, test × 2, infra × 4)
- **Files modified:** 3 (app.module.ts, docker-compose.yml, .env.example)
- **Tests:** 391 → **397** (+6 new unit tests)
- **Stories:** US-091 ✅ · US-092 ✅ · US-093 ✅

## P2-S2 Metrics — Jaeger Distributed Tracing

- **Committed:** 13 SP | **Completed:** 13 SP | **Velocity:** 100%
- **Session duration:** 1 session (2026-04-24, same as P2-S1)
- **Files created:** 3 (tracing.ts, pino-otel-mixin.ts, pino-otel-mixin.spec.ts)
- **Files modified:** 4 (main.ts, app.module.ts, docker-compose.yml, 2 × .env.example)
- **Tests:** 397 → **400** (+3 new unit tests)
- **Stories:** US-094 ✅ · US-095 ✅ · US-096 ✅

## Combined Today

- **Total SP:** 24 (11 + 13) | **Velocity:** 100% both sprints
- **Total new tests:** +9 (397 → 400 overall; 391 → 400 from start of session)
- **Observability services added:** Prometheus (:9090) · Grafana (:3100) · Jaeger (:16686)
- **One command starts all:** `docker compose --profile monitoring up -d`

---

## What Went Well

- **100% velocity on both infrastructure sprints** — no deferred tasks, no blocked items
- **prom-client custom Registry pattern** — using `new Registry()` per `MetricsService` instance instead of the global default registry eliminated test isolation issues; each test module gets a clean registry
- **OTel auto-instrumentation was truly zero-config** — `getNodeAutoInstrumentations()` wires express, pg, and kafkajs with no manual span creation; all three instrumentation layers live in one import
- **Jaeger / Prometheus / Grafana unified under one Docker profile** — all three observability services start with `--profile monitoring`; no separate `docker compose up` commands needed
- **Grafana dashboard fully provisioned from repo** — no Grafana database state to manage; dashboard JSON is version-controlled; recreating the container brings back all panels automatically
- **`OTEL_SDK_DISABLED=true` default in local .env.example** — prevents gRPC connection errors in local dev without a running Jaeger instance; Docker env flips to `false` automatically
- **Type error caught early** — `RouteAwareRequest extends Request` conflict in `HttpMetricsInterceptor` was caught at typecheck step (not at runtime); fixed by casting `req.route` inline instead

## What Didn't Go Well

- **Jest worker teardown warning** — after installing OTel packages, one Jest worker process fails to exit gracefully (OTel background gRPC exporter timer). Non-blocking (all 400 tests pass) but visible noise in output
- **Monitoring stack not runtime-verified** — Docker Desktop not running during session; `docker compose --profile monitoring up -d` has not been executed against the actual services
- **Grafana datasource uses hardcoded container name** — `http://terroir-prometheus:9090` is correct for Docker but will fail if services are renamed or run outside Docker
- **OTel packages versioned to `^0.215.0`** — the OTel Node.js SDK uses a non-standard versioning scheme (very high patch numbers). Future upgrades may require checking breaking changes in the OTel changelog rather than relying on semver

---

## Action Items

| Item | Owner | Due |
|------|-------|-----|
| Run `docker compose --profile monitoring up -d` and verify Prometheus scrape target is UP | Developer | Before P2-S3 |
| Investigate Jest worker teardown warning — add `--forceExit` to `test:unit` script if OTel timer can't be cleaned up | Developer | P2-S3 session |
| Verify Grafana dashboard panels render data after generating traffic with `curl` | Developer | Before P2-S3 |
| Verify `traceId` appears in Pino logs when OTel is enabled (run app with `OTEL_SDK_DISABLED=false`) | Developer | Before P2-S3 |

---

## Decisions Made This Session

1. **Custom prom-client Registry per service instance** — using `new Registry()` instead of the default global registry prevents metric name conflicts across test modules; each `MetricsService` instantiation in tests gets a fresh registry
2. **`req.route` cast inline instead of interface extension** — extending `Request` from Express with an optional `route` field causes a TypeScript error (Express already declares `route` as required); casting `req.route as { path?: string } | undefined` is the correct approach
3. **`OTEL_SDK_DISABLED` defaults differ by env** — root `.env.example` defaults `true` (no Jaeger in local dev); `infrastructure/docker/.env.example` defaults `false` (Jaeger runs alongside); this avoids connection error spam in both environments
4. **Spec files in `test/unit/common/`** — Jest config matches `test/unit/**/*.spec.ts`; spec files placed in `src/` are ignored; all test files must live under `test/unit/`
5. **`import './tracing'` must be first line of main.ts** — OTel SDK patches Node.js module loading hooks; importing it after other modules means those modules are already loaded unpatched; this is a one-time constraint with no workaround

---

## Definition of Done Compliance

| Criterion | P2-S1 | P2-S2 |
|-----------|-------|-------|
| All planned tasks completed | ✅ 10/10 | ✅ 9/9 |
| TypeScript strict — 0 typecheck errors | ✅ | ✅ |
| ESLint — 0 errors (pre-existing warnings only) | ✅ | ✅ |
| Unit tests passing (all) | ✅ 397/397 | ✅ 400/400 |
| No cross-module imports | ✅ (common/ only) | ✅ (common/ only) |
| Docker compose config validates | ✅ | ✅ |
| Plan saved to `docs/plans/` | ✅ | ✅ |
| Progress tracked in `progress.md` | ✅ | ✅ |

---

## Phase 2 Cumulative Progress

| Sprint | Goal | SP | Status |
|--------|------|----|--------|
| P2-S1 | Prometheus + Grafana | 11 | ✅ DONE |
| P2-S2 | Jaeger Distributed Tracing | 13 | ✅ DONE |
| P2-S3 | Kafka Schema Registry + Avro | 18 | ⏳ next |
| P2-S4 | E2E Auth Setup + Certification Chain | 13 | ⏳ |
| P2-S5 | E2E Critical Paths + Role Smokes | 10 | ⏳ |
| **Total** | **Phase 2** | **65** | **24/65 done (37%)** |
