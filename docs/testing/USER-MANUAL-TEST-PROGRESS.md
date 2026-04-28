# User Manual Test Scenarios — Progress Tracker

**Document:** `docs/pitch/USER-MANUAL-TEST-SCENARIOS.md`
**Started:** 2026-04-28
**Goal:** Full E2E coverage for all 12 scenarios + HTTP collection for manual testing

---

## Coverage Status

| Scenario                        | Role        | E2E File                                              | Status     | Notes                                                            |
| ------------------------------- | ----------- | ----------------------------------------------------- | ---------- | ---------------------------------------------------------------- |
| S1 — Super-Admin setup          | Khalid      | `test/e2e/scenario-1-super-admin.e2e.ts`              | ✅ Passing | Dashboard, audit-logs, DLQ, campaign settings, lab accreditation |
| S2 — Cooperative-Admin setup    | Fatima      | `test/e2e/scenario-2-cooperative-admin.e2e.ts`        | ✅ Passing | Members, farms, update profile, notification prefs               |
| S3 — Cooperative-Member harvest | Hassan      | `test/e2e/scenario-3-cooperative-member.e2e.ts`       | ✅ Passing | Harvest + batch + processing steps                               |
| S4 — Lab Technician results     | Dr. Amina   | `test/e2e/scenario-4-lab-technician.e2e.ts`           | ✅ Passing | Submit test, record results, upload report                       |
| S5 — Inspector report           | Youssef     | `test/e2e/scenario-5-inspector.e2e.ts`                | ✅ Passing | View assignments, file report, immutability                      |
| S6 — Certification Body         | Omar        | `test/e2e/certification/certification-chain.e2e.ts`   | ✅ Passing | Full chain steps 1–12                                            |
| S7 — Customs Agent export       | Leila       | `test/e2e/scenario-7-customs-agent.e2e.ts`            | ✅ Passing | Export docs, validate clearance, CSV report                      |
| S8 — Consumer QR i18n           | Yuki        | `test/e2e/scenario-8-qr-i18n.e2e.ts`                  | ✅ Passing | ar/zgh responses, revoked QR                                     |
| S9 — End-to-End chain           | All         | `test/e2e/certification/certification-chain.e2e.ts`   | ✅ Passing | 12-step chain                                                    |
| S10 — Notification management   | Khalid      | `test/e2e/scenario-10-notification-management.e2e.ts` | ✅ Passing | Templates CRUD, stats, seed                                      |
| S11 — Admin reports & exports   | Khalid/Omar | `test/e2e/scenario-11-admin-reports.e2e.ts`           | ✅ Passing | Stats, analytics, compliance, ONSSA, CSV                         |
| S12 — Health & monitoring       | —           | `test/e2e/scenario-12-health-monitoring.e2e.ts`       | ✅ Passing | /health, /ready, /metrics                                        |

**HTTP Collection:** `test/http/terroir-scenarios.http` — all 12 scenarios for VS Code REST Client / IntelliJ HTTP Client

---

## Test Run Log

| Date       | Command             | Result                        | Bugs Fixed         |
| ---------- | ------------------- | ----------------------------- | ------------------ |
| 2026-04-28 | `npm run test:unit` | ✅ 436/436 passed (45 suites) | —                  |
| 2026-04-28 | `npm run test:e2e`  | ✅ 174/174 passed (18 suites) | 3 bugs (see below) |

---

## Known Bugs / Fixes

| #   | File                                              | Bug                                                                                                                                | Fix                                                                                        |
| --- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1   | `src/modules/product/services/product.service.ts` | `exportProductRegistry` referenced `p.regionCode` and `p.status` — columns not on `Product` entity → 500 on `GET /products/export` | Joined `ProductType` via `leftJoin` for `regionCode`; removed non-existent `status` column |
| 2   | `test/e2e/smoke/cooperative-onboarding.e2e.ts`    | No `beforeAll` cleanup — ICE `001234567000099` persisted across runs; on next run `CREATE` returned 409, cascading to 404 on `GET` | Added `DELETE` in `beforeAll` and `afterAll`                                               |
| 3   | `test/e2e/scenario-2-cooperative-admin.e2e.ts`    | No `beforeAll` cleanup — member with CIN `J123456` persisted when `afterAll` was force-killed by `--forceExit`                     | Added cleanup of `farm`, `member`, `cooperative` rows in `beforeAll` before seeding        |
