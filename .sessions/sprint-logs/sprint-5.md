# Sprint 5 Log — List Endpoints, QR Download & Trilingual Verification

**Sprint:** 5
**Dates:** 2026-04-10 → 2026-04-10 (single-session sprint)
**Goal:** Role-scoped list endpoints, QR PNG+SVG download, trilingual QR verification, test:unit:cov script
**Status:** CLOSED
**Velocity:** 22/23 SP (96%) — TM-3 deferred

---

## Stories Delivered

| Story | Title | SP | Status |
|-------|-------|----|--------|
| US-042 | Certification officer views pending requests | 3 | ✅ Done |
| US-049 | Cooperative admin views all certifications | 3 | ✅ Done |
| US-043 | Inspector views scheduled inspections | 3 | ✅ Done |
| US-057 | Download QR code image (PNG + SVG) | 3 | ✅ Done |
| US-059 | QR verification page trilingual (AR/FR/ZGH) | 5 | ✅ Done |
| US-066 | View export documentation status | 3 | ✅ Done |
| TM-1 | Add `test:unit:cov` npm script | 1 | ✅ Done |
| TM-2 | Cover notification.service.ts error path | 1 | ✅ Pre-existing |
| TM-3 | Verify migration chain with live DB | 1 | ⏳ Deferred |

**Total delivered:** 22 SP / 23 planned

---

## New Endpoints

| Method + Path | Story | Role |
|---------------|-------|------|
| `GET /certifications/pending?page=&limit=` | US-042 | certification-body, super-admin |
| `GET /certifications/my?page=&limit=` | US-049 | cooperative-admin |
| `GET /inspections/my?page=&limit=` | US-043 | inspector |
| `GET /export-documents/my?page=&limit=` | US-066 | cooperative-admin |
| `GET /qr-codes/:id/download?format=png\|svg` | US-057 | cooperative-admin, certification-body |
| `GET /verify/:uuid?lang=ar\|fr\|zgh` | US-059 | public |

---

## New Files

| File | Purpose |
|------|---------|
| `src/common/constants/i18n-verification.constants.ts` | Translation maps + helper functions (isSupportedLang, isRtlLang, resolveMessageKey) |
| `test/unit/common/i18n-verification.spec.ts` | 21 tests for i18n constants |

---

## Modified Files

| File | Change |
|------|--------|
| `src/common/dto/pagination.dto.ts` | Added `PagedResult<T>` interface |
| `src/modules/certification/services/certification.service.ts` | Added `findPending()`, `findByCooperativePaginated()` |
| `src/modules/certification/services/inspection.service.ts` | Added `findByInspectorId()` |
| `src/modules/certification/services/export-document.service.ts` | Added `findByCooperativePaginated()` |
| `src/modules/certification/services/qr-code.service.ts` | Added `QrDownloadResult`, `downloadQrCode()` |
| `src/modules/certification/controllers/certification.controller.ts` | Added `GET /pending`, `GET /my` |
| `src/modules/certification/controllers/inspection.controller.ts` | Added `GET /my` |
| `src/modules/certification/controllers/export-document.controller.ts` | Added `GET /my` |
| `src/modules/certification/controllers/qr-code.controller.ts` | Added `GET /download`, updated `GET /verify/:uuid` |
| `test/unit/certification/certification.service.spec.ts` | +`findAndCount` mock, +4 tests |
| `test/unit/certification/inspection.service.spec.ts` | +`findAndCount` mock, +2 tests |
| `test/unit/certification/export-document.service.spec.ts` | +`findAndCount` mock, +2 tests |
| `test/unit/certification/qr-code.service.spec.ts` | +6 tests for `downloadQrCode` |
| `package.json` | Added `test:unit:cov` script |

---

## Test Coverage Delta

| Metric | Sprint 4 | Sprint 5 | Delta |
|--------|----------|----------|-------|
| Suites | 22 | 23 | +1 |
| Tests | 210 | 245 | +35 |
| Statements | 98.35% | 98.41% | +0.06% |
| Branches | 85.09% | 85.79% | +0.70% |
| Functions | 96.80% | 96.96% | +0.16% |
| Lines | 98.25% | 98.31% | +0.06% |

---

## Key Decisions

1. **i18n as controller-level transform** — `verifyQrCode()` service signature unchanged; cache stays language-neutral; `resolveMessageKey()` is a pure function in the constants module
2. **`PagedResult<T>`** added to `pagination.dto.ts` alongside existing `PaginatedResult<T>` in `pagination.interface.ts` to avoid naming collision
3. **`cooperative_id` JWT claim** already in `CurrentUserPayload` (snake_case, Keycloak convention) — no interface change needed
4. **`user.cooperative_id ?? user.sub`** fallback in `/my` endpoints for development safety when claim is absent
5. **`StreamableFile` + `@Res({passthrough:true})`** for QR binary download — NestJS idiomatic, avoids raw `res.send()`
6. **TM-2 pre-existing** — notification error path was already tested in the Sprint 4 baseline

---

## Deferred / Carry-forward to Sprint 6

- **TM-3** (1 SP): migration chain verification — run when PostgreSQL available:
  ```bash
  docker compose --profile core up -d postgres
  npm run migration:run
  npm run migration:generate -- --check
  docker compose --profile core down
  ```
- **Backlog update**: mark US-042, US-043, US-049, US-057, US-059, US-066 as Done in `PRODUCT-BACKLOG.md`

---

## Sprint 6 Candidates

| Story | Title | SP | Priority |
|-------|-------|----|----------|
| TM-3 | Migration chain verification (carry-over) | 1 | High |
| US-047 | Generate PDF certificate (certification-body) | 5 | Medium |
| US-048 | Certification statistics by region/product | 5 | Medium |
| US-058 | Track QR scan events (append-only log) | 5 | Low |
| US-067 | Super-admin views all export clearances | 3 | Medium |
| US-075 | Manage notification templates (super-admin) | 8 | Medium |

**Recommended Sprint 6 capacity:** 21–25 SP (rolling average: 23 SP)
