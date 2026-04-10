# Sprint 2 Log — Certification Chain Core + Vertical Slice

**Dates:** 2026-04-09 (single-day sprint)
**Status:** COMPLETE ✓

## Goal
Implement certification chain steps 1–7 (DRAFT → LAB_RESULTS_RECEIVED) with append-only `CertificationEvent` ledger. Also deliver vertical slice: US-008, US-009, US-015, US-074.

## Outcome
**Sprint 2 closed with all 30 SP delivered:**
- `CertificationEvent` append-only ledger with CQRS-lite `currentStatus`
- 7 state machine transitions implemented (Steps 1–6 via REST, Step 7 via Kafka)
- `applyTransition()` atomic DB transaction pattern
- Member management (US-008, US-009), product search (US-015), notification history (US-074)
- 76 unit tests passing, lint clean, typecheck clean

## Velocity
- Planned: 30 SP
- Completed: 30 SP
- Velocity: 100%

## Key Technical Decisions
| Decision | Rationale |
|---|---|
| `CertificationEvent` append-only ledger | Law 25-06 requires immutable audit trail |
| CQRS-lite `currentStatus` materialized column | Avoids full event replay for status queries |
| `applyTransition()` with `dataSource.transaction()` | Atomically writes event + updates status |
| Step 7 Kafka-only (no REST) | Lab results come from external system via events |
| `em.create()` + `em.save()` for JSONB | TypeORM `em.insert()` too strict on JSONB typing |
| `user.realm_access.roles[0]` for actorRole | `CurrentUserPayload` has no top-level `role` field |

## Blockers Encountered & Resolved
1. **TypeORM JSONB strict typing** — `em.insert()` rejected `Record<string, unknown> | null`; switched to `em.create()` + `em.save()`
2. **`@Ctx() context` unused param** — renamed to `_context` in all 4 listeners
3. **`CertificationEvent` missing from DI** — added to `getRepositoryToken` mock in state machine unit tests
4. **`describe` with timeout arg** — Jest `describe` doesn't accept 3rd arg; removed `180_000` from outer describe
5. **Sprint 2 guard shortcut** — `grantCertification` accepted both `LAB_RESULTS_RECEIVED` and `UNDER_REVIEW` (fixed in Sprint 3 to `UNDER_REVIEW` only)
