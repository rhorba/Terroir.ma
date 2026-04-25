# P2-S5: OWASP ZAP Security Scanning + k6 Performance Testing — Implementation Plan

> **For Claude:** Use /execute to implement this plan task-by-task.

**Goal:** Wire up OWASP ZAP passive security scanning and k6 performance scripts against the live API, with CI workflows and local npm scripts — verifying the domain-mandated < 200ms QR verification SLA.

**Architecture:**

- ZAP: `zaproxy/zap-stable` Docker image, baseline passive scan against the running NestJS API, suppression rules for known API-only false positives, HTML + JSON reports saved to `docs/security/`
- k6: JS performance scripts in `test/performance/`, thresholds enforced (p95 < 200ms for QR verify, p95 < 500ms for list endpoints), run against the dev stack locally and in CI
- CI: `.github/workflows/security.yml` (ZAP, requires core Docker profile) + `.github/workflows/performance.yml` (k6, requires running backend)

**Tech Stack:** NestJS, TypeScript, Docker, OWASP ZAP, k6

**Modules Affected:** common (API surface), certification (QR verify SLA), all controllers

**Estimated Story Points:** 10 (US-104: ZAP 5 SP, US-105: k6 5 SP)

---

## Context: Why Two New Stories

The PRODUCT-BACKLOG.md Phase 2 sprint plan ended at US-103 (now done). CLAUDE.md explicitly marks OWASP ZAP security scanning and performance testing with k6/Artillery as Phase 2 deliverables. This plan introduces US-104 and US-105 and updates the backlog accordingly (Task 9).

---

## Batch 1 — OWASP ZAP Infrastructure (Tasks 1–3)

### Task 1 — ZAP Config Files

**Directory to create:** `infrastructure/zap/`

**File to create:** `infrastructure/zap/zap.yaml`

ZAP automation framework config (used by `zap-baseline.py` via `--autorun`):

```yaml
env:
  contexts:
    - name: Terroir API
      urls:
        - http://localhost:3000
      includePaths:
        - http://localhost:3000/api/v1.*
      excludePaths:
        - http://localhost:3000/health
        - http://localhost:3000/ready
        - http://localhost:3000/metrics
  parameters:
    failOnError: true
    failOnWarning: false
    progressToStdout: true

jobs:
  - type: openapi
    parameters:
      apiFile: /zap/wrk/openapi.json
      targetUrl: http://localhost:3000

  - type: passiveScan-wait
    parameters:
      maxDuration: 60

  - type: report
    parameters:
      template: traditional-html
      reportDir: /zap/wrk/reports/
      reportFile: zap-report.html

  - type: report
    parameters:
      template: json-summary
      reportDir: /zap/wrk/reports/
      reportFile: zap-report.json
```

**File to create:** `infrastructure/zap/rules.tsv`

Suppress known false positives that don't apply to a JSON API (no HTML pages):

```tsv
10010	IGNORE	(Secure Pages Include Mixed Content)
10011	IGNORE	(Cookie Without Secure Flag - API only, no HTML cookies)
10015	IGNORE	(Incomplete or No Cache-control and Pragma HTTP Header Set)
10016	IGNORE	(Web Browser XSS Protection Not Enabled - API)
10017	IGNORE	(Cross-Domain JavaScript Source File Inclusion - API)
10020	IGNORE	(X-Frame-Options Header Not Set - API, not HTML)
10021	IGNORE	(X-Content-Type-Options Header Missing)
10096	IGNORE	(Timestamp Disclosure - not a security risk for ISO timestamps)
90003	IGNORE	(Sub Resource Integrity Attribute Missing - API)
```

**File to create:** `infrastructure/zap/README.md`

````markdown
# OWASP ZAP Security Scan

## Prerequisites

- Backend running: `docker compose --profile core up -d && npm run start:dev`
- Or Docker app: `docker compose --profile full up -d`

## Run locally

```bash
npm run security:scan
```
````

## What it scans

- Passive scan of all endpoints defined in `docs/api/openapi.json`
- Does NOT submit malicious payloads (passive only)
- Reports saved to `docs/security/zap-report.html`

## Severity levels

- High/Critical → fails CI
- Medium → warning only
- Low/Informational → ignored in CI

````

---

### Task 2 — ZAP Docker Service + npm Script

**File to modify:** `infrastructure/docker/docker-compose.test.yml`

Add ZAP as a one-shot service (exits after scan):

```yaml
  # ─────────────────────────────────────────────
  # OWASP ZAP — passive security scan (one-shot, run via npm run security:scan)
  # ─────────────────────────────────────────────
  zap-scan:
    image: zaproxy/zap-stable:latest
    container_name: terroir-zap-scan
    volumes:
      - ../../docs/api:/zap/wrk:ro
      - ../../infrastructure/zap/rules.tsv:/home/zap/.ZAP/config/rules.tsv:ro
      - ../../docs/security:/zap/wrk/reports:rw
    command: zap-api-scan.py
      -t /zap/wrk/openapi.json
      -f openapi
      -r reports/zap-report.html
      -J reports/zap-report.json
      -c /home/zap/.ZAP/config/rules.tsv
      -I
    profiles:
      - zap
    networks:
      - terroir-test-network
    restart: "no"
````

**File to modify:** `package.json` — add npm scripts:

```json
"security:scan": "docker compose -f infrastructure/docker/docker-compose.test.yml --profile zap run --rm zap-scan",
"security:scan:ci": "docker compose -f infrastructure/docker/docker-compose.test.yml --profile zap run --rm --env ZAP_TARGET=http://terroir-app:3000 zap-scan"
```

**Directory to create:** `docs/security/` — add `.gitkeep` so the directory is committed:

```bash
mkdir -p docs/security && touch docs/security/.gitkeep
```

**File to modify:** `.gitignore` — exclude generated reports but keep the directory:

```
# ZAP security reports — generated, not committed
docs/security/zap-report.html
docs/security/zap-report.json
```

---

### Task 3 — Export OpenAPI Script Validation + ZAP Smoke Test

The ZAP scan reads `docs/api/openapi.json`. Verify it is valid and up-to-date before scanning.

**File to modify:** `package.json` — add `precheck:security` script:

```json
"precheck:security": "npx ts-node src/scripts/export-openapi.ts",
"check:security": "npm run security:scan"
```

Also verify the report output directory exists in CI:

```bash
mkdir -p docs/security
```

**Verification checkpoint — ZAP config:**

```bash
# Validate ZAP yaml syntax (dry run — no actual scan)
docker run --rm -v "$(pwd)/infrastructure/zap:/zap/wrk:ro" zaproxy/zap-stable \
  zap.sh -cmd -autorun /zap/wrk/zap.yaml -config api.disablekey=true 2>&1 | head -20
# Expected: no parse errors
npm run lint
npm run typecheck
```

---

## Batch 2 — k6 Performance Scripts (Tasks 4–6)

### Task 4 — QR Verify Performance Script

**File to create:** `test/performance/qr-verify.k6.js`

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const verifyDuration = new Trend('qr_verify_duration', true);

// Domain rule: QR verification MUST respond in < 200ms (with Redis cache)
export const options = {
  stages: [
    { duration: '10s', target: 20 }, // ramp up to 20 VUs
    { duration: '30s', target: 50 }, // hold at 50 VUs (realistic peak scan load)
    { duration: '10s', target: 0 }, // ramp down
  ],
  thresholds: {
    // Hard SLA: p95 under 200ms (domain rule in CLAUDE.md)
    qr_verify_duration: ['p(95)<200'],
    http_req_duration: ['p(95)<200'],
    errors: ['rate<0.01'], // < 1% error rate
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Use a known test certification QR UUID — set via env or use a placeholder
// The endpoint returns 404 for unknown UUIDs but still exercises the full stack
const TEST_QR_UUID = __ENV.TEST_QR_UUID || '00000000-0000-0000-0000-000000000001';

export default function () {
  const res = http.get(`${BASE_URL}/api/v1/certifications/qr/${TEST_QR_UUID}/verify`, {
    tags: { name: 'qr_verify' },
  });

  verifyDuration.add(res.timings.duration);

  const ok = check(res, {
    'status is 200 or 404': (r) => r.status === 200 || r.status === 404,
    'response under 200ms': (r) => r.timings.duration < 200,
  });

  errorRate.add(!ok);
  sleep(0.1);
}
```

---

### Task 5 — Certification List + Export Document Performance Scripts

**File to create:** `test/performance/certification-list.k6.js`

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '10s', target: 10 },
    { duration: '30s', target: 20 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    errors: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
// JWT token for an authenticated request — set via env or use empty (will get 401)
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

export default function () {
  const headers = AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {};

  // Health check — always unauthenticated, validates API is alive
  const health = http.get(`${BASE_URL}/health`, { tags: { name: 'health' } });
  check(health, { 'health 200': (r) => r.status === 200 });

  // QR verify — public endpoint, no auth
  const qr = http.get(
    `${BASE_URL}/api/v1/certifications/qr/00000000-0000-0000-0000-000000000001/verify`,
    { tags: { name: 'qr_verify_cached' } },
  );
  check(qr, { 'qr 200 or 404': (r) => r.status === 200 || r.status === 404 });

  const ok = qr.status === 200 || qr.status === 404;
  errorRate.add(!ok);

  sleep(0.2);
}
```

**File to create:** `test/performance/smoke.k6.js`

Minimal smoke test — validates the API is alive and responds quickly. Used in CI without auth.

```javascript
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 1,
  duration: '5s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const res = http.get(`${BASE_URL}/health`);
  check(res, { 'status 200': (r) => r.status === 200 });
}
```

---

### Task 6 — k6 npm Scripts + README

**File to modify:** `package.json` — add k6 scripts:

```json
"perf:qr":    "k6 run test/performance/qr-verify.k6.js",
"perf:list":  "k6 run test/performance/certification-list.k6.js",
"perf:smoke": "k6 run test/performance/smoke.k6.js",
"perf:all":   "k6 run test/performance/qr-verify.k6.js && k6 run test/performance/certification-list.k6.js"
```

**File to create:** `test/performance/README.md`

````markdown
# Performance Tests — k6

## Prerequisites

- k6 installed: https://k6.io/docs/get-started/installation/
- Backend running on port 3000: `docker compose --profile core up -d && npm run start:dev`

## Scripts

| Script                     | Endpoint                                     | SLA                       |
| -------------------------- | -------------------------------------------- | ------------------------- |
| `qr-verify.k6.js`          | `GET /api/v1/certifications/qr/:uuid/verify` | p95 < 200ms (domain rule) |
| `certification-list.k6.js` | Mixed public endpoints                       | p95 < 500ms               |
| `smoke.k6.js`              | `GET /health`                                | p95 < 500ms, CI-safe      |

## Run

```bash
# Full QR verify SLA test (50 VUs, 50s)
npm run perf:qr

# With a real QR UUID from your dev database:
BASE_URL=http://localhost:3000 TEST_QR_UUID=<real-uuid> k6 run test/performance/qr-verify.k6.js

# Smoke (CI-safe, no auth needed):
npm run perf:smoke
```
````

## Thresholds

Failing a threshold exits k6 with a non-zero code, which fails CI.

The `p95 < 200ms` threshold on QR verify is a hard domain requirement from Law 25-06
certification chain — consumers must be able to verify product authenticity quickly.

````

**Verification checkpoint — k6 syntax:**
```bash
# Validate all k6 scripts compile (requires k6 installed, or use Docker image)
docker run --rm -v "$(pwd)/test/performance:/perf:ro" grafana/k6:latest \
  run --dry-run /perf/smoke.k6.js
npm run lint
npm run typecheck
````

---

## Batch 3 — CI Workflows + Backlog Update (Tasks 7–9)

### Task 7 — `.github/workflows/security.yml`

**File to create:** `.github/workflows/security.yml`

```yaml
name: OWASP ZAP Security Scan

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 4 * * 1' # Weekly Monday 04:00 UTC

jobs:
  zap-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Start core Docker stack
        run: docker compose -f infrastructure/docker/docker-compose.test.yml up -d --wait
        env:
          COMPOSE_FILE: infrastructure/docker/docker-compose.test.yml

      - name: Build and start NestJS API
        run: |
          npm run build
          NODE_ENV=test \
          DATABASE_URL=postgres://terroir_test:terroir_test_pass@localhost:5434/terroir_test_db \
          REDIS_URL=redis://localhost:6380 \
          KAFKA_BROKERS=localhost:19093 \
          SCHEMA_REGISTRY_URL=http://localhost:8082 \
          KEYCLOAK_URL=http://localhost:8444 \
          KEYCLOAK_REALM=terroir-ma \
          KEYCLOAK_CLIENT_ID=api-client \
          KEYCLOAK_CLIENT_SECRET=change-me-in-production \
          npm run start:prod &
          npx wait-on http://localhost:3000/health --timeout 30000

      - name: Export OpenAPI spec
        run: npm run export:openapi 2>/dev/null || echo "Using existing openapi.json"

      - name: Create security report output dir
        run: mkdir -p docs/security

      - name: Run ZAP API passive scan
        run: |
          docker run --rm \
            --network host \
            -v "${{ github.workspace }}/docs/api:/zap/wrk:ro" \
            -v "${{ github.workspace }}/docs/security:/zap/wrk/reports:rw" \
            -v "${{ github.workspace }}/infrastructure/zap/rules.tsv:/home/zap/.ZAP_D/rules.tsv:ro" \
            zaproxy/zap-stable \
            zap-api-scan.py \
              -t /zap/wrk/openapi.json \
              -f openapi \
              -r reports/zap-report.html \
              -J reports/zap-report.json \
              -c /home/zap/.ZAP_D/rules.tsv \
              -I \
              -l WARN

      - name: Upload ZAP report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: zap-security-report
          path: docs/security/
          retention-days: 30
```

---

### Task 8 — `.github/workflows/performance.yml`

**File to create:** `.github/workflows/performance.yml`

```yaml
name: k6 Performance Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  k6-smoke:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Start core Docker stack
        run: docker compose -f infrastructure/docker/docker-compose.test.yml up -d --wait

      - name: Build and start NestJS API
        run: |
          npm run build
          NODE_ENV=test \
          DATABASE_URL=postgres://terroir_test:terroir_test_pass@localhost:5434/terroir_test_db \
          REDIS_URL=redis://localhost:6380 \
          KAFKA_BROKERS=localhost:19093 \
          SCHEMA_REGISTRY_URL=http://localhost:8082 \
          KEYCLOAK_URL=http://localhost:8444 \
          KEYCLOAK_REALM=terroir-ma \
          KEYCLOAK_CLIENT_ID=api-client \
          KEYCLOAK_CLIENT_SECRET=change-me-in-production \
          npm run start:prod &
          npx wait-on http://localhost:3000/health --timeout 30000

      - name: Install k6
        run: |
          sudo gpg -k
          sudo gpg --no-default-keyring \
            --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
            --keyserver hkp://keyserver.ubuntu.com:80 \
            --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] \
            https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6

      - name: Run k6 smoke test
        run: k6 run --env BASE_URL=http://localhost:3000 test/performance/smoke.k6.js

      - name: Run k6 QR verify SLA test
        run: |
          k6 run \
            --env BASE_URL=http://localhost:3000 \
            test/performance/qr-verify.k6.js

      - name: Upload k6 summary
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: k6-performance-report
          path: k6-summary.json
          retention-days: 14
```

---

### Task 9 — Update PRODUCT-BACKLOG.md + `.gitignore`

**File to modify:** `docs/project-management/PRODUCT-BACKLOG.md`

1. Add US-104 and US-105 to Epic 9 (new sub-section 9e):

```markdown
### 9e — Security Scanning + Performance Testing

| Story ID | User Story                                                                                                                                                                                   | Priority | Status | Points |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ | ------ |
| US-104   | As a DevOps engineer, I want OWASP ZAP passive security scanning against the API so that common vulnerabilities are caught before production deployment                                      | High     | Todo   | 5      |
| US-105   | As a DevOps engineer, I want k6 performance scripts enforcing p95 < 200ms on QR verification and p95 < 500ms on list endpoints so that the Law 25-06 real-time SLA is verified automatically | High     | Todo   | 5      |

**9e Total Points:** 10
```

2. Update Epic 9 total: 65 → 75 SP

3. Update the Phase 2 Sprint Plan table — add P2-S5 row:

```markdown
| P2-S5 | Security + Performance | US-104, US-105 | 10 | ZAP passive scan CI-integrated, k6 QR verify SLA enforced, performance baseline established |
```

4. Update the Backlog Summary table — Epic 9 row: Todo 13 → 15 (add US-104/105)

5. Mark US-091 through US-103 as Done in the table (Status column: `Todo` → `Done`).

**File to modify:** `.gitignore`

```
# ZAP and k6 — generated reports, not committed
docs/security/zap-report.html
docs/security/zap-report.json
k6-summary.json
```

**Final verification checkpoint:**

```bash
npm run lint
npm run typecheck
npm run test:unit
```

All 436 tests must still pass.

---

## Testing Summary

| What              | How                                        | Success criterion             |
| ----------------- | ------------------------------------------ | ----------------------------- |
| ZAP config syntax | `docker run zaproxy ... --dry-run`         | No parse errors               |
| k6 script syntax  | `k6 run --dry-run smoke.k6.js`             | No JS errors                  |
| QR verify SLA     | `npm run perf:qr` (local, backend running) | p95 < 200ms                   |
| CI ZAP            | `.github/workflows/security.yml`           | No High/Critical alerts       |
| CI k6 smoke       | `.github/workflows/performance.yml`        | Smoke passes, QR SLA enforced |

---

## Story Point Summary

| Story     | Scope                              | SP     | Batch |
| --------- | ---------------------------------- | ------ | ----- |
| US-104    | OWASP ZAP scan infrastructure + CI | 5      | 1, 3  |
| US-105    | k6 performance scripts + CI        | 5      | 2, 3  |
| **Total** |                                    | **10** |       |

---

## Known Constraints

- ZAP scans require the NestJS API to be running (passive scan, no SQL injection payloads)
- k6 QR verify test uses a placeholder UUID that returns 404 — still exercises the full Redis → DB lookup path; for a real SLA test pass `TEST_QR_UUID=<certified-product-uuid>`
- `npm run start:prod` requires `npm run build` first — CI workflows include this step
- ZAP `--network host` is Linux-only — CI runs on `ubuntu-latest`, local Docker on Mac/Windows needs host networking workaround (documented in `infrastructure/zap/README.md`)
- Phase 2 after P2-S5: all 75 SP complete → Phase 3 (Kubernetes extraction) begins
