# OWASP ZAP Security Scan

Passive API security scan using the exported OpenAPI spec. Does not inject malicious payloads.

## Prerequisites

Backend must be running on port 3000:

```bash
# Option A — dev mode
docker compose --profile core up -d
npm run start:dev

# Option B — Docker full stack
docker compose --profile full up -d
```

## Run locally

```bash
npm run export:openapi        # refresh docs/api/openapi.json
npm run security:scan         # run ZAP passive scan
```

Report saved to `docs/security/zap-report.html` (gitignored — open in browser).

## CI

The `.github/workflows/security.yml` workflow runs on every push to main
and weekly (Monday 04:00 UTC). It starts the Docker test stack, builds and
runs the NestJS API, then runs ZAP. Fails the build on High/Critical alerts.

## False positive rules

`infrastructure/zap/rules.tsv` suppresses alerts that don't apply to a
stateless JSON API secured with JWT Bearer tokens (no HTML, no cookies).

## Severity policy

| Level               | CI behaviour                        |
| ------------------- | ----------------------------------- |
| High / Critical     | Fails the build                     |
| Medium              | Warning only (logged, not blocking) |
| Low / Informational | Ignored                             |

## Mac / Windows note

ZAP uses `--network host` in the Docker command which is Linux-only.
On Mac/Windows, replace with `--add-host=host.docker.internal:host-gateway`
and use `http://host.docker.internal:3000` as the target URL.
