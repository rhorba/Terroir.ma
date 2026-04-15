# Frontend Webapp — Design Document

**Date:** 2026-04-15
**Feature:** Full webapp frontend for Terroir.ma
**Status:** Validated — ready for /plan

---

## Context

The Terroir.ma NestJS backend (v1) is complete:

- 4 domain modules: cooperative, product, certification, notification
- 9 Keycloak roles
- 27 Kafka events, 12-step certification chain
- OpenAPI JSON at `docs/api/openapi.json`
- Trilingual: fr-MA (French, LTR), ar-MA (Arabic, RTL), zgh (Amazigh/Tifinagh, LTR)

The frontend is a separate repository (`terroir-ma-web`) that consumes the NestJS REST API via a generated typed client.

---

## Section 1 — Repository Structure

**Repo:** `terroir-ma-web` (separate from `terroir-ma`, pnpm workspace)

```
terroir-ma-web/
├── apps/
│   ├── portal/          # Next.js 14 App Router — all authenticated staff roles
│   └── public/          # Next.js 14 App Router — public consumer QR verify page
├── packages/
│   └── api-client/      # openapi-ts generated types + configured openapi-fetch client
├── scripts/
│   └── generate-api.sh  # Copies openapi.json from terroir-ma, runs openapi-ts codegen
├── .github/
│   └── workflows/
│       └── ci.yml
└── pnpm-workspace.yaml
```

**Codegen script (`scripts/generate-api.sh`):**

```bash
#!/usr/bin/env bash
cp ../terroir-ma/docs/api/openapi.json packages/api-client/openapi.json
pnpm --filter @terroir/api-client exec openapi-ts \
  --input openapi.json \
  --output src/generated \
  --client fetch
```

Run once per sprint after any backend API change. Both apps import from `@terroir/api-client` — zero hand-written fetch types.

---

## Section 2 — Portal App Route Structure

**App:** `apps/portal/`

```
apps/portal/src/app/
├── [locale]/                        # next-intl — /fr/, /ar/, /zgh/
│   ├── layout.tsx                   # Root layout: sets dir="rtl" for ar, loads fonts
│   ├── login/page.tsx               # next-auth sign-in (Keycloak redirect)
│   ├── unauthorized/page.tsx        # Shown on role mismatch
│   │
│   ├── (super-admin)/
│   │   ├── cooperatives/            # List + verify/reject cooperatives
│   │   ├── labs/                    # Accredit/revoke labs
│   │   ├── specifications/          # Manage SDOQ product specs
│   │   └── settings/                # System settings, audit log
│   │
│   ├── (cooperative-admin)/
│   │   ├── cooperative/             # Profile, edit
│   │   ├── members/                 # Add/remove members
│   │   ├── farms/                   # Register + list farms (PostGIS map view)
│   │   ├── harvests/                # Log + list harvests
│   │   ├── batches/                 # Create + track batches
│   │   ├── certifications/          # Request + track certifications, download PDF
│   │   └── documents/               # Upload supporting documents → MinIO
│   │
│   ├── (cooperative-member)/
│   │   ├── harvests/                # Log harvest (GPS input)
│   │   └── batches/                 # View own batches
│   │
│   ├── (lab-technician)/
│   │   └── lab-submissions/         # View queue, submit results, upload PDF report
│   │
│   ├── (inspector)/
│   │   ├── inspections/             # View assigned inspections, file report
│   │   └── farms/                   # View farm details + GPS
│   │
│   ├── (certification-body)/
│   │   ├── certifications/          # Full list, schedule inspection, grant/deny/revoke
│   │   ├── qrcodes/                 # Generate QR, download PNG/SVG, scan stats
│   │   └── export-documents/        # View export docs
│   │
│   └── (customs-agent)/
│       └── export-documents/        # Validate export clearance
│
└── api/auth/[...nextauth]/route.ts  # next-auth Keycloak handler
```

**Middleware (`middleware.ts`)** runs on every request:

1. `next-intl` detects/redirects locale
2. `next-auth` checks session — unauthenticated → `/login`
3. Role guard reads `token.roles` (from `realm_access.roles` JWT claim) → wrong role → `/unauthorized`

Each route group folder is a layout boundary — the `(cooperative-admin)` layout renders the cooperative-admin sidebar; the `(lab-technician)` layout renders a different nav. One login, one app, fully isolated UX per role.

---

## Section 3 — Public App & i18n / RTL Strategy

### Public App (`apps/public/`)

```
apps/public/src/app/
├── [locale]/
│   ├── layout.tsx                  # Minimal layout, no auth, RTL for ar
│   └── verify/
│       └── [uuid]/
│           └── page.tsx            # Server Component: GET /verify/:uuid → render result
├── messages/
│   ├── fr.json
│   ├── ar.json
│   └── zgh.json
└── next.config.ts
```

`verify/[uuid]/page.tsx` is a Next.js **Server Component** — calls `GET /verify/:uuid` at render time (no client-side fetch, no auth token). Instant load, SEO-friendly, graceful error card on invalid/revoked UUID.

### i18n Strategy (`next-intl`)

| Locale         | Direction | Font                                                |
| -------------- | --------- | --------------------------------------------------- |
| `fr` (default) | LTR       | Inter                                               |
| `ar`           | RTL       | Amiri (already in `assets/fonts/Amiri-Regular.ttf`) |
| `zgh`          | LTR       | Noto Sans Tifinagh                                  |

**RTL wiring:**

```tsx
// [locale]/layout.tsx
const dir = locale === 'ar' ? 'rtl' : 'ltr'
return <html lang={locale} dir={dir}>
```

Tailwind configured with logical properties throughout:

- `ms-4` (margin-inline-start) instead of `ml-4`
- `pe-2` (padding-inline-end) instead of `pr-2`

shadcn/ui components are RTL-compatible by default when `dir="rtl"` is on `<html>`.

**Morocco-specific formats via `next-intl` formatters:**

- Dates → `DD/MM/YYYY` (Africa/Casablanca)
- Currency → `1.234,56 MAD`
- Phone → `+212 XXXXXXXXX`

**Message file structure:**

```json
// messages/ar.json
{
  "verify": {
    "title": "التحقق من الشهادة",
    "status_granted": "معتمد",
    "cooperative": "التعاونية",
    "valid_until": "صالح حتى"
  }
}
```

---

## Section 4 — API Client Codegen + TanStack Query

### `packages/api-client/`

```
packages/api-client/
├── openapi.json                  # Copied from terroir-ma/docs/api/openapi.json
├── src/
│   ├── generated/
│   │   ├── types.gen.ts          # All request/response types (auto-generated)
│   │   └── sdk.gen.ts            # Typed fetch functions (auto-generated)
│   ├── client.ts                 # Configured openapi-fetch instance
│   └── index.ts                  # Re-exports everything
└── package.json                  # name: "@terroir/api-client"
```

**`src/client.ts`:**

```ts
import createClient from 'openapi-fetch';
import type { paths } from './generated/types.gen';

export const createApiClient = (accessToken?: string) =>
  createClient<paths>({
    baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
```

### TanStack Query Patterns

**Server Component** (data-fetch at render, no TanStack Query needed):

```ts
const session = await auth();
const client = createApiClient(session.accessToken);
const { data } = await client.GET('/certifications/{id}', { params: { path: { id } } });
```

**Client Component** (interactive tables, mutations, optimistic updates):

```ts
export const useCertifications = () =>
  useQuery({
    queryKey: ['certifications'],
    queryFn: async () => {
      const client = createApiClient(await getAccessToken());
      const { data, error } = await client.GET('/certifications');
      if (error) throw error;
      return data;
    },
  });

export const useGrantCertification = () =>
  useMutation({
    mutationFn: async (id: string) => {
      const client = createApiClient(await getAccessToken());
      return client.POST('/certifications/{id}/decision', {
        params: { path: { id } },
        body: { decision: 'granted' },
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['certifications'] }),
  });
```

### Response Envelope Unwrapping

NestJS wraps all responses in `{ success, data, error, meta }`. Thin utility:

```ts
export const unwrap = <T>(res: { data?: { data?: T } }) => res.data?.data;
```

---

## Section 5 — Auth Flow + Docker Integration

### next-auth v5 — Keycloak Provider

**`apps/portal/auth.ts`:**

```ts
import NextAuth from 'next-auth';
import Keycloak from 'next-auth/providers/keycloak';

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    Keycloak({
      clientId: process.env.KEYCLOAK_CLIENT_ID!,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
      issuer: process.env.KEYCLOAK_ISSUER!,
    }),
  ],
  callbacks: {
    jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token;
        token.roles = (profile as any)?.realm_access?.roles ?? [];
      }
      return token;
    },
    session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.user.roles = token.roles as string[];
      return session;
    },
  },
});
```

**`middleware.ts`:**

```ts
import { auth } from './auth';
import createIntlMiddleware from 'next-intl/middleware';

const intl = createIntlMiddleware({ locales: ['fr', 'ar', 'zgh'], defaultLocale: 'fr' });

const ROLE_ROUTES: Record<string, string> = {
  '/super-admin': 'super-admin',
  '/cooperative-admin': 'cooperative-admin',
  '/cooperative-member': 'cooperative-member',
  '/lab-technician': 'lab-technician',
  '/inspector': 'inspector',
  '/certification-body': 'certification-body',
  '/customs-agent': 'customs-agent',
};

export default auth((req) => {
  if (!req.auth) return Response.redirect(new URL('/fr/login', req.url));
  const roles = req.auth.user.roles ?? [];
  for (const [path, role] of Object.entries(ROLE_ROUTES)) {
    if (req.nextUrl.pathname.includes(path) && !roles.includes(role))
      return Response.redirect(new URL('/fr/unauthorized', req.url));
  }
  return intl(req);
});
```

### Docker Integration

Two new services in **`terroir-ma/docker-compose.yml`**:

```yaml
terroir-portal:
  build:
    context: ../../terroir-ma-web/apps/portal
    dockerfile: Dockerfile
  ports:
    - '3001:3000'
  environment:
    NEXTAUTH_URL: http://localhost:3001
    NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
    KEYCLOAK_CLIENT_ID: terroir-portal
    KEYCLOAK_CLIENT_SECRET: ${KEYCLOAK_PORTAL_SECRET}
    KEYCLOAK_ISSUER: http://terroir-keycloak:8080/realms/terroir
    NEXT_PUBLIC_API_URL: http://terroir-api:3000
  depends_on:
    terroir-api:
      condition: service_healthy
    terroir-keycloak:
      condition: service_healthy
  networks:
    - terroir-network

terroir-public:
  build:
    context: ../../terroir-ma-web/apps/public
    dockerfile: Dockerfile
  ports:
    - '3002:3000'
  environment:
    NEXT_PUBLIC_API_URL: http://terroir-api:3000
  depends_on:
    terroir-api:
      condition: service_healthy
  networks:
    - terroir-network
```

**Multi-stage Dockerfile (both apps):**

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
```

**Access URLs on localhost:**

| Service          | URL                                     |
| ---------------- | --------------------------------------- |
| NestJS API       | `http://localhost:3000`                 |
| Staff portal     | `http://localhost:3001`                 |
| Public QR verify | `http://localhost:3002/fr/verify/:uuid` |
| Keycloak admin   | `http://localhost:8080`                 |

---

## Section 6 — Story Breakdown & YAGNI Recommendation

### Sprint Breakdown

| Sprint    | Scope                                                                                                           | Est. SP    |
| --------- | --------------------------------------------------------------------------------------------------------------- | ---------- |
| FE-S1     | Repo scaffold, pnpm workspace, codegen, shadcn/ui setup, next-intl wiring, Docker                               | 13         |
| FE-S2     | next-auth + Keycloak, middleware role guard, login/unauthorized pages, layout shells per role group             | 13         |
| FE-S3     | super-admin portal: cooperative verification, lab accreditation, SDOQ spec management                           | 13         |
| FE-S4     | cooperative-admin portal: cooperative profile, members, farms (map), harvests, batches                          | 21         |
| FE-S5     | certification-body + inspector portals: certification list, schedule inspection, file report, grant/deny/revoke | 21         |
| FE-S6     | lab-technician portal: submission queue, structured result form, PDF upload                                     | 13         |
| FE-S7     | customs-agent portal: export document validation; cooperative-member portal: harvest log, batch view            | 8          |
| FE-S8     | Public QR verify app: trilingual result page, RTL Arabic, Tifinagh font, revoked/invalid states                 | 8          |
| FE-S9     | Polish: Arabic RTL audit all screens, Tifinagh font, MAD/date/phone formatters, CNDP notice                     | 13         |
| FE-S10    | Testing: Playwright E2E smoke per role, component tests (Vitest + Testing Library), CI pipeline                 | 13         |
| **Total** |                                                                                                                 | **136 SP** |

### YAGNI Recommendation

**Start with FE-S1 + FE-S2 only.**

The entire frontend depends on the scaffold (S1) and auth (S2) being correct. If the Keycloak OIDC flow, token extraction, role guard middleware, and `next-intl` locale routing all work end-to-end on a single dummy protected page — every subsequent sprint is just filling in pages.

**Recommended order after S1+S2:**

1. **FE-S8 (Public QR verify) early** — smallest scope, no auth, proves API client codegen and Server Component fetch work end-to-end
2. **FE-S4 (cooperative-admin)** — highest-value role, covers full certification request happy path
3. **FE-S5 (certification-body)** — completes the chain
4. FE-S3, FE-S6, FE-S7 fill in remaining roles
5. **FE-S9 (RTL audit)** — after all screens exist
6. **FE-S10 (Playwright)** — after all portals stable

---

## Tech Stack Summary

| Concern         | Choice                                                       |
| --------------- | ------------------------------------------------------------ |
| Framework       | Next.js 14 App Router                                        |
| Repo            | `terroir-ma-web` (separate, pnpm workspace)                  |
| Apps            | `apps/portal/` + `apps/public/`                              |
| Shared package  | `packages/api-client/` (openapi-ts codegen)                  |
| UI              | shadcn/ui + Tailwind CSS (logical properties for RTL)        |
| i18n            | `next-intl`, locales: `fr` / `ar` / `zgh`                    |
| API client      | `openapi-fetch` + TanStack Query                             |
| Auth            | `next-auth` v5, Keycloak provider, role guard in middleware  |
| Deployment      | Docker multi-stage, added to `terroir-ma/docker-compose.yml` |
| Package manager | pnpm workspaces                                              |
