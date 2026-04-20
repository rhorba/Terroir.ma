# Sprint Log — FE-S2

**Sprint:** FE-S2 — Auth — NextAuth v5 + Keycloak OIDC + Role Guard
**Dates:** 2026-04-20 → 2026-04-20 (1 session)
**Goal:** Wire next-auth v5 + Keycloak OIDC into apps/portal, extract JWT roles, upgrade middleware to role guard, scaffold 7 role group layout shells
**Status:** COMPLETED ✅

## Committed Stories

| ID | Description | SP | Status |
|----|-------------|-----|--------|
| FE-S2 | NextAuth v5 + Keycloak OIDC + role guard middleware + login/unauthorized pages + 7 layout shells | 13 | ✅ Done |

**Total:** 13 / 13 SP (100%)

## Plan

`docs/plans/2026-04-20-FE-S2-auth/plan.md` — 12 tasks, 5 batches

## Progress

`docs/plans/2026-04-20-FE-S2-auth/progress.md` — all 12 tasks ✅

## Retrospective

`.sessions/sprint-logs/FE-S2-retro.md`

## Key Decisions

- `auth()` wrapper + intl middleware composition
- `jose` Edge Runtime warnings accepted as benign
- Server action for Keycloak redirect
- Layout-level session guard per role group
- Sidebar hardcoded to `/fr/` — RTL migration in FE-S9

## Files Delivered

27 files total (25 new, 4 modified) — see progress.md for full list.
