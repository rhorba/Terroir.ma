# Sprint 12 Design — v1 Hardening + QR Scan Events

**Date:** 2026-04-14  
**Sprint:** 12 (final v1 sprint)  
**Dates:** 2026-04-14 – 2026-04-27  
**Estimated SP:** 18  
**Theme:** Ship v1 production-ready — US-058 QR scan tracking + ENV validation + OpenAPI docs + font assets + integration/E2E test gaps

---

## Scope

| Area      | Story / Task                                                                                | SP        |
| --------- | ------------------------------------------------------------------------------------------- | --------- |
| US-058    | Track QR scan events — entity, migration, fire-and-forget write, stats endpoint, unit tests | 5         |
| Hardening | ENV validation — Joi schema wired into ConfigModule                                         | 1         |
| Hardening | OpenAPI/Swagger — SwaggerModule setup + annotation pass + JSON export                       | 3         |
| Hardening | Font assets — download script + PDF graceful fallback                                       | 1         |
| Hardening | Integration tests — 4 new files covering common + Sprint 11 gaps + US-058                   | 5         |
| Hardening | E2E smoke tests — cooperative onboarding → product → certification grant → QR verify        | 3         |
| **Total** |                                                                                             | **18 SP** |

---

## Design Decisions

### 1. US-058: QR Scan Event Table

**What:** New append-only table `certification.qr_scan_event`. Written fire-and-forget inside `verifyQrCode()` after a successful valid scan (status = GRANTED). Invalid scans (expired, revoked, not found) are NOT logged — no value in tracking bad scans.

**Schema:**

```sql
CREATE TABLE certification.qr_scan_event (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_code_id  UUID NOT NULL,
  certification_id UUID NOT NULL,
  scanned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address  VARCHAR(45)          -- nullable; IPv4 or IPv6
);
CREATE INDEX idx_qr_scan_event_qr_code_id       ON certification.qr_scan_event(qr_code_id);
CREATE INDEX idx_qr_scan_event_certification_id ON certification.qr_scan_event(certification_id);
CREATE INDEX idx_qr_scan_event_scanned_at       ON certification.qr_scan_event(scanned_at);
```

No FK constraints — modular monolith pattern. No `updatedAt` — append-only, immutable.

**Write pattern:** Fire-and-forget inside `verifyQrCode()`, same as `AuditLog.record()`:

```ts
this.qrScanEventRepo
  .save(this.qrScanEventRepo.create({ qrCodeId, certificationId, ipAddress }))
  .catch((err) => this.logger.error(err, 'Failed to write QR scan event'));
```

Written AFTER the cache is populated — never blocks the 200ms SLA.

**Stats endpoint:**

```
GET /certifications/:id/scan-stats
Roles: super-admin, certification-body
Response: { certificationId, totalScans, last30DaysScans, firstScanAt, lastScanAt }
```

Raw SQL `COUNT(*) + MIN/MAX + COUNT WHERE scanned_at > now() - interval '30 days'` — single query, no Redis cache needed (low traffic admin endpoint).

### 2. ENV Validation — Joi Schema

**What:** `src/config/env.validation.ts` exports a `validateEnv(config)` function using `joi`. Wired into `ConfigModule.forRoot({ validate: validateEnv })`. App refuses to start with a descriptive error if any required var is missing or malformed.

**Required vars:**

```
DATABASE_URL            (string, required)
REDIS_HOST              (string, required)
REDIS_PORT              (number, default 6379)
KAFKA_BROKERS           (string, required)
QR_HMAC_SECRET          (string, min 32 chars, required)
KEYCLOAK_URL            (string uri, required)
KEYCLOAK_REALM          (string, required)
KEYCLOAK_CLIENT_ID      (string, required)
KEYCLOAK_JWKS_URI       (string uri, required)
MINIO_ENDPOINT          (string, required)
MINIO_ACCESS_KEY        (string, required)
MINIO_SECRET_KEY        (string, required)
```

**Optional with defaults:**

```
PORT                    (number, default 3000)
NODE_ENV                (string, default 'development')
LOG_LEVEL               (string, default 'info')
MINIO_PORT              (number, default 9000)
MINIO_USE_SSL           (boolean, default false)
MINIO_BUCKET            (string, default 'terroir-uploads')
SMTP_HOST               (string, default 'localhost')
SMTP_PORT               (number, default 1025)
```

**Package:** `joi` (install via `npm install joi`). NestJS ConfigModule's `validate` function receives the raw env object and must return the validated config or throw.

### 3. OpenAPI / Swagger

**What:** `@nestjs/swagger` is already in `package.json`. Wire `SwaggerModule` in `main.ts` under `/api-docs` (dev only). Add a `npm run export:openapi` script that boots the app, dumps `SwaggerModule.createDocument()` to `docs/api/openapi.json`, then exits.

**Annotation pass — controllers to annotate:**

- `src/health/health.controller.ts` — `@ApiTags('health')`
- `src/common/controllers/user.controller.ts` — `@ApiTags('users')`
- `src/common/controllers/admin.controller.ts` — `@ApiTags('admin')`
- `src/modules/cooperative/controllers/cooperative.controller.ts` — `@ApiTags('cooperatives')`
- `src/modules/product/controllers/product.controller.ts` — `@ApiTags('products')`
- `src/modules/product/controllers/lab-test.controller.ts` — `@ApiTags('lab-tests')`
- `src/modules/product/controllers/lab.controller.ts` — `@ApiTags('labs')`
- `src/modules/product/controllers/product-document.controller.ts` — `@ApiTags('product-documents')`
- `src/modules/certification/controllers/certification.controller.ts` — `@ApiTags('certifications')`
- `src/modules/certification/controllers/qr-code.controller.ts` — `@ApiTags('qr-codes')`
- `src/modules/certification/controllers/export-document.controller.ts` — `@ApiTags('export-documents')`
- `src/modules/notification/controllers/notification.controller.ts` — `@ApiTags('notifications')`

Each controller gets `@ApiBearerAuth()` + `@ApiOperation({ summary })` on each endpoint + `@ApiResponse({ status: 200 })` on happy path. No full request/response body schemas — that's Phase 2 API-first work.

**Export script** (`package.json`):

```json
"export:openapi": "ts-node -e \"require('./src/scripts/export-openapi')\""
```

`src/scripts/export-openapi.ts` — NestFactory.create → SwaggerModule.createDocument → JSON.stringify → writeFileSync to `docs/api/openapi.json` → process.exit(0).

### 4. Font Assets + PDF Graceful Fallback

**What:** Two OFL/free fonts have been a carry-forward since Sprint 8.

**Deliverables:**

1. `assets/fonts/.gitkeep` — ensures the directory is tracked by git
2. `scripts/download-fonts.sh` — curl commands to download both fonts from their canonical release URLs. Dev runbook entry.
3. **PDF service graceful fallback** in `src/modules/certification/services/pdf-certificate.service.ts` and `src/modules/certification/services/export-document-pdf.service.ts`:
   - `existsSync(fontPath)` check before `doc.registerFont()`
   - If font absent: log a `WARN` with "Run scripts/download-fonts.sh to install fonts" and fall back to PDFKit's built-in `Helvetica`
   - Arabic block degrades gracefully (no crash, reduced visual quality noted in log)

### 5. Integration Tests — New Files

**Existing files (no changes needed):**

- `test/integration/cooperative/cooperative.integration.ts`
- `test/integration/product/product.integration.ts` + `harvest-to-batch.integration.ts`
- `test/integration/certification/certification-chain.integration.ts` + `certification.service.integration.ts`
- `test/integration/notification/notification.service.integration.ts`

**New files for Sprint 12:**

#### `test/integration/common/system-settings.integration.ts`

- Entity: `SystemSetting`
- Tests: seed defaults row → readGroup returns typed DTO → upsertGroup updates values → cache-aside pattern (Redis mock → DB fallback)

#### `test/integration/common/audit-log.integration.ts`

- Entity: `AuditLog`
- Tests: record() persists row → findAll() paginates → no updatedAt column (append-only schema)

#### `test/integration/certification/qr-scan-event.integration.ts`

- Entities: `QrScanEvent` (new Sprint 12), `QrCode`
- Tests: fire-and-forget write → row appears in DB → scan-stats query returns correct totalScans and last30DaysScans

#### `test/integration/notification/notification-preference.integration.ts`

- Entity: `NotificationPreference`
- Tests: upsert creates row on first call → upsert updates on second call → GET returns default when no row → channels array persisted correctly as TEXT[]

### 6. E2E Smoke Tests

**What:** `test/e2e/smoke/` directory. One file per critical flow. Uses Supertest against a live NestJS app with Testcontainers PostgreSQL (no Keycloak — JWT mocked via test helper).

**Files:**

- `test/e2e/smoke/cooperative-onboarding.e2e.ts` — POST /cooperatives → GET /cooperatives/:id → PUT /cooperatives/:id/verify
- `test/e2e/smoke/certification-grant.e2e.ts` — POST /certifications → walk to GRANTED → GET /certifications/:id/events
- `test/e2e/smoke/qr-verify.e2e.ts` — POST /qr-codes (generate) → GET /verify/:hmac → assert valid: true → GET /certifications/:id/scan-stats → assert totalScans: 1

**JWT mock:** `test/helpers/jwt.helper.ts` (already exists or will be created) — signs a test JWT with the same `KEYCLOAK_JWKS_URI` secret bypassed via `{ ignoreExpiration: true }` and a test public/private key pair.

---

## New Files

### US-058

- `src/database/migrations/1700000000017-AddQrScanEvent.ts`
- `src/modules/certification/entities/qr-scan-event.entity.ts`
- `src/modules/certification/dto/scan-stats.dto.ts`
- `test/unit/certification/qr-code.service.spec.ts` (extend existing)

### ENV Validation

- `src/config/env.validation.ts`

### OpenAPI

- `src/scripts/export-openapi.ts`
- `docs/api/openapi.json` (generated artifact)

### Font Assets

- `assets/fonts/.gitkeep`
- `scripts/download-fonts.sh`

### Integration Tests

- `test/integration/common/system-settings.integration.ts`
- `test/integration/common/audit-log.integration.ts`
- `test/integration/certification/qr-scan-event.integration.ts`
- `test/integration/notification/notification-preference.integration.ts`

### E2E

- `test/e2e/smoke/cooperative-onboarding.e2e.ts`
- `test/e2e/smoke/certification-grant.e2e.ts`
- `test/e2e/smoke/qr-verify.e2e.ts`

---

## Modified Files

### US-058

- `src/modules/certification/services/qr-code.service.ts` — inject `QrScanEventRepo`, fire-and-forget write, new `getScanStats()` method
- `src/modules/certification/controllers/qr-code.controller.ts` (or `certification.controller.ts`) — add `GET /certifications/:id/scan-stats`
- `src/modules/certification/certification.module.ts` — register `QrScanEvent` entity

### ENV Validation

- `src/app.module.ts` — `ConfigModule.forRoot({ validate: validateEnv })`

### OpenAPI

- `src/main.ts` — `SwaggerModule.createDocument` + `SwaggerModule.setup`
- All 12 controllers listed above — `@ApiTags`, `@ApiBearerAuth`, `@ApiOperation`
- `package.json` — `export:openapi` script + `joi` dependency

### Font Assets

- `src/modules/certification/services/pdf-certificate.service.ts` — graceful font fallback
- `src/modules/certification/services/export-document-pdf.service.ts` — graceful font fallback

---

## API Contract

### GET /certifications/:id/scan-stats

```
Authorization: Bearer <token>
Roles: super-admin, certification-body

200 OK
{
  "success": true,
  "data": {
    "certificationId": "uuid",
    "totalScans": 42,
    "last30DaysScans": 7,
    "firstScanAt": "2026-01-15T10:23:00Z",
    "lastScanAt": "2026-04-10T14:55:00Z"
  }
}
```

---

## YAGNI Decisions

| Skipped                                    | Reason                                                                                       |
| ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| US-053 QR offline verification             | Requires asymmetric crypto + QR format change — Phase 2                                      |
| US-027 ONSSA lab integration               | External API dependency — Phase 2                                                            |
| Full OpenAPI request/response body schemas | Phase 2 API-first design pass                                                                |
| Kafka event on QR scan                     | Public hot path — adds latency, no consumer yet — Phase 2                                    |
| Top IPs in scan-stats                      | CNDP concern — storing IP analytics at aggregate level is fine, exposing per-IP lists is PII |
| Redpanda integration tests                 | Testcontainers Redpanda is flaky on Windows — unit tests cover Kafka path                    |

---

## Post-Sprint v1 Checklist

After Sprint 12, v1 is complete when:

- [ ] `npm run migration:run` — all 17 migrations applied clean
- [ ] `scripts/download-fonts.sh` run — PDF endpoints produce correct output
- [ ] `npm run export:openapi` — `docs/api/openapi.json` generated
- [ ] All unit tests pass: `npm run test`
- [ ] ENV validation rejects bad config: remove a required var, confirm app fails with clear error
- [ ] `GET /api-docs` accessible in dev with all endpoints listed
- [ ] Integration tests pass: `npm run test:integration` (requires `docker compose up`)
- [ ] E2E smoke tests pass: `npm run test:e2e` (requires `docker compose up`)
