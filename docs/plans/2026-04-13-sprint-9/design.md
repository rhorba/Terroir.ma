# Sprint 9 Design — File Uploads, Export PDF, Compliance Reports

**Date:** 2026-04-13
**Sprint:** 9
**Story Points:** 22 SP
**Theme:** File uploads (MinIO), PDF export certificate, MAPMDREF/ONSSA compliance reports

---

## Stories

| Story  | Title                                                | SP  | Module        |
| ------ | ---------------------------------------------------- | --- | ------------- |
| US-017 | Upload supporting documents for product registration | 3   | product       |
| US-026 | Upload PDF lab report alongside structured results   | 3   | product       |
| US-030 | Flag a lab as accredited                             | 3   | product       |
| US-068 | Generate PDF export certificate                      | 5   | certification |
| US-083 | Cooperative compliance report                        | 5   | certification |
| US-089 | Report of active certifications for ONSSA            | 3   | certification |

---

## Design Decisions

| Question            | Decision                                             | Rationale                                                                                  |
| ------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Sprint theme        | File uploads + export docs                           | Closes US-017/026 gap, adds PDF for export, delivers compliance reports                    |
| File storage        | MinIO via Docker (S3-compatible)                     | Files survive container restarts; swapping to cloud S3 in Phase 2 = one config change      |
| File download       | NestJS StreamableFile proxy                          | Consistent with existing PDF certificate pattern; MinIO stays internal                     |
| US-030 enforcement  | YAGNI metadata only                                  | No Keycloak Admin API dependency; accreditation as reference data for reports              |
| US-083 cross-module | Denormalized cooperativeName in Certification entity | Already stored (confirmed: Certification.cooperativeName, line 72) — zero migration needed |

---

## Infrastructure Changes

### MinIO Docker Service

Add to `docker-compose.yml`:

```yaml
minio:
  image: quay.io/minio/minio:latest
  ports:
    - '9000:9000' # S3 API
    - '9001:9001' # Web console
  environment:
    MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
    MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
  command: server /data --console-address ":9001"
  volumes:
    - minio_data:/data
  healthcheck:
    test: ['CMD', 'curl', '-f', 'http://localhost:9000/minio/health/live']
    interval: 10s
    retries: 5
```

Add `minio_data` to volumes section.

### New env vars (.env.example)

```
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=terroir-uploads
MINIO_USE_SSL=false
```

In Docker network, NestJS connects to `minio:9000` (service name). In local dev, `localhost:9000`.

### MinioService (`src/common/services/minio.service.ts`)

- Wraps `@aws-sdk/client-s3` (`S3Client`)
- Methods:
  - `uploadFile(key: string, buffer: Buffer, mimeType: string): Promise<void>`
  - `getFileStream(key: string): Promise<Readable>`
  - `deleteFile(key: string): Promise<void>`
  - `ensureBucket(): Promise<void>` — called in `onModuleInit`
- Registered in `AppModule`

### New packages

- `@aws-sdk/client-s3` — MinIO S3-compatible client
- `multer` + `@types/multer` — multipart file upload middleware
  (`@nestjs/platform-express` already includes Multer — no extra install needed for the interceptor)

---

## US-017: Upload Supporting Documents for Product Registration

**Module:** product  
**Roles:** upload = cooperative-admin | view/download = cooperative-admin, inspector, certification-body, super-admin

### New Entity: `ProductDocument` (product.product_document)

| Column      | Type         | Notes                                                          |
| ----------- | ------------ | -------------------------------------------------------------- |
| id          | uuid PK      |                                                                |
| product_id  | uuid         | references product.product(id) — no FK (cross-schema safe)     |
| file_name   | varchar(255) | original filename                                              |
| mime_type   | varchar(100) | e.g. application/pdf, image/jpeg                               |
| s3_key      | varchar(500) | MinIO object key: `product-docs/{productId}/{uuid}-{filename}` |
| size_bytes  | int          | file size                                                      |
| uploaded_by | uuid         | Keycloak user UUID from JWT                                    |
| created_at  | timestamptz  |                                                                |

### New Service: `ProductDocumentService`

- `upload(productId, file, userId)` — verifies product exists, uploads to MinIO, saves record
- `findByProduct(productId)` — list all documents
- `download(docId)` — fetch record, stream from MinIO

### New Controller: `ProductDocumentController`

- `POST /products/:id/documents` — `@UseInterceptors(FileInterceptor('file'))`, max 10MB
- `GET /products/:id/documents` — list
- `GET /products/:id/documents/:docId/download` — StreamableFile proxy

### Migration: `1700000000011-AddProductDocument`

```sql
CREATE TABLE product.product_document (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  s3_key VARCHAR(500) NOT NULL,
  size_bytes INT NOT NULL,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_product_document_product_id ON product.product_document(product_id);
```

---

## US-026: Upload PDF Lab Report

**Module:** product  
**Roles:** upload = lab-technician | download = lab-technician, cooperative-admin, inspector, certification-body, super-admin

### Entity Change: `LabTest`

Add two nullable columns:

- `report_s3_key VARCHAR(500) NULL`
- `report_file_name VARCHAR(255) NULL`

### New Endpoints on `LabTestController`

- `POST /lab-tests/:id/report` — validates MIME type (`application/pdf` only), stores in MinIO, updates LabTest record
- `GET /lab-tests/:id/report` — returns 404 if no report uploaded, else StreamableFile

### Migration: `1700000000012-AddLabTestReportKey`

```sql
ALTER TABLE product.lab_test
  ADD COLUMN report_s3_key VARCHAR(500) NULL,
  ADD COLUMN report_file_name VARCHAR(255) NULL;
```

---

## US-030: Flag Accredited Labs

**Module:** product  
**Roles:** write = super-admin | read = super-admin, certification-body  
**Enforcement:** metadata only — no guard on `POST /lab-tests` in v1

### New Entity: `Lab` (product.lab)

| Column                     | Type         | Notes         |
| -------------------------- | ------------ | ------------- |
| id                         | uuid PK      |               |
| name                       | varchar(200) | lab full name |
| onssa_accreditation_number | varchar(50)  | nullable      |
| is_accredited              | boolean      | default false |
| accredited_at              | timestamptz  | nullable      |
| created_at                 | timestamptz  |               |
| updated_at                 | timestamptz  |               |

### New `LabService` + `LabController`

- `POST /labs` (super-admin)
- `GET /labs` (super-admin, certification-body) — paginated
- `GET /labs/:id` (super-admin, certification-body)
- `PUT /labs/:id/accredit` (super-admin) → isAccredited=true, accreditedAt=now()
- `PUT /labs/:id/revoke` (super-admin) → isAccredited=false, accreditedAt=null

No Kafka events — no consumers exist (YAGNI).

### Migration: `1700000000013-AddLab`

```sql
CREATE TABLE product.lab (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  onssa_accreditation_number VARCHAR(50) NULL,
  is_accredited BOOLEAN NOT NULL DEFAULT FALSE,
  accredited_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## US-068: PDF Export Certificate

**Module:** certification  
**Roles:** customs-agent, cooperative-admin, super-admin  
**Pattern:** mirrors `CertificationPdfService` + `GET /certifications/:id/certificate.pdf`

### New `ExportDocumentPdfService`

- Fetches `ExportDocument` by id
- Joins with `Certification` via `certificationId` — **intra-module join allowed** (same certification schema)
- PDFKit layout (single page, French primary):
  - Header: TERROIR.MA — CERTIFICAT D'EXPORTATION
  - Fields: cooperative name, destination country, HS code, quantity (kg), ONSSA reference, clearance date, certification number
  - Footer: QR reference + generation timestamp

### New Endpoint

`GET /export-documents/:id/certificate.pdf` → `StreamableFile`  
Response headers: `Content-Type: application/pdf`, `Content-Disposition: inline; filename="export-cert-{id}.pdf"`

No migration, no new entity.

---

## US-083: Cooperative Compliance Report

**Module:** certification  
**Roles:** super-admin, certification-body  
**Key finding:** `Certification.cooperativeName` already stored (denormalized) — confirmed in entity, no migration needed.

### New Method: `CertificationService.complianceReport()`

Raw SQL:

```sql
SELECT
  cooperative_id,
  cooperative_name,
  COUNT(*) AS total_requests,
  COUNT(*) FILTER (WHERE current_status IN ('SUBMITTED','DOCUMENT_REVIEW','INSPECTION_SCHEDULED',
    'INSPECTION_IN_PROGRESS','INSPECTION_COMPLETE','LAB_TESTING','LAB_RESULTS_RECEIVED','UNDER_REVIEW')) AS pending,
  COUNT(*) FILTER (WHERE current_status = 'GRANTED') AS granted,
  COUNT(*) FILTER (WHERE current_status = 'DENIED') AS denied,
  COUNT(*) FILTER (WHERE current_status = 'REVOKED') AS revoked,
  COUNT(*) FILTER (WHERE current_status = 'RENEWED') AS renewed
FROM certification.certification
WHERE deleted_at IS NULL
GROUP BY cooperative_id, cooperative_name
ORDER BY total_requests DESC
```

Returns: `CooperativeComplianceRow[]`

### New Endpoint

`GET /certifications/compliance-report`  
Optional query: `?from=YYYY-MM-DD&to=YYYY-MM-DD` (filters on requested_at)

---

## US-089: ONSSA Active Certifications Report

**Module:** certification  
**Roles:** super-admin, certification-body

### New Method: `CertificationService.onssaReport(from?, to?)`

Query: `WHERE current_status = 'GRANTED'` + optional `granted_at BETWEEN from AND to`  
Returns: certificationNumber, cooperativeName, productTypeCode, regionCode, certificationType, grantedAt, validFrom, validUntil

### New Endpoint

`GET /certifications/onssa-report`  
Optional query: `?from=YYYY-MM-DD&to=YYYY-MM-DD`  
Response: JSON array (no PDF — data only, caller formats for ONSSA submission)

---

## Route Ordering on CertificationController (Critical)

NestJS literal segments must be registered before parameterised segments.
Final order in `certification.controller.ts`:

1. `GET /certifications/stats` (existing)
2. `GET /certifications/export` (existing)
3. `GET /certifications/compliance-report` (new)
4. `GET /certifications/onssa-report` (new)
5. `GET /certifications/pending` (existing)
6. `GET /certifications/:id` (existing)
7. `GET /certifications/:id/certificate.pdf` (existing)

---

## Migrations (in order)

| #   | File                                | Change                                          |
| --- | ----------------------------------- | ----------------------------------------------- |
| 011 | `1700000000011-AddProductDocument`  | CREATE TABLE product.product_document           |
| 012 | `1700000000012-AddLabTestReportKey` | ALTER TABLE product.lab_test ADD report columns |
| 013 | `1700000000013-AddLab`              | CREATE TABLE product.lab                        |

---

## Test Plan

| File                                                          | Tests | Notes                                                         |
| ------------------------------------------------------------- | ----- | ------------------------------------------------------------- |
| `test/unit/common/minio.service.spec.ts`                      | 3     | Mock S3Client; upload, download, delete                       |
| `test/unit/product/product-document.service.spec.ts`          | 5     | Upload, list, download, 404 on missing product                |
| `test/unit/product/lab.service.spec.ts`                       | 4     | Create, list, accredit, revoke                                |
| `test/unit/product/lab-test.service.spec.ts`                  | +2    | Report upload, report download                                |
| `test/unit/certification/export-document-pdf.service.spec.ts` | 3     | PDFKit mocked; happy path, missing cert, missing export doc   |
| `test/unit/certification/certification.service.spec.ts`       | +4    | complianceReport (2), onssaReport with/without date range (2) |

**Total new tests: ~21**

---

## Known Patterns to Apply

- `em.create() + em.save()` for any entity with JSONB columns (not applicable here, but maintain habit)
- `useValue` (not `useFactory`) for all test mocks that need external control
- `MinioService` mock: `{ uploadFile: jest.fn(), getFileStream: jest.fn(), deleteFile: jest.fn() }`
- `FileInterceptor` in tests: pass `buffer` directly to service, bypass Multer in unit tests
- Literal routes before param routes — confirmed pattern, apply to ProductDocumentController too
