# Sprint 3 Retrospective — 2026-04-10

## Metrics

| Metric | Value |
|--------|-------|
| Committed | 21 SP |
| Completed | 21 SP |
| Velocity % | 100% |
| Duration | 2026-04-10 (1 day) |
| Unit tests | 87 passing (was 76, +11) |
| Integration tests | 13 passing (was 11, +2) |
| E2E tests | 23 passing (was 16, +7) |
| TypeScript errors | 0 |
| Lint errors | 0 |

---

## What Went Well

- **`applyTransition()` pattern paid off** — refactoring grant/deny/revoke was mechanical; the pattern established in Sprint 2 meant zero design work, just swap 3 methods
- **Audit ledger now 100% complete** — every one of the 12 transitions goes through `applyTransition`; Law 25-06 compliance achieved
- **`RENEWED` status design was clean** — QR stays active, consumers get "superseded" + new cert number; no broken links, no QR deactivation complexity
- **Guard tightening caught a Sprint 2 bug** — design review for Sprint 3 revealed the `LAB_RESULTS_RECEIVED | UNDER_REVIEW` shortcut; fixed with zero regressions
- **QR test rewrite was an improvement** — old `qr-code.service.spec.ts` barely tested anything; new version with 5 cases covers GRANTED, RENEWED, REVOKED, not-found, and pending-successor
- **Local event barrel pattern consistent** — `certification-events.ts` re-export barrel keeps producer imports clean

---

## What Didn't Go Well

- **Local barrel not documented** — `src/modules/certification/events/certification-events.ts` is a re-export barrel for the producer; not obvious from the module structure. New types must be added in both `src/common/interfaces/events/certification.events.ts` AND the local barrel. Should be documented.
- **`qr-code.service.spec.ts` `useFactory` anti-pattern** — the existing test used `useFactory: mockRepo` which creates isolated instances with no external reference; impossible to control mock behavior from outside. Should use `useValue` consistently across all service tests.
- **Coverage still not measured** — 3 sprints in, `npm run test:cov` has never been run. Baseline unknown.

---

## Action Items

| Item | Owner | Sprint |
|------|-------|--------|
| Run `npm run test:cov` and record coverage baseline | Developer | Sprint 4 start |
| Document local barrel pattern in CLAUDE.md | Developer | Sprint 4 |
| Audit all unit test files for `useFactory` vs `useValue` consistency | Developer | Sprint 4 |
| Write sprint logs same-day (Sp 2 log was written retro-actively) | Developer | Ongoing |

---

## Decisions Made This Sprint

| Decision | Rationale |
|---|---|
| Grant/deny guard tightened to `UNDER_REVIEW` only | Step 8 (`startFinalReview`) is now mandatory — skipping it is a workflow violation |
| Audit fields on entity before `applyTransition` | Avoids a second DB round-trip; fields saved atomically inside the transaction |
| Kafka `certification.review.final-started` | Cooperative-admin needs progress updates at every decision point |
| `newCertificationNumber` optional field on `QrVerificationResult` | Backward compatible — undefined for all non-RENEWED certs |

---

## Definition of Done Compliance

| Criterion | Status |
|-----------|--------|
| Zero TypeScript errors | ✅ |
| Zero lint errors | ✅ |
| Unit tests pass | ✅ 87/87 |
| Integration tests pass | ✅ 13/13 |
| E2E tests pass | ✅ 23/23 |
| Kafka events have typed interfaces | ✅ (+2 new interfaces) |
| New endpoints have class-validator DTOs | ✅ |
| No cross-module service imports | ✅ |
| Migration created | ✅ `1700000000006` (comment migration) |
| Coverage measured | ⚠️ Still pending — action item for Sprint 4 |

---

## Cumulative Velocity (Sprints 1–3)

| Sprint | SP | Duration | Notes |
|--------|----|----------|-------|
| 1 | ~89 | 12 days | Scaffold — atypical, high setup cost |
| 2 | 30 | 1 day | First feature sprint |
| 3 | 21 | 1 day | Completion sprint |
| **Total** | **~140** | **14 days** | |

Effective feature velocity (Sp 2+3): **~25 SP/day**. Sprint 4 should plan for 25–30 SP.
