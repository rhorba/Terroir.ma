# Sprint 4 Production Readiness — Execution Progress

**Plan:** `docs/plans/2026-04-10-sprint-4-production-readiness/plan.md`  
**Last updated:** 2026-04-10

---

## Status

| Task | Title                                                                      | Status       |
| ---- | -------------------------------------------------------------------------- | ------------ |
| 1    | Narrow `collectCoverageFrom` to service + listener files                   | ✅ completed |
| 2    | Wire Redis QR cache in `certification.module.ts`                           | ✅ completed |
| 3    | Add cache read/write to `verifyQrCode()`                                   | ✅ completed |
| 4    | Add `evictQrCache()` and cache eviction to `deactivateByCertificationId()` | ✅ completed |
| 5    | Call `evictQrCache()` from `renewCertification()`                          | ✅ completed |
| 6    | Verify migration chain (code review — live DB requires PostgreSQL)         | ✅ completed |
| 7    | Write unit tests — `certification.listener.spec.ts`                        | ✅ completed |
| 8    | Write unit tests — `inspection.service.spec.ts`                            | ✅ completed |
| 9    | Write unit tests — `export-document.service.spec.ts`                       | ✅ completed |
| 10   | Write unit tests — `batch.service.spec.ts`                                 | ✅ completed |
| 11   | Write unit tests — `cooperative.listener.spec.ts`                          | ✅ completed |
| 12   | Write unit tests — `notification.listener.spec.ts`                         | ✅ completed |
| 13   | Write unit tests — `product.listener.spec.ts`                              | ✅ completed |
| 14   | Augment `qr-code.service.spec.ts` with cache + `generateQrCode()` tests    | ✅ completed |
| 15   | Run final coverage check — ≥80% all metrics                                | ✅ completed |

---

## Final Coverage (2026-04-10)

```
All files  | % Stmts | % Branch | % Funcs | % Lines
-----------+---------+----------+---------+--------
All files  |   98.35 |    85.09 |    96.80 |  98.25
```

All thresholds met (target: ≥80% on all four metrics).

**22 unit test suites — 210 tests — 0 failures**

---

## Batch Log

### Batch 1 (Tasks 1–3) — 2026-04-10

- ✅ Task 1: Narrowed `collectCoverageFrom` to `src/modules/**/*.service.ts` + `src/modules/**/*.listener.ts`
- ✅ Task 2: Replaced `CacheModule.register()` with `CacheModule.registerAsync()` using `redisStore`
- ✅ Task 3: Added cache read/write in `verifyQrCode()` for GRANTED and RENEWED results
- Verification: lint ✅ typecheck ✅ test ✅

### Batch 2 (Tasks 4–6) — 2026-04-10

- ✅ Task 4: `deactivateByCertificationId()` now evicts cache before `update()`; added `evictQrCache()`
- ✅ Task 5: `renewCertification()` calls `evictQrCache()` after `applyTransition`
- ✅ Task 6: Migration chain verified by code review — migration 005 handles `status → current_status` rename; `synchronize: false` already set
- Verification: lint ✅ typecheck ✅ test ✅

### Batch 3 (Tasks 7–9) — 2026-04-10

- ✅ Task 7: `certification.listener.spec.ts` — 8 tests, all 4 handlers covered
- ✅ Task 8: `inspection.service.spec.ts` — 8 tests covering all methods
- ✅ Task 9: `export-document.service.spec.ts` — 100% coverage, all 6 methods
- Verification: lint ✅ typecheck ✅ test ✅

### Batch 4 (Tasks 10–12) — 2026-04-10

- ✅ Task 10: `batch.service.spec.ts` — 100% coverage
- ✅ Task 11: `cooperative.listener.spec.ts` — happy + error paths
- ✅ Task 12: `notification.listener.spec.ts` — all 3 handlers
- Verification: lint ✅ typecheck ✅ test ✅

### Batch 5 (Tasks 13–15) — 2026-04-10

- ✅ Task 13: `product.listener.spec.ts` — pass/fail/error paths
- ✅ Task 14: `qr-code.service.spec.ts` — added `generateQrCode()` (success + NotFoundException), expired QR, cert-not-found, cache behaviors; `lab-test.service.spec.ts` full rewrite (100% branches); `certification.service.spec.ts` expanded with all state machine transitions
- ✅ Task 15: Final coverage run — **98.35% statements | 85.09% branches | 96.80% functions | 98.25% lines** ✅
- Verification: 22 suites ✅ 210 tests ✅ 0 failures ✅

---

## Notes

- Integration and E2E tests fail in this environment (no PostgreSQL running) — expected
- Migration drift check (`npm run migration:generate -- --check`) requires live PostgreSQL
- `product.service.ts` lines 23-33 remain at 77.77% branches (feature flag path) — acceptable as overall branches pass
- `notification.service.ts` lines 92-93 (error update path) could be improved but global is above threshold
