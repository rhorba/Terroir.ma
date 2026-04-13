# Sprint 9 Log — MinIO File Storage, Lab Registry, Document Uploads, Export PDF, Compliance Reports

**Sprint:** 9
**Dates:** 2026-04-13 → 2026-04-13
**Status:** CLOSED ✅
**Velocity:** 22/22 SP (100%)

---

## Goal

Deliver file storage infrastructure (MinIO), lab accreditation registry, product document uploads, lab report uploads, PDF export certificate generation, and regulatory compliance reports — closing the remaining document and reporting gaps.

---

## Stories Delivered

| ID | Story | SP | Result |
|---|---|---|---|
| US-017 | Upload supporting documents for product registration | 3 | ✅ Done — ProductDocument entity, MinIO upload/download, POST/GET /products/:id/documents |
| US-026 | Upload PDF lab report alongside structured results | 3 | ✅ Done — reportS3Key/reportFileName columns on LabTest, POST/GET /lab-tests/:id/report |
| US-030 | Lab accreditation registry | 3 | ✅ Done — Lab entity, CRUD + accredit/revoke endpoints, YAGNI (no enforcement on lab-test creation) |
| US-068 | Generate PDF export certificate | 5 | ✅ Done — ExportDocumentPdfService (PDFKit), GET /export-documents/:id/certificate.pdf |
| US-083 | Cooperative compliance report | 5 | ✅ Done — complianceReport() raw SQL, GET /certifications/compliance-report (super-admin, certification-body) |
| US-089 | Active certifications report for ONSSA | 3 | ✅ Done — onssaReport() raw SQL GRANTED filter, GET /certifications/onssa-report |

**Total: 22 SP**

---

## Infrastructure Delivered

| Component | Details |
|---|---|
| MinIO Docker service | Ports 9000 (API) / 9001 (console), volume `terroir_minio_data`, profile `core, full` |
| MinioService | S3Client wrapper, `forcePathStyle: true`, `onModuleInit` bucket auto-create, upload/stream/delete |
| `@aws-sdk/client-s3` | Installed v3 |
| `@types/multer` | Installed — required for `Express.Multer.File` typing |
| New migrations | 011 (AddProductDocument), 012 (AddLabTestReportKey), 013 (AddLab) |

---

## New Endpoints (8 total)

| Method | Path | Auth | Story |
|---|---|---|---|
| POST | /products/:id/documents | cooperative-admin, cooperative-member, inspector | US-017 |
| GET | /products/:id/documents | cooperative-admin, cooperative-member, inspector, certification-body, super-admin | US-017 |
| GET | /products/:id/documents/:docId/download | cooperative-admin, cooperative-member, inspector, certification-body, super-admin | US-017 |
| POST | /lab-tests/:id/report | lab-technician | US-026 |
| GET | /lab-tests/:id/report | lab-technician, cooperative-admin, inspector, certification-body, super-admin | US-026 |
| GET | /export-documents/:id/certificate.pdf | customs-agent, cooperative-admin, super-admin | US-068 |
| GET | /certifications/compliance-report | super-admin, certification-body | US-083 |
| GET | /certifications/onssa-report | super-admin, certification-body | US-089 |
| POST | /labs | super-admin | US-030 |
| GET | /labs | super-admin, certification-body | US-030 |
| GET | /labs/:id | super-admin, certification-body | US-030 |
| POST | /labs/:id/accredit | super-admin | US-030 |
| POST | /labs/:id/revoke | super-admin | US-030 |

---

## Test Results

| Metric | Sprint 8 | Sprint 9 | Delta |
|---|---|---|---|
| Suites | 29 | **33** | +4 |
| Tests | 312 | **342** | +30 |
| Failures | 0 | **0** | — |
| lint | ✅ | ✅ | — |
| typecheck | ✅ | ✅ | — |

### New Test Files

| File | Tests | Coverage |
|---|---|---|
| `test/unit/common/minio.service.spec.ts` | 3 | uploadFile, getFileStream, defined |
| `test/unit/product/lab.service.spec.ts` | 6 | create, findById ×2, accredit ×2, revoke |
| `test/unit/product/product-document.service.spec.ts` | 5 | upload ×2, findByProduct ×2, download ×2 |
| `test/unit/certification/export-document-pdf.service.spec.ts` | 3 | Buffer output, NotFoundException, null cert |

### Extended Test Files

| File | Tests Added | Notes |
|---|---|---|
| `test/unit/product/lab-test.service.spec.ts` | +4 | uploadReport ×2, downloadReport ×2; +MinioService mock |
| `test/unit/certification/certification.service.spec.ts` | +4 | complianceReport ×2, onssaReport ×2 |

---

## Key Decisions

1. **MinIO `forcePathStyle: true`**: Required for Docker/localhost — virtual-hosted style fails without a real domain
2. **MinIO dual registration**: `MinioService` in both `AppModule` and `ProductModule` — NestJS scoping requires it where injected
3. **PostgreSQL COUNT → Number()**: Raw SQL aggregates return strings — explicit cast required in complianceReport()
4. **Intra-module JOIN safe**: ExportDocumentPdfService joins ExportDocument + Certification (same `certification` schema, not cross-module)
5. **YAGNI Lab enforcement**: Lab registry is metadata-only in v1 — no `labId` FK on LabTest; enforcement deferred to Phase 2
6. **`@types/multer` explicit install**: Not a transitive dependency — must install when using `Express.Multer.File`

---

## Bugs Fixed

| Bug | Root Cause | Fix |
|---|---|---|
| 26 lab-test.service.spec.ts failures | `MinioService` added to `LabTestService` constructor but not in test module | Added `makeMinio()` mock + `MinioService` provider to test module |
| TS7016 multer type error | `@types/multer` not installed | `npm install --save-dev @types/multer` |
| TS2532 array access in spec | TypeScript strict mode flagged `result[0]` as possibly undefined | Changed to `result[0]!` non-null assertion |

---

## Pending Before Sprint 10

- [ ] Place font assets: `assets/fonts/Amiri-Regular.ttf` + `assets/fonts/DejaVuSans.ttf`
- [ ] Run migrations: `npm run migration:run` (after `docker compose up`) — migrations 009–013 pending
- [ ] US-058: Track QR scan events (4th deferral — low priority)

---

## Backlog State After Sprint 9

- Stories Done: **77 / 90**
- Remaining: **13 stories**
- Cumulative velocity: 8 sprints × avg 22 SP
