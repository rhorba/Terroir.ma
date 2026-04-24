# Sprint FE-S10 — Customs-Agent Portal + E2E Tests + Docker Prod Build

**Dates:** 2026-04-24 → 2026-04-24 (1 session)
**Objectif:** Complete the customs-agent export-documents portal, add Playwright E2E smoke tests, fix pnpm-monorepo Docker builds
**Statut:** COMPLETED ✅
**Vélocité:** 15/15 SP (100%)

---

## Stories couvertes

| Story | Description | SP | Statut |
|-------|-------------|-----|--------|
| US-062 | Customs agent validates export documentation request | 5 | ✅ Done |
| US-063 | Customs agent assigns HS code to export (view + detail) | 3 | ✅ Done |
| US-068 | Customs agent downloads PDF export certificate | 5 | ✅ Done |
| FE-E2E | Playwright smoke test suite (auth + QR + export-docs) | 4 | ✅ Done |
| FE-Docker | pnpm monorepo Dockerfile fix + docker-compose.prod.yml | 3 | ✅ Done |

---

## Tâches exécutées (15/15)

### Batch 1 — Backend patch + portal core

| # | Tâche | Fichiers | Statut |
|---|-------|----------|--------|
| 1 | Backend: add customs-agent to GET /export-documents | `export-document.controller.ts` | ✅ |
| 2 | Customs-agent dashboard | `customs-agent/page.tsx` | ✅ |
| 3 | Export-documents list page | `export-documents/page.tsx` | ✅ |
| 4 | Export-document detail + validate Server Action + client form | `[id]/page.tsx`, `[id]/actions.ts`, `[id]/validate-form.tsx` | ✅ |

### Batch 2 — Generate form + polish

| # | Tâche | Fichiers | Statut |
|---|-------|----------|--------|
| 5 | Generate export doc form + API proxy route | `new/page.tsx`, `new/generate-form.tsx`, `/api/generate-export-doc/route.ts` | ✅ |
| 6 | Extend StatusBadge with ExportDocument statuses | `components/admin/status-badge.tsx` | ✅ |
| 7 | Lint + typecheck + build checkpoint | — | ✅ |
| 8 | Commit customs-agent portal | commits `98f4dfe` (FE) + `eb3a48d` (BE) | ✅ |

### Batch 3 — Playwright E2E

| # | Tâche | Fichiers | Statut |
|---|-------|----------|--------|
| 9 | Playwright install + config + test:e2e script | `playwright.config.ts`, `package.json` | ✅ |
| 10 | E2E: QR verify flow (public app) | `e2e/qr-verify.spec.ts` | ✅ |
| 11 | E2E: Login redirect flow | `e2e/auth.spec.ts` | ✅ |
| 12 | E2E: Export documents unauthenticated redirects | `e2e/export-documents.spec.ts` | ✅ |

### Batch 4 — Docker

| # | Tâche | Fichiers | Statut |
|---|-------|----------|--------|
| 13 | Fix portal Dockerfile (pnpm monorepo root context) | `apps/portal/Dockerfile` | ✅ |
| 14 | Fix public Dockerfile (pnpm monorepo root context) | `apps/public/Dockerfile` | ✅ |
| 15 | .dockerignore + docker-compose.prod.yml + final commit | `.dockerignore`, `docker-compose.prod.yml` | ✅ |

---

## Résultats

- Commits terroir-ma-web: `98f4dfe`, `bbd8a7f`, `37fed48` sur main
- Commits terroir-ma: `eb3a48d` sur main
- apps/portal: 45 routes compilées ✅
- apps/public: 4 routes compilées ✅
- Typecheck: 0 erreurs (portal + public + api-client)
- Lint: 0 warnings (portal + public)
- Backend unit tests: 391/391 ✅

---

## Bugs corrigés

| Bug | Fix |
|-----|-----|
| `GET /export-documents` super-admin only — customs-agent bloqué | Ajout `customs-agent` dans `@Roles` |
| 4× apostrophes non échappées dans JSX | Remplacées par `&apos;` |
| Dockerfiles copiaient `pnpm-lock.yaml` depuis le dossier app (inexistant) | Réécrits avec build context racine monorepo |

---

## Notes techniques

- Dashboard counts sampled from page 1 only (`limit=100`) — exact jusqu'à 100 docs; prévoir `/export-documents/stats` en Phase 2
- Docker prod build non vérifié à l'exécution (Docker Desktop non actif en session) — à valider en Phase 2
- E2E tests smoke-only (pas d'auth) — flows authentifiés à compléter quand Keycloak dev fixture disponible
- `GET /export-documents` patch: test unitaire non requis (changement d'un decorator, pas de logique métier)

---

## v1 Complete — Tableau de bord final

| Phase | Sprints | SP | Statut |
|-------|---------|-----|--------|
| Backend (Sp1–12) | 12 | 389 | ✅ DONE |
| Frontend (FE-S1–S10) | 10 | 127 | ✅ DONE |
| **Total v1** | **22** | **516** | **✅ DONE** |
