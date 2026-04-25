# Sprint Log — P2-S4: Consumer Migration + Authenticated Playwright E2E

**Sprint dates:** 2026-04-25  
**Status:** ✅ COMPLETED  
**Velocity:** 13/13 SP (100%)  
**Stories:** US-100, US-101, US-102

---

## Sprint Goal

Migrate dormant `@EventPattern` Kafka consumers (`CooperativeListener`, `ProductListener`, `CertificationListener`) to `KafkaConsumerService.subscribe()` and add authenticated Playwright E2E flows covering all 8 staff roles.

---

## User Stories

### US-100 — Consumer Migration (5 SP) ✅

**Acceptance criteria:**
- [x] `CooperativeListener` uses `KafkaConsumerService.subscribe()`
- [x] `ProductListener` uses `KafkaConsumerService.subscribe()`
- [x] `CertificationListener` uses `KafkaConsumerService.subscribe()` for all 4 topics
- [x] All listeners are `@Injectable()`, not `@Controller()`
- [x] `JSON.parse(testValues)` added in `ProductListener.handleLabTestCompleted()`
- [x] Module files updated (listeners in `providers[]` not `controllers[]`)
- [x] All unit specs updated — subscription registration tests added

### US-101 — Playwright Infrastructure + Critical-Path Specs (5 SP) ✅

**Acceptance criteria:**
- [x] Keycloak realm has 7 test users (one per staff role, `Test1234!`)
- [x] `terroir-portal` OIDC client added (localhost:3001, confidential)
- [x] `global-setup.ts` authenticates all 7 roles via browser flow
- [x] `playwright.config.ts` has per-role projects with `storageState`
- [x] `certification-chain.spec.ts` — inspector + lab-tech + cert-body smoke
- [x] `customs-agent.spec.ts` — list + form + dashboard authenticated
- [x] `super-admin.spec.ts` — cooperatives + audit-log + dashboard authenticated

### US-102 — Smoke Specs + QR Upgrade + CI (3 SP) ✅

**Acceptance criteria:**
- [x] `cooperative-admin.spec.ts` (dashboard + members + farms)
- [x] `cooperative-member.spec.ts` (dashboard + harvests)
- [x] `inspector.spec.ts` (dashboard + inspections)
- [x] `lab-technician.spec.ts` (dashboard + lab-tests)
- [x] `qr-verify.spec.ts` upgraded with seeded UUID test
- [x] `.github/workflows/e2e.yml` CI workflow created
- [x] `.gitignore` updated (`.auth/`, `playwright-report/`, `test-results/`)

---

## Key Decisions

1. Spec updates pulled forward to Batch 1 — typecheck gate required immediate fix
2. Smoke assertions only — full journey tests deferred (require live backend + seeded chain data)
3. Browser-based Playwright auth — no `directAccessGrantsEnabled` needed
4. `terroir-portal` confidential client added (not modifying existing `web-portal`)
5. `global-setup.ts` writes seed.json stub — no API seeding; smoke tests don't need it

---

## Bugs Fixed

| Bug | Fix |
|-----|-----|
| 3 Kafka listeners dormant (`@EventPattern` with no `connectMicroservice()`) | Migrated to `KafkaConsumerService.subscribe()` |
| `testValues` JSON string not parsed before JSONB save | Added `JSON.parse()` in `ProductListener` |
| `.env.example` wrong realm + client secret | Fixed KEYCLOAK_ISSUER + CLIENT_SECRET |
| No `terroir-portal` Keycloak client | Added confidential client with localhost:3001 redirect |

---

## Test Results

| Suite | Count | Delta |
|-------|-------|-------|
| Unit | 436 | +4 |
| Integration | 29 | 0 |
| E2E (backend Supertest) | 35 | 0 |
| Playwright spec files | 10 | +7 |

---

## Velocity

- Planned: 13 SP
- Completed: 13 SP
- Velocity %: 100%
- Phase 2 rolling avg after P2-S4: 13.75 SP/sprint
