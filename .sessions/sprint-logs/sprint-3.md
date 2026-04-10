# Sprint 3 Log — Certification Chain Steps 8–12 (Complete)

**Dates:** 2026-04-10 (single-day sprint)
**Status:** COMPLETE ✓

## Goal
Complete the 12-step SDOQ certification chain. Refactor grant/deny/revoke through `applyTransition`. Add `startFinalReview` (Step 8) and `renewCertification` (Step 12). Add `RENEWED` status and QR "superseded" response.

## Outcome
**Sprint 3 closed with all 21 SP delivered:**
- `startFinalReview` — Step 8 (LAB_RESULTS_RECEIVED → UNDER_REVIEW)
- `grantCertification` refactored — Step 9 (UNDER_REVIEW → GRANTED, guard tightened)
- `denyCertification` refactored — Step 10 (UNDER_REVIEW → DENIED, guard tightened)
- `revokeCertification` refactored — Step 11 (GRANTED → REVOKED)
- `renewCertification` — Step 12 (GRANTED → RENEWED + new DRAFT with `renewedFromId`)
- `RENEWED` status (13th), `FINAL_REVIEW_STARTED` and `CERTIFICATE_RENEWED` event types
- QR `verifyQrCode` handles RENEWED: returns `{ valid: false, newCertificationNumber }` ("superseded")
- 87 unit tests passing (+11 from Sprint 2), lint clean, typecheck clean
- 2 new Kafka topics: `certification.review.final-started`, `certification.renewed`

## Velocity
- Planned: 21 SP
- Completed: 21 SP
- Velocity: 100%

## Key Technical Decisions
| Decision | Rationale |
|---|---|
| `RENEWED` as 13th status (not reuse `REVOKED`) | Renewal is legitimate; revocation is punitive — semantically distinct |
| QR on RENEWED stays active (not deactivated) | Consumer gets "superseded" info, not a broken link |
| Audit fields set on entity BEFORE `applyTransition` | `em.save(Certification, cert)` in transaction saves all fields atomically |
| Grant guard tightened: `UNDER_REVIEW` only | Closes `LAB_RESULTS_RECEIVED` shortcut from Sprint 2; Step 8 is now mandatory |
| `renewedFromId` chain instead of cert number suffix | Clean numbers, full traceability via data model |
| `publishFinalReviewStarted` Kafka event | Cooperative-admin gets "under final review" notification |

## Blockers Encountered & Resolved
1. **Producer imports from local barrel** — `certification.producer.ts` imports from `./certification-events` (local barrel), not directly from `src/common/interfaces/events`; had to add new types to both files
2. **`qr-code.service.spec.ts` repo access** — existing test used `useFactory: mockRepo` (no access to instance); rewrote to `useValue` pattern for direct mock control
3. **Sprint 2 `grantCertification` guard bug** — found and fixed the `LAB_RESULTS_RECEIVED | UNDER_REVIEW` shortcut; guard is now strict
