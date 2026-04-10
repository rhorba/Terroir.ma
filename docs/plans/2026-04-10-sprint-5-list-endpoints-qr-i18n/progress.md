# Sprint 5 — List Endpoints, QR Download & Trilingual Verification

## Execution Progress

**Plan:** `docs/plans/2026-04-10-sprint-5-list-endpoints-qr-i18n/plan.md`
**Last updated:** 2026-04-10

---

## Status

| Task | Title                                                                                      | Status                                          |
| ---- | ------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| 1    | Add `PagedResult<T>` to `pagination.dto.ts`                                                | ✅ completed                                    |
| 2    | Create `i18n-verification.constants.ts`                                                    | ✅ completed                                    |
| 3    | Add `findPending()` + `findByCooperativePaginated()` to `certification.service.ts`         | ✅ completed                                    |
| 4    | Add `GET /certifications/pending` + `GET /certifications/my` to controller                 | ✅ completed                                    |
| 5    | Add `findByInspectorId()` to `inspection.service.ts`                                       | ✅ completed                                    |
| 6    | Add `GET /inspections/my` to `inspection.controller.ts`                                    | ✅ completed                                    |
| 7    | Add `findByCooperativePaginated()` to `export-document.service.ts` + `GET /my`             | ✅ completed                                    |
| 8    | Add `downloadQrCode()` to `qr-code.service.ts`                                             | ✅ completed                                    |
| 9    | Add `GET /qr-codes/:certificationId/download` to `qr-code.controller.ts`                   | ✅ completed                                    |
| 10   | Update `GET /verify/:uuid` with `?lang=` i18n transform                                    | ✅ completed                                    |
| 11   | Add `test:unit:cov` script to `package.json`                                               | ✅ completed                                    |
| 12   | TM-2: notification error path test                                                         | ✅ already done (pre-existing test at line 131) |
| 13   | TM-3: migration chain verification                                                         | ⏳ deferred — requires live PostgreSQL          |
| 14   | Tests: `findPending()` + `findByCooperativePaginated()` in `certification.service.spec.ts` | ✅ completed                                    |
| 15   | Tests: `findByInspectorId()` in `inspection.service.spec.ts`                               | ✅ completed                                    |
| 16   | Tests: `findByCooperativePaginated()` in `export-document.service.spec.ts`                 | ✅ completed                                    |
| 17   | Tests: `downloadQrCode()` in `qr-code.service.spec.ts`                                     | ✅ completed                                    |
| 18   | Tests: i18n constants in `test/unit/common/i18n-verification.spec.ts`                      | ✅ completed                                    |
| 19   | Final coverage verification                                                                | ✅ completed                                    |

---

## Final Coverage (2026-04-10)

```
All files  | % Stmts | % Branch | % Funcs | % Lines
-----------+---------+----------+---------+--------
All files  |   98.41 |    85.79 |   96.96 |   98.31
```

All thresholds met (target: ≥80% on all four metrics).

**23 unit test suites — 245 tests — 0 failures**
(Sprint 4 baseline: 22 suites, 210 tests)

---

## Batch Log

### Batch 1 (Tasks 1–3) — 2026-04-10

- ✅ Task 1: Added `PagedResult<T>` to `src/common/dto/pagination.dto.ts` (extended existing file, no new file)
- ✅ Task 2: Created `src/common/constants/i18n-verification.constants.ts` with translation maps, `isSupportedLang()`, `isRtlLang()`, `resolveMessageKey()`
- ✅ Task 3: Added `findPending()` + `findByCooperativePaginated()` to `certification.service.ts` using TypeORM `In` + `findAndCount`
- Verification: lint ✅ typecheck ✅ test ✅ (210/210)

### Batch 2 (Tasks 4–6) — 2026-04-10

- ✅ Task 4: Added `GET /certifications/pending` (cert-body) + `GET /certifications/my` (cooperative-admin) to `certification.controller.ts`
- ✅ Task 5: Added `findByInspectorId()` to `inspection.service.ts`
- ✅ Task 6: Added `GET /inspections/my` (inspector) to `inspection.controller.ts`
- Verification: lint ✅ typecheck ✅ test ✅ (210/210)

### Batch 3 (Tasks 7–8) — 2026-04-10

- ✅ Task 7: Added `findByCooperativePaginated()` to `export-document.service.ts` + `GET /export-documents/my` to `export-document.controller.ts`
- ✅ Task 8: Added `QrDownloadResult` interface + `downloadQrCode()` to `qr-code.service.ts` using `qrcode.toBuffer()` (PNG) and `qrcode.toString({type:'svg'})` (SVG)
- Verification: lint ✅ typecheck ✅ test ✅ (210/210)

### Batch 4 (Tasks 9–11) — 2026-04-10

- ✅ Task 9: Added `GET /qr-codes/:certificationId/download?format=png|svg` to `qr-code.controller.ts` using `StreamableFile` + `@Res({passthrough:true})`
- ✅ Task 10: Updated `GET /verify/:uuid` to accept `?lang=ar|fr|zgh`, applies i18n transform (controller-level, cache stays language-neutral)
- ✅ Task 11: Added `test:unit:cov` script to `package.json`
- Verification: lint ✅ typecheck ✅ test ✅ (210/210)

### Testing Tasks (Tasks 12–19) — 2026-04-10

- ✅ Task 12: TM-2 already covered (test at notification.service.spec.ts line 131)
- ⏳ Task 13: TM-3 deferred — run `docker compose --profile core up -d postgres && npm run migration:run && npm run migration:generate -- --check` when PostgreSQL available
- ✅ Task 14: Added `findPending()` (2 tests) + `findByCooperativePaginated()` (2 tests) to `certification.service.spec.ts`
- ✅ Task 15: Added `findByInspectorId()` (2 tests) to `inspection.service.spec.ts`
- ✅ Task 16: Added `findByCooperativePaginated()` (2 tests) to `export-document.service.spec.ts`
- ✅ Task 17: Added `downloadQrCode()` (6 tests: PNG, SVG, null certNum fallback, DENIED, null cert, no active QR) to `qr-code.service.spec.ts`
- ✅ Task 18: Created `test/unit/common/i18n-verification.spec.ts` (17 tests for constants + helper functions)
- ✅ Task 19: Final coverage — **98.41% statements | 85.79% branches | 96.96% functions | 98.31% lines**
- Verification: lint ✅ typecheck ✅ test ✅ (245/245)

---

## Architecture Decisions Made During Execution

- **i18n is a controller-level transform** — `verifyQrCode()` service signature unchanged; controller applies `resolveMessageKey()` + translation lookups after getting the raw result. Cache stores language-neutral result.
- **`PagedResult<T>` added to existing `pagination.dto.ts`** — avoids naming collision with `PaginatedResult<T>` in `pagination.interface.ts` (different shape)
- **`cooperative_id` claim already in `CurrentUserPayload`** — no interface change needed; used as `user.cooperative_id ?? user.sub` fallback
- **TM-2 pre-existing** — `notification.service.spec.ts` line 131 already covers the error path

---

## TM-3 Resume Instructions

When PostgreSQL is available:

```bash
docker compose --profile core up -d postgres
npm run migration:run
npm run migration:generate -- --check   # expect: "No changes in database schema were found"
docker compose --profile core down
```
