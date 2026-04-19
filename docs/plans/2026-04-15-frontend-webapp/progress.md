# Execution Progress — FE-S1

**Plan:** `docs/plans/2026-04-15-frontend-webapp/plan.md`
**Last updated:** 2026-04-19

---

## Status

| Task | Title                                                  | Status       |
| ---- | ------------------------------------------------------ | ------------ |
| 1    | Initialize terroir-ma-web repo                         | ✅ completed |
| 2    | Create packages/api-client                             | ✅ completed |
| 3    | Codegen script + copy openapi.json                     | ✅ completed |
| 4    | Create apps/portal Next.js 14 app                      | ✅ completed |
| 5    | Configure next-intl in portal                          | ✅ completed |
| 6    | Portal app directory structure + root layout           | ✅ completed |
| 7    | Create apps/public Next.js 14 app                      | ✅ completed |
| 8    | Configure next-intl in public app + QR verify page     | ✅ completed |
| 9    | Install shadcn/ui in apps/portal                       | ✅ completed |
| 10   | Install shadcn/ui in apps/public                       | ✅ completed |
| 11   | Configure Tailwind for RTL logical properties          | ✅ completed |
| 12   | Dockerfile for apps/portal                             | ✅ completed |
| 13   | Dockerfile for apps/public                             | ✅ completed |
| 14   | Add frontend services to terroir-ma/docker-compose.yml | ✅ completed |
| 15   | GitHub Actions CI                                      | ✅ completed |
| 16   | Root tsconfig.json + workspace references              | ✅ completed |
| 17   | Final smoke verification                               | ✅ completed |

---

## Batch Log

### Batch 1 (Tasks 1–3) — 2026-04-19

- ✅ Task 1: pnpm-workspace.yaml, package.json, .gitignore, .nvmrc created
- ✅ Task 2: packages/api-client — package.json, tsconfig.json, src/client.ts, src/index.ts, src/generated/types.gen.ts (placeholder)
- ✅ Task 3: scripts/generate-api.sh — copies openapi.json and runs openapi-ts
- Fix: Added @types/node to api-client devDependencies (process not found error)
- Verification: pnpm install ✅ pnpm --filter @terroir/api-client typecheck ✅

### Batch 2 (Tasks 4–6) — 2026-04-19

- ✅ Task 4: apps/portal scaffolded with create-next-app@14.2.0, package.json updated with workspace deps
- ✅ Task 5: next-intl configured — fr/ar/zgh messages, i18n.ts, navigation.ts, middleware.ts
- ✅ Task 6: [locale]/layout.tsx + globals.css (RTL support) + [locale]/page.tsx placeholder
- Fix: next/font/google replaced — fails on Windows (ERR_UNSUPPORTED_ESM_URL_SCHEME)
- Fix: postcss.config.mjs → postcss.config.js (CJS) — ESM postcss fails on Windows
- Fix: output: 'standalone' conditioned on NEXT_OUTPUT env var (Windows symlink EPERM)
- Verification: pnpm --filter @terroir/portal build ✅

### Batch 3 (Tasks 7–8) — 2026-04-19

- ✅ Task 7: apps/public scaffolded with create-next-app@14.2.0, package.json updated
- ✅ Task 8: next-intl configured + QR verify Server Component at [locale]/verify/[uuid]/page.tsx
- Fix: verify page uses fetch() directly instead of typed openapi-fetch client (placeholder types → never type issue)
- Verification: pnpm --filter @terroir/public build ✅

### Batch 4 (Tasks 9–11) — 2026-04-19

- ✅ Task 9: shadcn/ui initialized in apps/portal
- ✅ Task 10: shadcn/ui initialized in apps/public
- ✅ Task 11: tailwind.config.ts updated in both apps — HSL CSS vars for shadcn, darkMode: ['class'], RTL font families
- Fix: shadcn v4 generates Tailwind v4 CSS syntax (oklch, @import "shadcn/tailwind.css") — incompatible with Tailwind v3
  - globals.css rewritten with Tailwind v3 HSL CSS variable format
  - button.tsx replaced — shadcn v4 uses @base-ui/react instead of radix-ui
- Verification: pnpm --filter @terroir/portal build ✅ pnpm --filter @terroir/public build ✅

### Batch 5 (Tasks 12–14) — 2026-04-19

- ✅ Task 12: apps/portal/Dockerfile (multi-stage, NEXT_OUTPUT=standalone in builder)
- ✅ Task 13: apps/public/Dockerfile (same pattern)
- ✅ Task 14: terroir-portal + terroir-public services added to docker-compose.yml under [app, full] profiles
- Verification: docker compose config ✅ (no errors)

### Batch 6 (Tasks 15–17) — 2026-04-19

- ✅ Task 15: .github/workflows/ci.yml — typecheck + lint + build for both apps
- ✅ Task 16: Root tsconfig.json with project references; per-app tsconfigs with target: ES2017
- ✅ Task 17: pnpm install ✅ generate-api.sh ✅ typecheck ✅ lint ✅ portal build ✅ public build ✅

---

## Final Verification Results

| Check                         | Result                                             |
| ----------------------------- | -------------------------------------------------- |
| pnpm install                  | ✅                                                 |
| pnpm run generate-api         | ✅ — types.gen.ts generated from real openapi.json |
| pnpm typecheck (all packages) | ✅ — 0 errors                                      |
| pnpm lint (all apps)          | ✅ — 0 warnings/errors                             |
| @terroir/portal build         | ✅                                                 |
| @terroir/public build         | ✅                                                 |
| docker compose config         | ✅                                                 |

---

## Windows-Specific Fixes (document for CI)

| Issue                                             | Fix                                                             |
| ------------------------------------------------- | --------------------------------------------------------------- |
| `next/font/google` ERR_UNSUPPORTED_ESM_URL_SCHEME | Removed — use CSS font-family instead                           |
| `postcss.config.mjs` ESM Windows path error       | Replaced with `postcss.config.js` (CJS)                         |
| `output: 'standalone'` EPERM symlink              | Conditioned on `NEXT_OUTPUT=standalone` env var                 |
| shadcn v4 + Tailwind v3 incompatibility           | Rewrote globals.css (HSL vars), rewrote button.tsx (plain HTML) |

---

## Resume Instructions

FE-S1 is COMPLETE. Next step: `/plan` for FE-S2 (next-auth + Keycloak + role guard middleware, 13 SP).
