# k6 Performance Tests

Load and smoke tests for the Terroir.ma API using [k6](https://k6.io/).

## Prerequisites

k6 must be installed:

```bash
# macOS
brew install k6

# Ubuntu/Debian
sudo gpg -k && sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Windows (Chocolatey)
choco install k6
```

## Scripts

| Script                     | Threshold    | Description                                           |
| -------------------------- | ------------ | ----------------------------------------------------- |
| `qr-verify.k6.js`          | p95 < 200ms  | QR code verification (hard domain SLA — Redis-cached) |
| `certification-list.k6.js` | p95 < 500ms  | Paginated certification listing                       |
| `smoke.k6.js`              | p95 < 1000ms | CI-safe liveness/readiness smoke test (no auth)       |

## Run locally

Backend must be running on port 3000 first.

```bash
# Smoke test (no auth, CI-safe)
npm run perf:smoke

# QR verify load test (seed QR_TOKEN from test DB first)
QR_TOKEN=<token> npm run perf:qr

# Certification list load test (obtain K6_TOKEN from Keycloak)
K6_TOKEN=<bearer> npm run perf:list

# All tests sequentially
npm run perf:all
```

## Environment variables

| Variable   | Default                 | Description                              |
| ---------- | ----------------------- | ---------------------------------------- |
| `BASE_URL` | `http://localhost:3000` | API base URL                             |
| `QR_TOKEN` | `test-qr-token-seed`    | Signed QR token for verify endpoint      |
| `K6_TOKEN` | _(empty)_               | Bearer token for authenticated endpoints |

## Thresholds

| Endpoint                     | p95 target | Rationale                                  |
| ---------------------------- | ---------- | ------------------------------------------ |
| `GET /api/v1/qr/verify`      | < 200ms    | Domain SLA — consumer-facing, Redis-cached |
| `GET /api/v1/certifications` | < 500ms    | Paginated list with DB query               |
| `GET /health`                | < 1000ms   | Liveness probe                             |

## CI

The `.github/workflows/performance.yml` workflow runs the smoke test on every push to `main` and the full load tests on the weekly schedule (Monday 05:00 UTC). Threshold failures fail the build.
