# Design — Phase 2: Prometheus + Grafana Monitoring

**Date:** 2026-04-24  
**Scope:** API latency + error rate (HTTP layer only)  
**Phase:** 2  
**Backlog ref:** Phase 2 monitoring stack

---

## Problem

v1 has no observability into API performance. There is no way to detect latency regressions, error rate spikes, or traffic patterns across the certification chain endpoints without tailing raw Pino logs.

---

## Scope (chosen: Option A)

- HTTP request duration histogram (P50 / P95 / P99 per route)
- HTTP request counter (labeled by method, route, status code)
- Error rate panel (4xx and 5xx separately)
- `GET /metrics` Prometheus scrape endpoint
- Grafana dashboard wired to Prometheus datasource

**Out of scope (Phase 3):** Kafka consumer lag, Redis hit/miss, PostgreSQL pool stats, custom business metrics (certifications/day, QR scans/hour).

---

## Architecture

```
NestJS App
  └── HttpMetricsInterceptor (global)
        ├── records http_request_duration_seconds{method, route, status}
        └── records http_requests_total{method, route, status}
  └── GET /metrics → MetricsController → prom-client registry

Prometheus (docker monitoring profile)
  └── scrapes /metrics every 15s

Grafana (docker monitoring profile)
  └── provisioned datasource: prometheus
  └── provisioned dashboard: terroir-api.json
```

---

## Module Design

New `MetricsModule` in `src/common/metrics/`:

```
src/common/metrics/
  metrics.module.ts       — imports nothing, exports MetricsService
  metrics.service.ts      — owns prom-client Registry, exposes histogram + counter
  http-metrics.interceptor.ts — NestJS interceptor, records on response
  metrics.controller.ts   — GET /metrics, returns text/plain; charset=utf-8
```

`MetricsModule` is imported by `AppModule`. The interceptor is registered globally via `APP_INTERCEPTOR`.

### MetricsService

```typescript
class MetricsService {
  private readonly requestDuration: Histogram; // buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5]
  private readonly requestTotal: Counter;

  record(method: string, route: string, statusCode: number, durationMs: number): void;
  getMetrics(): Promise<string>;
}
```

### Route normalization

Raw Express routes contain path params (`/certifications/abc-123`). The interceptor must normalize to `/certifications/:id` using `req.route.path` (Express sets this after routing). Falls back to `'unknown'` if route not yet resolved (404s).

### /metrics security

`/metrics` is excluded from Keycloak JWT guard. Access restricted to localhost / Docker internal network via a guard that checks `req.ip`. Prometheus scrapes from within the Docker network — no external exposure.

---

## Infrastructure

### Docker Compose — monitoring profile

```yaml
# docker-compose.yml (add to existing file under monitoring profile)
prometheus:
  image: prom/prometheus:v2.51.2
  profiles: [monitoring, full]
  volumes:
    - ./docker/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
  ports:
    - '9090:9090'

grafana:
  image: grafana/grafana:10.4.2
  profiles: [monitoring, full]
  environment:
    GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD:-terroir}
    GF_AUTH_ANONYMOUS_ENABLED: 'false'
  volumes:
    - ./docker/grafana/provisioning:/etc/grafana/provisioning:ro
    - ./docker/grafana/dashboards:/var/lib/grafana/dashboards:ro
    - grafana_data:/var/lib/grafana
  ports:
    - '3000:3000'
  depends_on: [prometheus]
```

### prometheus.yml

```yaml
global:
  scrape_interval: 15s
scrape_configs:
  - job_name: terroir-api
    static_configs:
      - targets: ['app:3001'] # NestJS container name
```

### Grafana dashboard panels

| Panel                | Query                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| Request rate (req/s) | `rate(http_requests_total[1m])`                                                                      |
| P95 latency          | `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))`                           |
| P99 latency          | `histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))`                           |
| Error rate (5xx)     | `rate(http_requests_total{status=~"5.."}[1m])`                                                       |
| Error rate (4xx)     | `rate(http_requests_total{status=~"4.."}[1m])`                                                       |
| Top slow routes      | `topk(10, histogram_quantile(0.95, sum by (route)(rate(http_request_duration_seconds_bucket[5m]))))` |

---

## Dependencies

```
prom-client@15.x    — Prometheus client for Node.js (official)
```

No other new dependencies. `prom-client` is the standard library; no wrapper needed.

---

## Files to Create / Modify

| Action | Path                                                     |
| ------ | -------------------------------------------------------- |
| CREATE | `src/common/metrics/metrics.module.ts`                   |
| CREATE | `src/common/metrics/metrics.service.ts`                  |
| CREATE | `src/common/metrics/http-metrics.interceptor.ts`         |
| CREATE | `src/common/metrics/metrics.controller.ts`               |
| CREATE | `docker/prometheus/prometheus.yml`                       |
| CREATE | `docker/grafana/provisioning/datasources/prometheus.yml` |
| CREATE | `docker/grafana/provisioning/dashboards/terroir.yml`     |
| CREATE | `docker/grafana/dashboards/terroir-api.json`             |
| MODIFY | `src/app.module.ts` — import MetricsModule               |
| MODIFY | `docker-compose.yml` — add monitoring profile services   |
| MODIFY | `.env.example` — add GRAFANA_PASSWORD                    |

---

## Testing

- Unit: `MetricsService` — verify histogram records correct labels; interceptor — verify it calls `record()` with normalized route
- Integration: not needed (prom-client is well-tested externally)
- Manual: `docker compose --profile monitoring up` → `curl localhost:9090` → Grafana at `:3000`

---

## YAGNI Notes

- No alerting rules (Alertmanager) in Phase 2 — add in Phase 3 when SLOs are defined
- No node_exporter (host metrics) — not needed for a containerized monolith
- No pushgateway — all scrape-based, simpler
- Dashboard exported as JSON file in repo — no Grafana database dependency
