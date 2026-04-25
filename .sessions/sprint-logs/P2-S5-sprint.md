# Sprint Log — P2-S5: OWASP ZAP Security Scanning + k6 Performance Testing

**Dates:** 2026-04-25  
**Status:** COMPLETE ✅  
**Stories:** US-104 (ZAP, 5 SP), US-105 (k6, 5 SP)  
**Planned SP:** 10 | **Completed SP:** 10 | **Velocity:** 100%

## Goal

OWASP ZAP passive scan running in CI — High/Critical alerts fail the build. k6 load tests with thresholds enforcing the domain-mandated QR verify p95 < 200ms SLA. Local npm scripts for both.

## Delivered

### ZAP Passive Scan (US-104)
- `infrastructure/zap/zap.yaml` — scan context: includes `/api/v1.*`, `/health`, `/ready`; excludes `/metrics`
- `infrastructure/zap/rules.tsv` — 10 suppression rules for known JSON API false positives (no cookies, no HTML, Helmet manages security headers)
- `infrastructure/zap/README.md` — prerequisites, local run instructions, CI details, severity policy, Mac/Windows note
- `docker-compose.test.yml` — `zap-scan` service added (profile: zap, network_mode: host, reads `docs/api/openapi.json`)
- `package.json` — `security:scan`, `security:scan:ci` scripts
- `docs/security/.gitkeep` — placeholder; HTML/JSON reports gitignored
- `.github/workflows/security.yml` — push:main + weekly Monday 04:00 UTC; PostgreSQL + Redis service containers; `npm run start`; curl retry readiness; jq check fails build on High/Critical

### k6 Performance Scripts (US-105)
- `test/performance/smoke.k6.js` — 1 VU, 1 iter, no auth; liveness + readiness + QR reachability; CI-safe
- `test/performance/qr-verify.k6.js` — 50 VU, 2 min load; p95 < 200ms hard threshold; `QR_TOKEN` env var
- `test/performance/certification-list.k6.js` — 30 VU, 2 min load; p95 < 500ms threshold; `K6_TOKEN` env var
- `test/performance/README.md` — install guide, env vars, threshold rationale, CI schedule
- `package.json` — `perf:smoke`, `perf:qr`, `perf:list`, `perf:all` scripts
- `.github/workflows/performance.yml` — smoke job (every push), load job (weekly + workflow_dispatch); k6 via apt; `CI_QR_TOKEN` secret

## Verification

| Checkpoint | Result |
|------------|--------|
| Batch 1 lint | ✅ 0 errors |
| Batch 1 typecheck | ✅ clean |
| Batch 1 test:unit | ✅ 436/436 |
| Batch 2 lint | ✅ 0 errors |
| Batch 2 typecheck | ✅ clean |
| Batch 2 test:unit | ✅ 436/436 |
| Batch 3 lint | ✅ 0 errors |
| Batch 3 typecheck | ✅ clean |
| Batch 3 test:unit | ✅ 436/436 |

## Key Decisions

1. Passive scan only in CI — active scan not mandatory; avoids false positive rate from injection attempts against seeded test data
2. `network_mode: host` for ZAP on Linux; Mac/Windows documented in README (use `host.docker.internal`)
3. Smoke on every push, load tests weekly — keeps CI fast on feature branches while maintaining weekly regression baseline
4. curl retry loop — no `wait-on` npm dependency; keeps CI dependencies minimal
5. `CI_QR_TOKEN` GitHub secret — QR tokens are HMAC-signed; can't be hardcoded; load test degrades gracefully to 404 responses if secret absent

## Phase 2 Complete

P2-S5 is the final Phase 2 sprint. All 5 sprints delivered at 100% velocity:

| Sprint | SP | Status |
|--------|----|--------|
| P2-S1 Prometheus + Grafana | 11 | ✅ |
| P2-S2 Jaeger Tracing | 13 | ✅ |
| P2-S3 Kafka Avro | 18 | ✅ |
| P2-S4 Consumer Migration + E2E | 23 | ✅ |
| P2-S5 ZAP + k6 | 10 | ✅ |
| **Total** | **75** | **✅** |
