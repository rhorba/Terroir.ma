# Sprint 5 Design — List Endpoints, QR Download & Trilingual Verification

**Date:** 2026-04-10
**Sprint:** 5
**Capacity:** 23 SP
**Stories:** US-042, US-049, US-043, US-057, US-059, US-066, TM-1, TM-2, TM-3

---

## Scope

| Story     | Title                                        | Module        | SP     |
| --------- | -------------------------------------------- | ------------- | ------ |
| US-042    | Certification officer views pending requests | certification | 3      |
| US-049    | Cooperative admin views all certifications   | certification | 3      |
| US-043    | Inspector views scheduled inspections        | certification | 3      |
| US-057    | Download QR code image (PNG + SVG)           | certification | 3      |
| US-059    | QR verification page trilingual (AR/FR/ZGH)  | certification | 5      |
| US-066    | View export documentation status             | certification | 3      |
| TM-1      | Add `test:unit:cov` npm script               | infra         | 1      |
| TM-2      | Cover notification.service.ts error path     | notification  | 1      |
| TM-3      | Verify migration chain with live DB          | infra         | 1      |
| **Total** |                                              |               | **23** |

---

## Design Decisions

| #   | Decision            | Choice                                                   | Rationale                                                  |
| --- | ------------------- | -------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | List endpoint style | Role-scoped `/pending` + `/my`                           | Cleaner role semantics than generic query params           |
| 2   | Pagination          | Simple offset (`page`/`limit`/`total`), `createdAt DESC` | YAGNI — v1 volume is tens to hundreds of records           |
| 3   | QR download format  | Both PNG + SVG via `?format=png\|svg`, default `png`     | Covers both digital and large-format print use cases       |
| 4   | Trilingual strategy | `?lang=ar\|fr\|zgh` query param, `fr` default            | Practical for QR scan flows — URL-embeddable language      |
| 5   | Identity extraction | JWT custom claims (`cooperativeId`), `sub` for inspector | Zero DB round-trips, clean extraction via `@CurrentUser()` |

---

## Section 1: List Endpoints (US-042, US-049, US-043, US-066)

### Endpoints

```
GET /certifications/pending        role: certification-body
GET /certifications/my             role: cooperative-admin   (JWT: cooperativeId)
GET /inspections/my                role: inspector            (JWT: sub)
GET /export-documents/my           role: cooperative-admin   (JWT: cooperativeId)
```

### Pagination (all four endpoints)

- Query params: `?page=1&limit=20`
- Default: `page=1`, `limit=20`
- Sort: `createdAt DESC` — hardcoded, no sort controls
- Response `meta`: `{ page, limit, total }`

### US-042 — `GET /certifications/pending`

- Role guard: `certification-body`
- Filter: `status IN ('SUBMITTED', 'DOCUMENT_REVIEW', 'LAB_RESULTS_RECEIVED', 'UNDER_REVIEW')`
- Response fields per item: `id`, `certificationNumber`, `status`, `productType`, `submittedAt`, `cooperativeName`

### US-049 — `GET /certifications/my`

- Role guard: `cooperative-admin`
- Filter: `cooperativeId = user.cooperativeId` (JWT custom claim)
- Returns all statuses — full portfolio view
- Response fields per item: `id`, `certificationNumber`, `status`, `productType`, `issuedAt`, `expiresAt`

### US-043 — `GET /inspections/my`

- Role guard: `inspector`
- Filter: `assignedInspectorId = user.sub` (Keycloak `sub` stored on inspection entity)
- Returns inspections with status `INSPECTION_SCHEDULED` or `INSPECTION_IN_PROGRESS`
- Response fields per item: `id`, `certificationId`, `certificationNumber`, `scheduledDate`, `status`, `location`

### US-066 — `GET /export-documents/my`

- Role guard: `cooperative-admin`
- Filter: `cooperativeId = user.cooperativeId` (JWT custom claim)
- Returns all export documents for the cooperative (all statuses)
- Response fields per item: `id`, `certificationNumber`, `status`, `hsCode`, `destinationCountry`, `requestedAt`

### JWT Payload Extension

File: `src/common/interfaces/jwt-payload.interface.ts`

```ts
export interface JwtPayload {
  sub: string;
  roles: string[];
  cooperativeId?: string; // ADD: custom Keycloak claim for cooperative-admin
  // Inspector identity uses sub directly — no custom claim needed
}
```

> Keycloak config note: `cooperativeId` must be mapped as a custom token claim in the realm's
> token mapper for the `terroir-app` client. This is a configuration step, not a code task.

---

## Section 2: QR Code Download (US-057)

### Endpoint

```
GET /qr/:certificationId/download?format=png|svg
```

- Roles: `cooperative-admin`, `certification-body`
- Default: `format=png`
- Certification must exist and have status `GRANTED` or `RENEWED` — otherwise `404`
- Invalid `format` value → `400 BAD_REQUEST`

### PNG Response

```
Content-Type: image/png
Content-Disposition: attachment; filename="TERROIR-AOP-RSK-2026-0001.png"
<binary PNG buffer>
```

Implementation: `qrcode.toBuffer(signedUrl)` → `res.set(headers).send(buffer)`

### SVG Response

```
Content-Type: image/svg+xml
Content-Disposition: attachment; filename="TERROIR-AOP-RSK-2026-0001.svg"
<SVG XML string>
```

Implementation: `qrcode.toString(signedUrl, { type: 'svg' })` → `res.set(headers).send(svgString)`

### Notes

- The QR content URL is the same HMAC-signed verification URL already generated by `generateQrCode()`
- Filename uses `certificationNumber` from the entity
- No Redis involvement — download is not in the hot verification path
- No new Kafka events

### New service method

```ts
// qr-code.service.ts
async downloadQrCode(
  certificationId: string,
  format: 'png' | 'svg',
): Promise<{ buffer: Buffer | string; filename: string; mimeType: string }>
```

---

## Section 3: Trilingual QR Verification (US-059)

### Endpoint Change

```
GET /qr/verify/:signature?lang=ar|fr|zgh    (was: no ?lang param)
```

- Public endpoint — no auth required
- `lang` defaults to `fr` if absent or invalid
- All other behaviour (HMAC verification, Redis cache lookup, status checks) unchanged

### Translation Map

New file: `src/common/constants/i18n-verification.constants.ts`

```ts
export const VERIFICATION_I18N = {
  status: {
    GRANTED: { fr: 'Certifié', ar: 'معتمد', zgh: 'ⴰⵙⵉⴼⵍⵍ' },
    RENEWED: { fr: 'Renouvelé', ar: 'مجدد', zgh: 'ⴰⵙⵏⴼⵍⵉ' },
    REVOKED: { fr: 'Révoqué', ar: 'ملغى', zgh: 'ⴰⴽⴽⴰ' },
    DENIED: { fr: 'Refusé', ar: 'مرفوض', zgh: 'ⵓⵔ ⵉⵇⴱⵍ' },
    EXPIRED: { fr: 'Expiré', ar: 'منتهي الصلاحية', zgh: 'ⵉⵎⵎⵓⵜ' },
  },
  message: {
    valid: { fr: 'Produit certifié', ar: 'منتج معتمد', zgh: 'ⴰⵎⵣⵣⴰⵏ ⴰⵙⵉⴼⵍⵍ' },
    invalid: { fr: 'Certification invalide', ar: 'شهادة غير صالحة', zgh: 'ⴰⵙⵉⴼⵍⵍ ⵓⵔ ⵉⵍⵍⵉ' },
    revoked: { fr: 'Produit révoqué', ar: 'منتج ملغى', zgh: 'ⴰⵎⵣⵣⴰⵏ ⴰⴽⴽⴰ' },
    expired: { fr: 'Certificat expiré', ar: 'شهادة منتهية', zgh: 'ⴰⵙⵉⴼⵍⵍ ⵉⵎⵎⵓⵜ' },
  },
} as const;

export type SupportedLang = 'ar' | 'fr' | 'zgh';
export const DEFAULT_LANG: SupportedLang = 'fr';
export const RTL_LANGS: SupportedLang[] = ['ar'];
```

### Response Shape (extended)

```ts
{
  // existing fields (unchanged)
  certificationNumber: string,
  cooperativeName: string,
  productType: string,
  issuedAt: string,         // DD/MM/YYYY
  expiresAt: string | null, // DD/MM/YYYY

  // new i18n fields
  statusDisplay: string,    // translated status label
  message: string,          // translated verification message
  lang: 'ar' | 'fr' | 'zgh',
  rtl: boolean,             // true only for 'ar'
}
```

### Not translated (legal identifiers)

- `certificationNumber` — e.g. `TERROIR-AOP-RSK-2026-0001`
- `cooperativeName` — registered legal name
- Dates — already `DD/MM/YYYY` (Morocco format)

### Redis cache key unchanged

`qr:verify:{hmacSignature}` — the cached payload stores raw DB fields. Translation is applied
**after** cache retrieval, in the service layer. Cache TTL and eviction logic are unchanged.

---

## Section 4: Technical Maintenance

### TM-1 — `test:unit:cov` npm script

File: `package.json`

```json
"test:unit:cov": "jest --testPathPattern=spec --coverage --coverageReporters=text --coverageReporters=lcov"
```

Uses the existing `collectCoverageFrom` scope in `jest.config.ts`. No threshold changes.

### TM-2 — Notification error path (lines 92-93)

File: `test/unit/notification.service.spec.ts`

Add one test where the email/SMS adapter mock rejects:

```ts
it('marks notification as FAILED when send throws', async () => {
  mockEmailAdapter.send.mockRejectedValue(new Error('SMTP timeout'));
  await service.send(notificationId);
  expect(mockRepo.update).toHaveBeenCalledWith(notificationId, { status: 'FAILED' });
});
```

Expected branch coverage improvement: `notification` module 62.06% → ~90%+.

### TM-3 — Migration chain verification with live DB

Steps (requires Docker):

```bash
docker compose --profile core up -d postgres
npm run migration:run
npm run migration:generate -- --check   # must output: "No changes in database schema"
docker compose --profile core down
```

Pass/fail recorded in `progress.md`. No code changes expected. This is a verification task only.

---

## File Impact Summary

| File                                                                  | Change                                              |
| --------------------------------------------------------------------- | --------------------------------------------------- |
| `src/common/interfaces/jwt-payload.interface.ts`                      | Add `cooperativeId?: string`                        |
| `src/common/constants/i18n-verification.constants.ts`                 | **New** — translation map                           |
| `src/modules/certification/controllers/certification.controller.ts`   | Add `GET /pending`, `GET /my`                       |
| `src/modules/certification/services/certification.service.ts`         | Add `findPending()`, `findByCooperativeId()`        |
| `src/modules/certification/controllers/inspection.controller.ts`      | Add `GET /my`                                       |
| `src/modules/certification/services/inspection.service.ts`            | Add `findByInspectorId()`                           |
| `src/modules/certification/controllers/qr-code.controller.ts`         | Add `GET /:id/download`, update verify for `?lang=` |
| `src/modules/certification/services/qr-code.service.ts`               | Add `downloadQrCode()`, update `verifyQrCode()`     |
| `src/modules/certification/controllers/export-document.controller.ts` | Add `GET /my`                                       |
| `src/modules/certification/services/export-document.service.ts`       | Add `findByCooperativeId()`                         |
| `src/modules/notification/services/notification.service.ts`           | No change (test-only fix)                           |
| `test/unit/notification.service.spec.ts`                              | Add error path test                                 |
| `package.json`                                                        | Add `test:unit:cov` script                          |

---

## Architecture Notes

- No new Kafka events — all stories are read-only queries or binary responses
- No new entities — all data is already persisted in existing tables
- No cross-module service imports — all queries stay within `certification` and `notification`
- Redis cache untouched except: translation applied after cache hit (not cached per-lang)
- No i18n library dependency — static constant map is sufficient for v1
