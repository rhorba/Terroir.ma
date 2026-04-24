# P2-S1 — Prometheus + Grafana Monitoring — Implementation Plan

> **For Claude:** Use /execute to implement this plan task-by-task.

**Goal:** Expose a `/metrics` endpoint from the NestJS app, scrape it with Prometheus, and provision a 6-panel Grafana dashboard showing request rate, P95/P99 latency, and 4xx/5xx error rates — all startable with one `docker compose --profile monitoring up` command.

**Architecture:** New `MetricsModule` in `src/common/metrics/` — global `HttpMetricsInterceptor` records duration + count per route label; `MetricsController` exposes `/metrics` guarded by IP allowlist; Prometheus scrapes at 15s; Grafana reads from Prometheus datasource.

**Tech Stack:** NestJS 10, TypeScript 5.4, `prom-client@15`, Docker Compose v2, Prometheus v2.51, Grafana 10.4

**Modules Affected:** `src/common/` (MetricsModule), `src/app.module.ts`, `infrastructure/docker/docker-compose.yml`

**Stories:** US-091 (5 SP) · US-092 (3 SP) · US-093 (3 SP)

**Estimated Story Points:** 11

---

## Batch 1 — NestJS MetricsModule (US-091)

### Task 1 — Install prom-client + create MetricsService

**File:** `src/common/metrics/metrics.service.ts` (CREATE)

```bash
npm install prom-client@15
```

```typescript
// src/common/metrics/metrics.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Counter, Histogram, Registry } from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new Registry();
  private requestDuration!: Histogram<string>;
  private requestTotal!: Counter<string>;

  onModuleInit(): void {
    this.requestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
      registers: [this.registry],
    });

    this.requestTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });
  }

  /**
   * Records one HTTP request observation into histogram + counter.
   */
  record(method: string, route: string, statusCode: number, durationMs: number): void {
    const labels = { method, route, status: String(statusCode) };
    this.requestDuration.observe(labels, durationMs / 1000);
    this.requestTotal.inc(labels);
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }
}
```

**Verify:** `npx tsc --noEmit` — no errors.

---

### Task 2 — Create HttpMetricsInterceptor

**File:** `src/common/metrics/http-metrics.interceptor.ts` (CREATE)

```typescript
// src/common/metrics/http-metrics.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { MetricsService } from './metrics.service';

interface RouteAwareRequest extends Request {
  route?: { path?: string };
}

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<RouteAwareRequest>();
    const res = context.switchToHttp().getResponse<Response>();
    const method = req.method;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        // req.route.path is the Express template (/certifications/:id), not the raw URL
        const route = req.route?.path ?? 'unknown';
        this.metricsService.record(method, route, res.statusCode, Date.now() - start);
      }),
    );
  }
}
```

**Verify:** `npx tsc --noEmit` — no errors.

---

### Task 3 — Create MetricsIpGuard + MetricsController

**Files:** `src/common/metrics/metrics-ip.guard.ts` (CREATE), `src/common/metrics/metrics.controller.ts` (CREATE)

```typescript
// src/common/metrics/metrics-ip.guard.ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';

// Prometheus scrapes from within Docker network (172.x, 10.x) or localhost
const ALLOWED_PREFIXES = ['127.0.0.1', '::1', '::ffff:127.0.0.1', '172.', '10.'];

@Injectable()
export class MetricsIpGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
      req.socket.remoteAddress ??
      '';
    if (!ALLOWED_PREFIXES.some((prefix) => ip.startsWith(prefix))) {
      throw new ForbiddenException('Metrics endpoint is internal only');
    }
    return true;
  }
}
```

```typescript
// src/common/metrics/metrics.controller.ts
import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsIpGuard } from './metrics-ip.guard';

@Controller('metrics')
@UseGuards(MetricsIpGuard)
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async getMetrics(): Promise<string> {
    return this.metricsService.getMetrics();
  }
}
```

**Verify:** `npx tsc --noEmit` — no errors.

---

### Task 4 — Create MetricsModule + wire into AppModule

**Files:** `src/common/metrics/metrics.module.ts` (CREATE), `src/app.module.ts` (MODIFY)

```typescript
// src/common/metrics/metrics.module.ts
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';

@Module({
  controllers: [MetricsController],
  providers: [MetricsService, { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor }],
  exports: [MetricsService],
})
export class MetricsModule {}
```

**Modify `src/app.module.ts`** — add two lines:

After the existing common-module imports (before `// Domain modules`), add:

```typescript
import { MetricsModule } from './common/metrics/metrics.module';
```

And in the `imports` array, add `MetricsModule` alongside `KafkaClientModule`:

```typescript
    // Metrics (Prometheus scrape endpoint + HTTP interceptor)
    MetricsModule,
```

**Verify:**

```bash
npm run lint
npm run typecheck
npm run test:unit
```

All 391 tests must still pass.

---

## Batch 2 — Docker Monitoring Profile (US-092)

### Task 5 — Create prometheus.yml

**File:** `infrastructure/prometheus/prometheus.yml` (CREATE)

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: terroir-api
    static_configs:
      - targets: ['terroir-app:3000']
    metrics_path: /metrics
```

**Note:** `terroir-app` is the Docker container name from `docker-compose.yml`. Port `3000` is the internal container port.

**Verify:** File exists at the path. No YAML syntax errors (`python -c "import yaml; yaml.safe_load(open('infrastructure/prometheus/prometheus.yml'))"` or equivalent).

---

### Task 6 — Create Grafana provisioning files

**Files:** `infrastructure/grafana/provisioning/datasources/prometheus.yml` (CREATE), `infrastructure/grafana/provisioning/dashboards/terroir.yml` (CREATE)

```yaml
# infrastructure/grafana/provisioning/datasources/prometheus.yml
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://terroir-prometheus:9090
    isDefault: true
    editable: false
    jsonData:
      timeInterval: '15s'
```

```yaml
# infrastructure/grafana/provisioning/dashboards/terroir.yml
apiVersion: 1
providers:
  - name: terroir
    orgId: 1
    folder: Terroir.ma
    type: file
    disableDeletion: false
    updateIntervalSeconds: 30
    options:
      path: /var/lib/grafana/dashboards
```

**Verify:** Both files exist. No YAML syntax errors.

---

### Task 7 — Add Prometheus + Grafana to docker-compose.yml

**File:** `infrastructure/docker/docker-compose.yml` (MODIFY)

**Step A — add two named volumes** in the `volumes:` block at the top of the file (after `minio_data`):

```yaml
prometheus_data:
  name: terroir_prometheus_data
grafana_data:
  name: terroir_grafana_data
```

**Step B — add two services** at the end of the `services:` block (after `terroir-public`):

```yaml
# ─────────────────────────────────────────────
# 12. Prometheus
# ─────────────────────────────────────────────
terroir-prometheus:
  image: prom/prometheus:v2.51.2
  container_name: terroir-prometheus
  profiles: [monitoring, full]
  ports:
    - '9090:9090'
  volumes:
    - ../prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
    - prometheus_data:/prometheus
  command:
    - '--config.file=/etc/prometheus/prometheus.yml'
    - '--storage.tsdb.path=/prometheus'
    - '--web.console.libraries=/etc/prometheus/console_libraries'
    - '--web.console.templates=/etc/prometheus/consoles'
  networks:
    - terroir-network
  healthcheck:
    test: ['CMD-SHELL', 'wget -q --spider http://localhost:9090/-/healthy || exit 1']
    interval: 15s
    timeout: 5s
    start_period: 20s
    retries: 3
  restart: unless-stopped

# ─────────────────────────────────────────────
# 13. Grafana
# ─────────────────────────────────────────────
terroir-grafana:
  image: grafana/grafana:10.4.2
  container_name: terroir-grafana
  profiles: [monitoring, full]
  ports:
    - '3100:3000'
  environment:
    GF_SECURITY_ADMIN_USER: admin
    GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD:-terroir}
    GF_AUTH_ANONYMOUS_ENABLED: 'false'
    GF_PATHS_PROVISIONING: /etc/grafana/provisioning
  volumes:
    - ../grafana/provisioning:/etc/grafana/provisioning:ro
    - ../grafana/dashboards:/var/lib/grafana/dashboards:ro
    - grafana_data:/var/lib/grafana
  depends_on:
    - terroir-prometheus
  networks:
    - terroir-network
  healthcheck:
    test: ['CMD-SHELL', 'wget -q --spider http://localhost:3000/api/health || exit 1']
    interval: 15s
    timeout: 5s
    start_period: 30s
    retries: 3
  restart: unless-stopped
```

**Note on port:** Grafana is mapped to host port `3100` (not `3000`) because `3000` is already used by `terroir-app`.

**Verify:**

```bash
cd infrastructure/docker && docker compose config --quiet
```

Must print no errors. Confirm `terroir-prometheus` and `terroir-grafana` appear in service list.

---

## Batch 3 — Grafana Dashboard + Tests (US-093)

### Task 8 — Create Grafana dashboard JSON

**File:** `infrastructure/grafana/dashboards/terroir-api.json` (CREATE)

```json
{
  "__inputs": [],
  "__requires": [
    { "type": "grafana", "id": "grafana", "name": "Grafana", "version": "10.4.2" },
    { "type": "datasource", "id": "prometheus", "name": "Prometheus", "version": "1.0.0" }
  ],
  "annotations": { "list": [] },
  "description": "Terroir.ma API — request rate, latency, error rate",
  "editable": true,
  "fiscalYearStartMonth": 0,
  "graphTooltip": 1,
  "id": null,
  "links": [],
  "panels": [
    {
      "id": 1,
      "title": "Request Rate (req/s)",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 0 },
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "targets": [
        {
          "expr": "sum(rate(http_requests_total[1m])) by (method, route)",
          "legendFormat": "{{method}} {{route}}",
          "refId": "A"
        }
      ],
      "fieldConfig": {
        "defaults": { "unit": "reqps", "color": { "mode": "palette-classic" } },
        "overrides": []
      },
      "options": { "tooltip": { "mode": "multi" } }
    },
    {
      "id": 2,
      "title": "P95 Latency (ms)",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 12, "x": 12, "y": 0 },
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "targets": [
        {
          "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route)) * 1000",
          "legendFormat": "p95 {{route}}",
          "refId": "A"
        }
      ],
      "fieldConfig": {
        "defaults": { "unit": "ms", "color": { "mode": "palette-classic" } },
        "overrides": []
      }
    },
    {
      "id": 3,
      "title": "P99 Latency (ms)",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 8 },
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "targets": [
        {
          "expr": "histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route)) * 1000",
          "legendFormat": "p99 {{route}}",
          "refId": "A"
        }
      ],
      "fieldConfig": {
        "defaults": { "unit": "ms", "color": { "mode": "palette-classic" } },
        "overrides": []
      }
    },
    {
      "id": 4,
      "title": "5xx Error Rate (req/s)",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 12, "x": 12, "y": 8 },
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "targets": [
        {
          "expr": "sum(rate(http_requests_total{status=~\"5..\"}[1m])) by (route)",
          "legendFormat": "5xx {{route}}",
          "refId": "A"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "reqps",
          "color": { "fixedColor": "red", "mode": "fixed" },
          "thresholds": {
            "mode": "absolute",
            "steps": [
              { "color": "green", "value": null },
              { "color": "red", "value": 0.01 }
            ]
          }
        },
        "overrides": []
      }
    },
    {
      "id": 5,
      "title": "4xx Error Rate (req/s)",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 16 },
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "targets": [
        {
          "expr": "sum(rate(http_requests_total{status=~\"4..\"}[1m])) by (route)",
          "legendFormat": "4xx {{route}}",
          "refId": "A"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "reqps",
          "color": { "fixedColor": "orange", "mode": "fixed" }
        },
        "overrides": []
      }
    },
    {
      "id": 6,
      "title": "Top 10 Slowest Routes (P95 ms)",
      "type": "bargauge",
      "gridPos": { "h": 8, "w": 12, "x": 12, "y": 16 },
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "targets": [
        {
          "expr": "topk(10, histogram_quantile(0.95, sum by (le, route)(rate(http_request_duration_seconds_bucket[5m]))) * 1000)",
          "legendFormat": "{{route}}",
          "refId": "A",
          "instant": true
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "ms",
          "color": { "mode": "thresholds" },
          "thresholds": {
            "mode": "absolute",
            "steps": [
              { "color": "green", "value": null },
              { "color": "yellow", "value": 100 },
              { "color": "red", "value": 500 }
            ]
          }
        },
        "overrides": []
      },
      "options": { "orientation": "horizontal", "reduceOptions": { "calcs": ["lastNotNull"] } }
    }
  ],
  "refresh": "30s",
  "schemaVersion": 39,
  "tags": ["terroir", "api", "monitoring"],
  "templating": {
    "list": [
      {
        "hide": 2,
        "name": "DS_PROMETHEUS",
        "query": "prometheus",
        "type": "datasource"
      }
    ]
  },
  "time": { "from": "now-1h", "to": "now" },
  "timepicker": {},
  "timezone": "Africa/Casablanca",
  "title": "Terroir.ma — API Performance",
  "uid": "terroir-api-perf",
  "version": 1
}
```

**Verify:** File is valid JSON (`node -e "JSON.parse(require('fs').readFileSync('infrastructure/grafana/dashboards/terroir-api.json','utf8'))"`) — no errors.

---

### Task 9 — Unit tests for MetricsService + HttpMetricsInterceptor

**Files:** `src/common/metrics/metrics.service.spec.ts` (CREATE), `src/common/metrics/http-metrics.interceptor.spec.ts` (CREATE)

```typescript
// src/common/metrics/metrics.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetricsService],
    }).compile();
    service = module.get<MetricsService>(MetricsService);
    service.onModuleInit();
  });

  it('getMetrics() returns prometheus text format with correct metric names', async () => {
    service.record('GET', '/certifications', 200, 45);
    const output = await service.getMetrics();
    expect(output).toContain('http_request_duration_seconds');
    expect(output).toContain('http_requests_total');
    expect(output).toContain('route="/certifications"');
    expect(output).toContain('status="200"');
  });

  it('record() increments counter for each call', async () => {
    service.record('POST', '/certifications', 201, 80);
    service.record('POST', '/certifications', 201, 90);
    const output = await service.getMetrics();
    expect(output).toMatch(/http_requests_total\{[^}]*method="POST"[^}]*\} 2/);
  });

  it('getContentType() returns a non-empty string', () => {
    expect(service.getContentType()).toBeTruthy();
  });
});
```

```typescript
// src/common/metrics/http-metrics.interceptor.spec.ts
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';
import { MetricsService } from './metrics.service';

describe('HttpMetricsInterceptor', () => {
  let interceptor: HttpMetricsInterceptor;
  let metricsService: jest.Mocked<Pick<MetricsService, 'record'>>;

  beforeEach(() => {
    metricsService = { record: jest.fn() };
    interceptor = new HttpMetricsInterceptor(metricsService as unknown as MetricsService);
  });

  const makeContext = (method: string, routePath: string | undefined): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ method, route: routePath ? { path: routePath } : undefined }),
        getResponse: () => ({ statusCode: 200 }),
      }),
    }) as unknown as ExecutionContext;

  it('calls record() with normalized route after response', (done) => {
    const ctx = makeContext('GET', '/certifications/:id');
    const next: CallHandler = { handle: () => of(null) };
    interceptor.intercept(ctx, next).subscribe(() => {
      expect(metricsService.record).toHaveBeenCalledWith(
        'GET',
        '/certifications/:id',
        200,
        expect.any(Number),
      );
      done();
    });
  });

  it('falls back to "unknown" when route is not resolved (404)', (done) => {
    const ctx = makeContext('GET', undefined);
    const next: CallHandler = { handle: () => of(null) };
    interceptor.intercept(ctx, next).subscribe(() => {
      expect(metricsService.record).toHaveBeenCalledWith('GET', 'unknown', 200, expect.any(Number));
      done();
    });
  });

  it('records the correct HTTP method label', (done) => {
    const ctx = makeContext('POST', '/certifications');
    const next: CallHandler = { handle: () => of(null) };
    interceptor.intercept(ctx, next).subscribe(() => {
      expect(metricsService.record).toHaveBeenCalledWith(
        'POST',
        '/certifications',
        200,
        expect.any(Number),
      );
      done();
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

Test count must increase from 391 to ≥ 397 (3 MetricsService + 3 interceptor tests). All must pass.

---

### Task 10 — Update .env.example + end-to-end verification

**File:** `.env.example` (MODIFY)

Append to the end of `.env.example`:

```dotenv
# Monitoring (Prometheus + Grafana — monitoring/full Docker profile)
GRAFANA_PASSWORD=terroir
```

**Manual end-to-end verification (run once after tasks 1-9 complete):**

```bash
# 1. Start core + app services
cd infrastructure/docker
docker compose --profile core up -d
docker compose --profile app up -d --build

# 2. Confirm /metrics is reachable from localhost
curl -s http://localhost:3000/metrics | head -20
# Expected: lines starting with "# HELP http_request_duration_seconds" etc.

# 3. Start monitoring services
docker compose --profile monitoring up -d

# 4. Confirm Prometheus scrapes the app
# Open http://localhost:9090/targets → terroir-api must show State: UP

# 5. Confirm Grafana dashboard loads
# Open http://localhost:3100 → login admin/terroir
# Navigate to Dashboards → Terroir.ma → Terroir.ma — API Performance
# Panels must render (may show "No data" until traffic is generated)

# 6. Generate sample traffic
for i in $(seq 1 20); do curl -s http://localhost:3000/health; done

# 7. Confirm panels show data
# Refresh Grafana → Request Rate panel should show traffic spikes
```

**Final verification:**

```bash
npm run lint
npm run typecheck
npm run test:unit
```

All 397+ tests green, 0 lint errors, 0 type errors.

---

## Summary

| Batch | Tasks | Stories | Deliverable                                                                 |
| ----- | ----- | ------- | --------------------------------------------------------------------------- |
| 1     | 1–4   | US-091  | `MetricsModule` — service + interceptor + controller + guard wired globally |
| 2     | 5–7   | US-092  | Docker monitoring profile — Prometheus + Grafana services + config files    |
| 3     | 8–10  | US-093  | Grafana dashboard JSON + unit tests + env update                            |

**Files created (11):**

- `src/common/metrics/metrics.service.ts`
- `src/common/metrics/metrics.service.spec.ts`
- `src/common/metrics/http-metrics.interceptor.ts`
- `src/common/metrics/http-metrics.interceptor.spec.ts`
- `src/common/metrics/metrics-ip.guard.ts`
- `src/common/metrics/metrics.controller.ts`
- `src/common/metrics/metrics.module.ts`
- `infrastructure/prometheus/prometheus.yml`
- `infrastructure/grafana/provisioning/datasources/prometheus.yml`
- `infrastructure/grafana/provisioning/dashboards/terroir.yml`
- `infrastructure/grafana/dashboards/terroir-api.json`

**Files modified (2):**

- `src/app.module.ts`
- `infrastructure/docker/docker-compose.yml`
- `.env.example`
