# Design — Phase 2: Authenticated Playwright E2E

**Date:** 2026-04-24  
**Scope:** All 8 staff roles + consumer QR verify, critical path focus (customs-agent, certification-body, super-admin deep coverage)  
**Phase:** 2  
**Backlog ref:** Phase 2 E2E authenticated flows

---

## Problem

Current Playwright suite (11 tests) only covers unauthenticated redirects and public QR page renders. There is no automated test that verifies a logged-in cooperative-admin can actually create a batch, or that a certification-body officer can grant a certification. Any regression in role-gated UI is only caught by manual testing.

---

## Scope (chosen: C + D)

- All 8 staff roles authenticated via Keycloak storage state (no password entry in hot tests)
- Consumer QR verify: existing 3 tests upgraded to use a real QR UUID from seeded data
- Critical path depth (D): customs-agent, certification-body, super-admin get full CRUD journey tests
- Other roles: happy-path smoke (login → dashboard renders → key list loads)

---

## Architecture

```
global-setup.ts (runs once before all tests)
  ├── seeds test DB via API (or SQL fixture)
  ├── for each of 8 roles:
  │     ├── navigate to /login
  │     ├── fill Keycloak login form (test-<role>@terroir.ma / Test1234!)
  │     └── save storageState to apps/portal/e2e/.auth/<role>.json
  └── stores seed data IDs in apps/portal/e2e/.auth/seed.json

playwright.config.ts
  └── projects array — one project per role (reuses stored auth)
        ├── project: cooperative-admin   → storageState: .auth/cooperative-admin.json
        ├── project: certification-body  → storageState: .auth/certification-body.json
        ├── project: customs-agent       → storageState: .auth/customs-agent.json
        ├── project: super-admin         → storageState: .auth/super-admin.json
        ├── project: inspector           → storageState: .auth/inspector.json
        ├── project: lab-technician      → storageState: .auth/lab-technician.json
        ├── project: cooperative-member  → storageState: .auth/cooperative-member.json
        └── project: consumer            → no auth (public app port 3002)

docker-compose.test.yml
  └── adds: keycloak-test (dev mode, test realm imported)
  └── adds: db-seed service (runs SQL seed then exits)
```

---

## Keycloak Test Fixture

A dedicated test realm `terroir-test` is imported on Keycloak startup from `test/fixtures/keycloak-realm-test.json`. This realm contains:

- 9 test users (one per role)
- All 9 realm roles assigned
- `terroir-portal` OIDC client with `http://localhost:3001/*` redirect URIs
- Credentials: `Test1234!` for all test users (acceptable for dev/CI, never production)

Test user naming convention:

| Role               | Email                              | Username                |
| ------------------ | ---------------------------------- | ----------------------- |
| super-admin        | test-super-admin@terroir.ma        | test-super-admin        |
| cooperative-admin  | test-cooperative-admin@terroir.ma  | test-cooperative-admin  |
| cooperative-member | test-cooperative-member@terroir.ma | test-cooperative-member |
| inspector          | test-inspector@terroir.ma          | test-inspector          |
| lab-technician     | test-lab-technician@terroir.ma     | test-lab-technician     |
| certification-body | test-certification-body@terroir.ma | test-certification-body |
| customs-agent      | test-customs-agent@terroir.ma      | test-customs-agent      |
| consumer           | (no Keycloak account — public app) | —                       |

The `cooperative_id` Keycloak custom claim is set to `00000000-0000-0000-0000-000000000001` (seeded test cooperative UUID) on `test-cooperative-admin` and `test-cooperative-member`.

---

## Test Data Seeding

`global-setup.ts` hits the backend API as `test-super-admin` to seed the minimum required data:

```
POST /api/v1/cooperatives            → cooperative (id: fixed UUID)
POST /api/v1/cooperatives/:id/members → member
POST /api/v1/farms                   → farm
POST /api/v1/products                → product + specification
POST /api/v1/certifications          → certification request (submitted state)
POST /api/v1/export-documents        → export doc (submitted state)
```

Seeded IDs are written to `.auth/seed.json` so all spec files can import them without re-fetching.

---

## Test Spec Plan

### Critical path specs (full journey)

**`certification-chain.spec.ts`** — tests the full 12-step chain  
Uses 4 role projects in sequence via `test.use({ storageState })`:

1. Inspector: navigate to inspection queue → open seeded certification → submit inspection report
2. Lab technician: open queue → open sample → submit test results (pass)
3. Certification body: open certifications list → open pending cert → click Grant → confirm modal
4. Verify: GET `/api/v1/certifications/:id` status is `certified`

**`customs-agent.spec.ts`** — export document full journey

1. Navigate to `/customs-agent/export-documents` → table loads with seeded doc
2. Click "Examiner" → detail page loads, status badge shows "submitted"
3. Click "Valider le dédouanement" → confirm → status badge changes to "approved"
4. Navigate to `/customs-agent/export-documents/new` → fill all 6 fields → submit → success banner with link

**`super-admin.spec.ts`** — cooperative management

1. Navigate to `/super-admin/cooperatives` → list loads
2. Click into seeded cooperative → detail loads with member count
3. Navigate to `/super-admin/labs` → list loads
4. Navigate to `/super-admin/audit-log` → table loads

### Happy-path smoke specs (login → dashboard → key list)

**`cooperative-admin.spec.ts`** — dashboard + members list + farms list  
**`cooperative-member.spec.ts`** — dashboard + harvests list  
**`inspector.spec.ts`** — dashboard + inspections list  
**`lab-technician.spec.ts`** — dashboard + queue list  
**`qr-verify.spec.ts`** (upgrade) — use real certified product UUID from seed.json

---

## Infrastructure Changes

### docker-compose.test.yml additions

```yaml
keycloak-test:
  image: quay.io/keycloak/keycloak:24.0.4
  command: start-dev --import-realm
  environment:
    KEYCLOAK_ADMIN: admin
    KEYCLOAK_ADMIN_PASSWORD: admin
    KC_HTTP_PORT: 8080
  volumes:
    - ./test/fixtures/keycloak-realm-test.json:/opt/keycloak/data/import/realm.json:ro
  ports:
    - '8080:8080'
  healthcheck:
    test: ['CMD', 'curl', '-f', 'http://localhost:8080/health/ready']
    interval: 10s
    timeout: 5s
    retries: 20
```

### playwright.config.ts changes

```typescript
projects: [
  // setup project runs first — produces auth state files
  { name: 'setup', testMatch: /global-setup\.ts/ },

  // role projects depend on setup
  {
    name: 'cooperative-admin',
    use: { storageState: 'apps/portal/e2e/.auth/cooperative-admin.json' },
    dependencies: ['setup'],
  },
  // ... (one entry per role)
];
```

### .gitignore

```
apps/portal/e2e/.auth/
```

Auth state files contain session cookies — never commit.

---

## Files to Create / Modify

| Action | Path                                                                   |
| ------ | ---------------------------------------------------------------------- |
| CREATE | `test/fixtures/keycloak-realm-test.json` — test realm with 8 users     |
| CREATE | `apps/portal/e2e/global-setup.ts` — authenticate all roles + seed data |
| CREATE | `apps/portal/e2e/global-teardown.ts` — cleanup (optional, reset DB)    |
| CREATE | `apps/portal/e2e/certification-chain.spec.ts`                          |
| CREATE | `apps/portal/e2e/customs-agent.spec.ts`                                |
| CREATE | `apps/portal/e2e/super-admin.spec.ts`                                  |
| CREATE | `apps/portal/e2e/cooperative-admin.spec.ts`                            |
| CREATE | `apps/portal/e2e/cooperative-member.spec.ts`                           |
| CREATE | `apps/portal/e2e/inspector.spec.ts`                                    |
| CREATE | `apps/portal/e2e/lab-technician.spec.ts`                               |
| MODIFY | `apps/portal/e2e/qr-verify.spec.ts` — use seeded UUID                  |
| MODIFY | `playwright.config.ts` — add globalSetup + role projects               |
| MODIFY | `docker-compose.test.yml` — add keycloak-test service                  |
| MODIFY | `.gitignore` — ignore `.auth/` dir                                     |

---

## CI Integration

```yaml
# .github/workflows/e2e.yml
- name: Start test stack
  run: docker compose -f docker-compose.test.yml up -d --wait

- name: Start Next.js apps
  run: pnpm dev & # or pnpm build && pnpm start

- name: Run Playwright
  run: pnpm test:e2e

- name: Upload report
  uses: actions/upload-artifact@v4
  with:
    name: playwright-report
    path: playwright-report/
```

---

## YAGNI Notes

- No visual regression testing (Percy/Argos) — Phase 3
- No API mocking in Playwright — tests hit real backend (more realistic, same pattern as existing e2e)
- `test-cooperative-member` gets minimum Keycloak setup — cooperative_id claim not needed until member creates harvests (harvest tests use the seeded cooperative)
- `global-teardown.ts` is a stub for now — dev DB is ephemeral (Docker volume); CI resets on each run
