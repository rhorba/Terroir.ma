# Sprint Log — FE-S1: Frontend Webapp Scaffold

**Sprint:** FE-S1
**Start:** 2026-04-19
**End:** 2026-04-19
**Goal:** Scaffold terroir-ma-web repo — pnpm workspace, api-client codegen, shadcn/ui, next-intl trilingual, Docker integration
**Story Points:** 13 planned / 13 completed (100%)

---

## Stories

| Story | Title | SP | Status |
|-------|-------|-----|--------|
| FE-S1 | Frontend Webapp Scaffold | 13 | ✅ Done |

---

## Completed Tasks (17/17)

1. ✅ Initialize terroir-ma-web repo
2. ✅ Create packages/api-client
3. ✅ Codegen script + copy openapi.json
4. ✅ Create apps/portal Next.js 14 app
5. ✅ Configure next-intl in portal
6. ✅ Portal app directory structure + root layout
7. ✅ Create apps/public Next.js 14 app
8. ✅ Configure next-intl in public + QR verify page
9. ✅ Install shadcn/ui in apps/portal
10. ✅ Install shadcn/ui in apps/public
11. ✅ Configure Tailwind RTL + color system
12. ✅ Dockerfile for apps/portal
13. ✅ Dockerfile for apps/public
14. ✅ Add frontend services to docker-compose.yml
15. ✅ GitHub Actions CI workflow
16. ✅ Root tsconfig.json + workspace references
17. ✅ Final smoke verification

---

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| postcss.config.js (CJS) | ESM `.mjs` fails on Windows — Node ESM loader rejects `C:` absolute paths |
| Remove next/font/google | Same ERR_UNSUPPORTED_ESM_URL_SCHEME; use CSS font-family instead |
| NEXT_OUTPUT=standalone via env | Windows EPERM on symlinks during standalone build; Docker (Linux) sets this |
| globals.css HSL vars (Tailwind v3) | shadcn v4 CLI generates Tailwind v4 syntax — incompatible with Next.js 14 + TW v3 |
| button.tsx plain HTML | shadcn v4 uses @base-ui/react; replaced with React.forwardRef + HTML button |
| QR verify uses fetch() directly | Placeholder types.gen.ts makes all openapi-fetch paths typed as `never` |

---

## Artifacts

- **Repo:** `C:/Users/moham/justforfun/terroir-ma-web`
- **Plan:** `docs/plans/2026-04-15-frontend-webapp/plan.md`
- **Progress:** `docs/plans/2026-04-15-frontend-webapp/progress.md`

---

## Velocity

- Planned: 13 SP
- Completed: 13 SP
- Velocity: 100%
