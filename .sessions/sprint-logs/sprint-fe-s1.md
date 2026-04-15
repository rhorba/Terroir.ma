# Sprint FE-S1 — Frontend Scaffold

**Sprint:** FE-S1
**Name:** Frontend Webapp — Scaffold
**Status:** PLANNED (not yet executed)
**Story Points:** 13 planned / 0 completed
**Design doc:** docs/plans/2026-04-15-frontend-webapp/design.md
**Plan doc:** docs/plans/2026-04-15-frontend-webapp/plan.md

---

## Goal

Create the `terroir-ma-web` repository with all foundational tooling: pnpm workspace, openapi-ts codegen from `terroir-ma/docs/api/openapi.json`, shadcn/ui + Tailwind RTL, next-intl trilingual routing (fr/ar/zgh), Docker multi-stage builds, and CI pipeline.

---

## Stories

| Story | Description | SP | Status |
|---|---|---|---|
| FE-S1 | Full scaffold: repo, workspace, codegen, shadcn/ui, next-intl, Docker | 13 | Todo |

---

## Tasks (17 total, 6 batches)

| # | Task | Batch | Status |
|---|---|---|---|
| 1 | Initialize terroir-ma-web repo + pnpm workspace | 1 | Todo |
| 2 | Create packages/api-client | 1 | Todo |
| 3 | Codegen script generate-api.sh | 1 | Todo |
| 4 | Create apps/portal Next.js 14 app | 2 | Todo |
| 5 | Configure next-intl in portal | 2 | Todo |
| 6 | Portal app directory structure + root layout | 2 | Todo |
| 7 | Create apps/public Next.js 14 app | 3 | Todo |
| 8 | Configure next-intl in public + QR verify page | 3 | Todo |
| 9 | Install shadcn/ui in apps/portal | 4 | Todo |
| 10 | Install shadcn/ui in apps/public | 4 | Todo |
| 11 | Configure Tailwind RTL logical properties in both apps | 4 | Todo |
| 12 | Dockerfile for apps/portal | 5 | Todo |
| 13 | Dockerfile for apps/public | 5 | Todo |
| 14 | Add frontend services to terroir-ma/docker-compose.yml | 5 | Todo |
| 15 | GitHub Actions CI pipeline | 6 | Todo |
| 16 | Root tsconfig + workspace references | 6 | Todo |
| 17 | Final smoke verification | 6 | Todo |

---

## Tech Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 14 App Router |
| Package manager | pnpm workspaces |
| UI | shadcn/ui + Tailwind CSS |
| i18n | next-intl (fr/ar/zgh) |
| API client | openapi-fetch + openapi-ts codegen |
| Auth (wired in FE-S2) | next-auth v5 + Keycloak |
| Deployment | Docker multi-stage, ports 3001 (portal) + 3002 (public) |

---

## Verification Checkpoints

- `pnpm typecheck` passes across all packages
- `pnpm lint` passes across all apps
- `pnpm --filter @terroir/portal build` completes
- `pnpm --filter @terroir/public build` completes
- `docker compose config` validates in terroir-ma/
- `http://localhost:3002/ar/verify/test` renders RTL Arabic layout
