# Sprint 6 Design — PDF Certificate, Stats, Export View & Notification Templates

**Date:** 2026-04-12
**Sprint:** 6
**Capacity:** 22 SP
**Stories:** TM-3, US-067, US-047, US-048, US-075

---

## Section 1: Scope & Decisions

| Story     | Title                                                       | Module        | SP     |
| --------- | ----------------------------------------------------------- | ------------- | ------ |
| TM-3      | Migration chain verification (carry-over)                   | infra         | 1      |
| US-067    | Super-admin views all export clearances                     | certification | 3      |
| US-047    | Generate PDF certificate (PDFKit, trilingual)               | certification | 5      |
| US-048    | Certification statistics (minimal dims, Redis 5min)         | certification | 5      |
| US-075    | Manage notification templates (DB override + file fallback) | notification  | 8      |
| **Total** |                                                             |               | **22** |

| #   | Decision            | Choice                                                  | Rationale                                            |
| --- | ------------------- | ------------------------------------------------------- | ---------------------------------------------------- |
| 1   | PDF library         | PDFKit                                                  | Zero Docker changes, pure Node.js, supports RTL text |
| 2   | PDF language layout | Single multilingual page (AR+FR+ZGH)                    | Official Moroccan documents carry all designations   |
| 3   | Stats dimensions    | Status + region code + product type + date range filter | YAGNI — MAPMDREF needs counts, not trends in v1      |
| 4   | Stats compute       | Raw SQL via `query()` + Redis 5-min cache               | No new entities, acceptable staleness for reporting  |
| 5   | Template storage    | DB override, file fallback on missing DB record         | Safe default always exists; rollback = DELETE record |
| 6   | Template cache      | Redis invalidate on PUT/DELETE                          | Avoids DB hit on every notification send             |

---

## Section 2: API Contracts

### US-067 — Export clearances (super-admin)

```
GET /export-documents?page=1&limit=20
Role: super-admin
```

Same `PagedResult<T>` shape as Sprint 5 `/my` endpoints. Super-admin sees all records across all cooperatives. Sort: `requestedAt DESC`.

---

### US-047 — PDF certificate

```
GET /certifications/:id/certificate.pdf
Role: cooperative-admin (own certs only), certification-body, super-admin
Guard: certification must have status GRANTED or RENEWED — else 404
```

Response:

```
Content-Type: application/pdf
Content-Disposition: attachment; filename="TERROIR-AOP-RSK-2026-0001.pdf"
<binary PDF buffer via StreamableFile>
```

PDF page layout (top → bottom):

```
[TERROIR.MA title bar]
──────────────────────────────────────────
CERTIFICAT DE CONFORMITÉ  (FR — primary)
شهادة المطابقة            (AR — RTL block)
ⴰⵙⵉⴼⵍⵍ ⵏ ⵓⵎⴷⵢⴰⵣ         (ZGH — Tifinagh block)
──────────────────────────────────────────
Numéro / رقم الشهادة:   TERROIR-AOP-RSK-2026-0001
Coopérative / التعاونية: <cooperativeName>
Produit / المنتج:        <productTypeCode>
Type SDOQ:               <certificationType>
Région / الجهة:          <regionCode>
Valide du / صالح من:     DD/MM/YYYY → DD/MM/YYYY
──────────────────────────────────────────
[QR code image — 80×80px, centered]
<HMAC-signed verification URL below QR>
──────────────────────────────────────────
Délivré le / تاريخ الإصدار: DD/MM/YYYY
```

Font assets (bundled in `assets/fonts/`):

- `Amiri-Regular.ttf` — Arabic (OFL licensed)
- `DejaVuSans.ttf` — Latin + Tifinagh fallback

New service file:

```ts
// src/modules/certification/services/certification-pdf.service.ts
async generateCertificatePdf(certificationId: string): Promise<Buffer>
```

No Redis cache, no Kafka event. Generated fresh on each request.

---

### US-048 — Certification statistics

```
GET /certifications/stats?from=YYYY-MM-DD&to=YYYY-MM-DD
Role: super-admin
```

Response shape:

```ts
{
  success: true,
  data: {
    period: { from: string | null, to: string | null },
    byStatus: { status: string; count: number }[],
    byRegion: { regionCode: string; count: number }[],
    byProductType: { productTypeCode: string; count: number }[]
  }
}
```

Raw SQL (3 queries, optional WHERE `requested_at BETWEEN $1 AND $2`).

Redis cache key: `stats:certifications:{from|all}:{to|all}`, TTL 300s.
Cache not invalidated on writes (5-min staleness acceptable for reporting).

New service method:

```ts
// certification.service.ts
async getStats(from?: string, to?: string): Promise<CertificationStats>
```

> **Controller ordering note:** `GET /certifications/stats` must be registered **before**
> `GET /certifications/:id` to prevent NestJS treating `stats` as a UUID param.

---

### US-075 — Notification template management

```
GET    /notification-templates?code=&channel=&language=   (super-admin)
GET    /notification-templates/:id                         (super-admin)
POST   /notification-templates                             (super-admin)
PUT    /notification-templates/:id                         (super-admin)
DELETE /notification-templates/:id                         (super-admin — sets isActive=false)
POST   /notification-templates/seed                        (super-admin — load .hbs files into DB)
```

**File fallback logic** in `notification.service.ts` `send()`:

```
1. Check Redis: GET template:{code}:{channel}:{language}
2. On Redis miss → query DB: templateRepo.findOne({ code, channel, language, isActive: true })
   → on DB hit: SET template:{code}:{channel}:{language} TTL 600s
3. On DB miss → read from assets/templates/{code}.{channel}.{language}.hbs
4. On file miss → log warn, skip (existing behaviour)
```

Redis invalidation: on `PUT /:id` and `DELETE /:id`, DEL `template:{code}:{channel}:{language}`.

**No TypeORM migration needed** — `NotificationTemplate` entity columns are already defined and the table is covered by the existing migration.

---

## Section 3: Architecture Notes & File Map

### Architecture Notes

- **No new Kafka events** — all 5 stories are read-only queries or file generation
- **No new entities** — `NotificationTemplate` already scaffolded; stats use raw SQL on `Certification`
- **No cross-module imports** — `CertificationPdfService` lives in the certification module; notification template CRUD stays entirely in the notification module
- **One new service file** — `certification-pdf.service.ts` isolates PDFKit logic from `certification.service.ts`
- **Font assets** — referenced by absolute path: `path.join(process.cwd(), 'assets/fonts/Amiri-Regular.ttf')`
- **`pdfkit` package** — add `pdfkit` + `@types/pdfkit`
- **Stats route ordering** — register `GET /certifications/stats` before `GET /certifications/:id`

### File Map

| File                                                                       | Action                                          | Story          |
| -------------------------------------------------------------------------- | ----------------------------------------------- | -------------- |
| `assets/fonts/Amiri-Regular.ttf`                                           | New — Arabic font                               | US-047         |
| `assets/fonts/DejaVuSans.ttf`                                              | New — Latin/Tifinagh font                       | US-047         |
| `src/modules/certification/services/certification-pdf.service.ts`          | New — PDFKit generation                         | US-047         |
| `src/modules/certification/controllers/certification.controller.ts`        | Add `GET /stats`, `GET /:id/certificate.pdf`    | US-047, US-048 |
| `src/modules/certification/services/certification.service.ts`              | Add `getStats()`                                | US-048         |
| `src/modules/certification/controllers/export-document.controller.ts`      | Add `GET /` (super-admin)                       | US-067         |
| `src/modules/certification/services/export-document.service.ts`            | Add `findAll()`                                 | US-067         |
| `src/modules/certification/certification.module.ts`                        | Register `CertificationPdfService`              | US-047         |
| `src/modules/notification/controllers/notification-template.controller.ts` | New — CRUD + seed                               | US-075         |
| `src/modules/notification/services/notification-template.service.ts`       | New — CRUD + Redis + fallback                   | US-075         |
| `src/modules/notification/dto/create-notification-template.dto.ts`         | New                                             | US-075         |
| `src/modules/notification/dto/update-notification-template.dto.ts`         | New                                             | US-075         |
| `src/modules/notification/services/notification.service.ts`                | Update `send()` — Redis + file fallback         | US-075         |
| `src/modules/notification/notification.module.ts`                          | Register new service + controller, inject Redis | US-075         |
| `test/unit/certification/certification-pdf.service.spec.ts`                | New — PDFKit mock tests                         | US-047         |
| `test/unit/certification/certification.service.spec.ts`                    | Add `getStats()` tests                          | US-048         |
| `test/unit/certification/export-document.service.spec.ts`                  | Add `findAll()` tests                           | US-067         |
| `test/unit/notification/notification-template.service.spec.ts`             | New — CRUD + fallback tests                     | US-075         |
| `test/unit/notification/notification.service.spec.ts`                      | Update `send()` — Redis + fallback tests        | US-075         |
| `package.json`                                                             | Add `pdfkit`, `@types/pdfkit`                   | US-047         |

### Batch Plan Preview

| Batch | Stories               | Tasks                                                                |
| ----- | --------------------- | -------------------------------------------------------------------- |
| 1     | TM-3 + US-067         | Migration verification; `findAll()` + `GET /export-documents`        |
| 2     | US-048                | `getStats()` raw SQL + Redis cache + `GET /certifications/stats`     |
| 3     | US-047                | Font assets + `CertificationPdfService` + `GET /:id/certificate.pdf` |
| 4     | US-075                | `NotificationTemplateService` CRUD + Redis + fallback + controller   |
| 5     | Tests (certification) | PDF service + stats + export-document specs                          |
| 6     | Tests (notification)  | Template service + updated `send()` specs                            |
