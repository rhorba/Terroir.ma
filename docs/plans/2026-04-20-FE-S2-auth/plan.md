# FE-S2 — NextAuth v5 + Keycloak OIDC + Role Guard Implementation Plan

> **For Claude:** Use /execute to implement this plan task-by-task.

**Goal:** Wire next-auth v5 with the Keycloak OIDC provider into `apps/portal`, add JWT role extraction, upgrade middleware to a role guard, and scaffold layout shells for all 7 staff roles.

**Architecture:** `apps/portal` only — no backend changes. Auth happens entirely in Next.js middleware + next-auth route handler. Keycloak issues JWTs; roles come from `realm_access.roles` in the OIDC profile. No cross-app changes.

**Tech Stack:** Next.js 14 App Router, next-auth v5 beta, next-intl v3, TanStack Query v5, TypeScript strict

**Apps Affected:** `apps/portal` (terroir-ma-web)

**Estimated Story Points:** 13

**Working directory for all tasks:** `C:/Users/moham/justforfun/terroir-ma-web/apps/portal`

---

## Pre-flight checks

- `next-auth@^5.0.0-beta.19` — already in `package.json` ✅
- `@tanstack/react-query@^5.40.0` — already in `package.json` ✅
- `@/*` path alias → `./src/*` — confirmed in `tsconfig.json` ✅
- Message files already have `auth.login`, `auth.unauthorized`, `auth.unauthorized_desc` ✅

---

## Batch 1 — NextAuth Foundation

### Task 1 — Create `src/auth.ts` and the NextAuth route handler

**Files to create:**

- `src/auth.ts`
- `src/app/api/auth/[...nextauth]/route.ts`

**`src/auth.ts`:**

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
        token.roles =
          (profile as { realm_access?: { roles?: string[] } })?.realm_access?.roles ?? [];
      }
      return token;
    },
    session({ session, token }) {
      session.accessToken = token.accessToken as string;
      (session.user as { roles?: string[] }).roles = token.roles as string[];
      return session;
    },
  },
});
```

**`src/app/api/auth/[...nextauth]/route.ts`:**

```ts
import { handlers } from '@/auth';
export const { GET, POST } = handlers;
```

**Verification:** `pnpm typecheck` — expect 0 errors (type issues expected until Task 2).

---

### Task 2 — TypeScript type extensions for Session + JWT

**File to create:** `src/types/next-auth.d.ts`

```ts
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    accessToken: string;
    user: {
      roles: string[];
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    roles?: string[];
  }
}
```

**Verification:** `pnpm typecheck` — must be 0 errors. If `session.accessToken` or `session.user.roles` still errors, check that `tsconfig.json` includes the `types/` folder (it does via `"**/*.ts"`).

---

### ✅ Batch 1 checkpoint

```bash
cd C:/Users/moham/justforfun/terroir-ma-web
pnpm --filter @terroir/portal typecheck
```

Expected: 0 errors.

---

## Batch 2 — Middleware + Providers

### Task 3 — Rewrite `src/middleware.ts` (auth + intl + role guard)

**File to modify:** `src/middleware.ts` (replace entirely)

```ts
import { auth } from '@/auth';
import createIntlMiddleware from 'next-intl/middleware';

const intlMiddleware = createIntlMiddleware({
  locales: ['fr', 'ar', 'zgh'],
  defaultLocale: 'fr',
});

const ROLE_ROUTES: Record<string, string> = {
  '/super-admin': 'super-admin',
  '/cooperative-admin': 'cooperative-admin',
  '/cooperative-member': 'cooperative-member',
  '/lab-technician': 'lab-technician',
  '/inspector': 'inspector',
  '/certification-body': 'certification-body',
  '/customs-agent': 'customs-agent',
};

const PUBLIC_SEGMENTS = ['/login', '/unauthorized', '/api/auth'];

export default auth((req) => {
  const pathname = req.nextUrl.pathname;
  const isPublic = PUBLIC_SEGMENTS.some((seg) => pathname.includes(seg));

  if (!req.auth && !isPublic) {
    return Response.redirect(new URL('/fr/login', req.url));
  }

  if (req.auth && !isPublic) {
    const roles: string[] = (req.auth.user as { roles?: string[] }).roles ?? [];
    for (const [segment, requiredRole] of Object.entries(ROLE_ROUTES)) {
      if (pathname.includes(segment) && !roles.includes(requiredRole)) {
        return Response.redirect(new URL('/fr/unauthorized', req.url));
      }
    }
  }

  return intlMiddleware(req) as unknown as Response;
});

export const config = {
  matcher: ['/((?!_next|_vercel|.*\\..*).*)'],
};
```

**Note:** The `as unknown as Response` cast is required because `NextResponse` and `Response` have minor type differences at the next-auth v5 boundary — this is safe at runtime since `NextResponse extends Response`.

---

### Task 4 — Create `src/lib/auth-utils.ts`

```ts
import { auth } from '@/auth';

/** Returns the Keycloak access token for the current server-side request. */
export async function getAccessToken(): Promise<string> {
  const session = await auth();
  if (!session?.accessToken) throw new Error('Not authenticated');
  return session.accessToken;
}

/** Returns the Keycloak realm roles for the current server-side request. */
export async function getRoles(): Promise<string[]> {
  const session = await auth();
  return (session?.user as { roles?: string[] })?.roles ?? [];
}
```

---

### Task 5 — Create `src/components/providers.tsx` + update `[locale]/layout.tsx`

**File to create:** `src/components/providers.tsx`

```tsx
'use client';

import { SessionProvider } from 'next-auth/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 60_000 } },
      }),
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SessionProvider>
  );
}
```

**File to modify:** `src/app/[locale]/layout.tsx`

Replace the existing layout with:

```tsx
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import type { Metadata } from 'next';
import { Providers } from '@/components/providers';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Terroir.ma — Portail',
  description: 'Plateforme de certification des produits du terroir marocain',
};

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const messages = await getMessages();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

---

### ✅ Batch 2 checkpoint

```bash
cd C:/Users/moham/justforfun/terroir-ma-web
pnpm --filter @terroir/portal typecheck
pnpm --filter @terroir/portal lint
```

Expected: 0 errors, 0 warnings.

---

## Batch 3 — Login + Unauthorized Pages

### Task 6 — Create `src/app/[locale]/login/page.tsx`

```tsx
import { signIn } from '@/auth';
import { getTranslations } from 'next-intl/server';

export default async function LoginPage() {
  const t = await getTranslations('auth');

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-6 rounded-lg border bg-white p-10 shadow-sm">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900">Terroir.ma</h1>
          <p className="text-sm text-gray-500">Plateforme de certification — Law 25-06 SDOQ</p>
        </div>
        <form
          action={async () => {
            'use server';
            await signIn('keycloak');
          }}
        >
          <button
            type="submit"
            className="rounded-md bg-green-700 px-8 py-2.5 text-sm font-semibold text-white hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-600"
          >
            {t('login')}
          </button>
        </form>
      </div>
    </main>
  );
}
```

---

### Task 7 — Create `src/app/[locale]/unauthorized/page.tsx`

```tsx
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export default async function UnauthorizedPage() {
  const t = await getTranslations('auth');

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="text-6xl font-bold text-red-500">403</span>
        <h1 className="text-xl font-semibold text-gray-800">{t('unauthorized')}</h1>
        <p className="text-sm text-gray-500">{t('unauthorized_desc')}</p>
        <Link href="/fr" className="mt-2 text-sm text-green-700 underline hover:text-green-900">
          {t('backHome')}
        </Link>
      </div>
    </main>
  );
}
```

---

### Task 8 — Add missing message keys to all 3 locale files

**`messages/fr.json`** — add `backHome` to the `auth` section:

```json
{
  "common": { ... },
  "auth": {
    "login": "Se connecter",
    "unauthorized": "Accès non autorisé",
    "unauthorized_desc": "Vous n'avez pas les droits nécessaires pour accéder à cette page.",
    "backHome": "Retour à l'accueil"
  }
}
```

**`messages/ar.json`** — add `backHome`:

```json
{
  "common": { ... },
  "auth": {
    "login": "تسجيل الدخول",
    "unauthorized": "غير مصرح بالوصول",
    "unauthorized_desc": "ليس لديك الصلاحيات اللازمة للوصول إلى هذه الصفحة.",
    "backHome": "العودة إلى الرئيسية"
  }
}
```

**`messages/zgh.json`** — add `backHome`:

```json
{
  "common": { ... },
  "auth": {
    "login": "ⴽⵛⵎ",
    "unauthorized": "ⵓⵔ ⵜⵜⵓⵙⵔⴰ",
    "unauthorized_desc": "ⵓⵔ ⴷⴰⵔⴽ ⵜⵉⴽⵉⵍⵢⵉⵏ ⵏ ⵓⴽⵛⵎ ⵙ ⵓⵙⵙⴰⵖ ⴰ.",
    "backHome": "ⵓⵖⴰⵍ ⵖⵔ ⵜⵣⵡⴰⵔⵜ"
  }
}
```

---

### ✅ Batch 3 checkpoint

```bash
cd C:/Users/moham/justforfun/terroir-ma-web
pnpm --filter @terroir/portal typecheck
pnpm --filter @terroir/portal lint
```

Expected: 0 errors, 0 warnings.

---

## Batch 4 — Role Group Layout Shells

### Task 9 — Create 7 role group layouts

Each layout is a Server Component that reads the session and renders a sidebar + main content area. The file paths use Next.js route groups `(role-name)` so the group name does NOT appear in the URL — only the inner folder does.

**URL pattern:** `/fr/super-admin` → file `src/app/[locale]/(super-admin)/super-admin/layout.tsx`

Create the following 7 layout files:

---

**`src/app/[locale]/(super-admin)/super-admin/layout.tsx`:**

```tsx
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

const NAV = [
  { href: '/fr/super-admin/cooperatives', label: 'Coopératives' },
  { href: '/fr/super-admin/labs', label: 'Laboratoires' },
  { href: '/fr/super-admin/specifications', label: 'Spécifications SDOQ' },
  { href: '/fr/super-admin/settings', label: 'Paramètres & Logs' },
];

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/fr/login');

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 bg-gray-900 p-4 text-white">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Super Admin
        </p>
        <p className="mb-6 truncate text-sm text-gray-300">
          {session.user?.name ?? session.user?.email}
        </p>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="rounded px-3 py-2 text-sm hover:bg-gray-700 hover:text-green-400"
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
```

---

**`src/app/[locale]/(cooperative-admin)/cooperative-admin/layout.tsx`:**

```tsx
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

const NAV = [
  { href: '/fr/cooperative-admin/cooperative', label: 'Profil Coopérative' },
  { href: '/fr/cooperative-admin/members', label: 'Membres' },
  { href: '/fr/cooperative-admin/farms', label: 'Fermes' },
  { href: '/fr/cooperative-admin/harvests', label: 'Récoltes' },
  { href: '/fr/cooperative-admin/batches', label: 'Lots' },
  { href: '/fr/cooperative-admin/certifications', label: 'Certifications' },
  { href: '/fr/cooperative-admin/documents', label: 'Documents' },
];

export default async function CooperativeAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/fr/login');

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 bg-green-900 p-4 text-white">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-green-400">
          Admin Coopérative
        </p>
        <p className="mb-6 truncate text-sm text-green-200">
          {session.user?.name ?? session.user?.email}
        </p>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ href, label }) => (
            <Link key={href} href={href} className="rounded px-3 py-2 text-sm hover:bg-green-700">
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
```

---

**`src/app/[locale]/(cooperative-member)/cooperative-member/layout.tsx`:**

```tsx
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

const NAV = [
  { href: '/fr/cooperative-member/harvests', label: 'Mes Récoltes' },
  { href: '/fr/cooperative-member/batches', label: 'Mes Lots' },
];

export default async function CooperativeMemberLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/fr/login');

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 bg-green-800 p-4 text-white">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-green-300">Membre</p>
        <p className="mb-6 truncate text-sm text-green-100">
          {session.user?.name ?? session.user?.email}
        </p>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ href, label }) => (
            <Link key={href} href={href} className="rounded px-3 py-2 text-sm hover:bg-green-600">
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
```

---

**`src/app/[locale]/(lab-technician)/lab-technician/layout.tsx`:**

```tsx
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

const NAV = [
  { href: '/fr/lab-technician/queue', label: "File d'attente" },
  { href: '/fr/lab-technician/submit', label: 'Soumettre résultats' },
];

export default async function LabTechnicianLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/fr/login');

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 bg-blue-900 p-4 text-white">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-blue-300">
          Laborantin
        </p>
        <p className="mb-6 truncate text-sm text-blue-100">
          {session.user?.name ?? session.user?.email}
        </p>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ href, label }) => (
            <Link key={href} href={href} className="rounded px-3 py-2 text-sm hover:bg-blue-700">
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
```

---

**`src/app/[locale]/(inspector)/inspector/layout.tsx`:**

```tsx
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

const NAV = [
  { href: '/fr/inspector/inspections', label: 'Mes Inspections' },
  { href: '/fr/inspector/farms', label: 'Fermes' },
];

export default async function InspectorLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/fr/login');

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 bg-amber-900 p-4 text-white">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber-300">
          Inspecteur
        </p>
        <p className="mb-6 truncate text-sm text-amber-100">
          {session.user?.name ?? session.user?.email}
        </p>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ href, label }) => (
            <Link key={href} href={href} className="rounded px-3 py-2 text-sm hover:bg-amber-700">
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
```

---

**`src/app/[locale]/(certification-body)/certification-body/layout.tsx`:**

```tsx
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

const NAV = [
  { href: '/fr/certification-body/certifications', label: 'Certifications' },
  { href: '/fr/certification-body/qrcodes', label: 'QR Codes' },
  {
    href: '/fr/certification-body/export-documents',
    label: "Documents d'export",
  },
];

export default async function CertificationBodyLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/fr/login');

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 bg-purple-900 p-4 text-white">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-purple-300">
          Organisme Certif.
        </p>
        <p className="mb-6 truncate text-sm text-purple-100">
          {session.user?.name ?? session.user?.email}
        </p>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ href, label }) => (
            <Link key={href} href={href} className="rounded px-3 py-2 text-sm hover:bg-purple-700">
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
```

---

**`src/app/[locale]/(customs-agent)/customs-agent/layout.tsx`:**

```tsx
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

const NAV = [
  {
    href: '/fr/customs-agent/export-documents',
    label: "Documents d'export",
  },
];

export default async function CustomsAgentLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/fr/login');

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 bg-slate-800 p-4 text-white">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Douanes
        </p>
        <p className="mb-6 truncate text-sm text-slate-200">
          {session.user?.name ?? session.user?.email}
        </p>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ href, label }) => (
            <Link key={href} href={href} className="rounded px-3 py-2 text-sm hover:bg-slate-600">
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
```

---

### Task 10 — Create placeholder home pages for each role group (7 pages)

**`src/app/[locale]/(super-admin)/super-admin/page.tsx`:**

```tsx
export default function SuperAdminHome() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Tableau de bord — Super Admin</h1>
      <p className="mt-2 text-gray-500">FE-S3 will populate this page.</p>
    </div>
  );
}
```

**`src/app/[locale]/(cooperative-admin)/cooperative-admin/page.tsx`:**

```tsx
export default function CooperativeAdminHome() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Tableau de bord — Coopérative</h1>
      <p className="mt-2 text-gray-500">FE-S4 will populate this page.</p>
    </div>
  );
}
```

**`src/app/[locale]/(cooperative-member)/cooperative-member/page.tsx`:**

```tsx
export default function CooperativeMemberHome() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Mon espace — Membre</h1>
      <p className="mt-2 text-gray-500">FE-S7 will populate this page.</p>
    </div>
  );
}
```

**`src/app/[locale]/(lab-technician)/lab-technician/page.tsx`:**

```tsx
export default function LabTechnicianHome() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Tableau de bord — Laborantin</h1>
      <p className="mt-2 text-gray-500">FE-S6 will populate this page.</p>
    </div>
  );
}
```

**`src/app/[locale]/(inspector)/inspector/page.tsx`:**

```tsx
export default function InspectorHome() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Tableau de bord — Inspecteur</h1>
      <p className="mt-2 text-gray-500">FE-S5 will populate this page.</p>
    </div>
  );
}
```

**`src/app/[locale]/(certification-body)/certification-body/page.tsx`:**

```tsx
export default function CertificationBodyHome() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Tableau de bord — Organisme de Certification</h1>
      <p className="mt-2 text-gray-500">FE-S5 will populate this page.</p>
    </div>
  );
}
```

**`src/app/[locale]/(customs-agent)/customs-agent/page.tsx`:**

```tsx
export default function CustomsAgentHome() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Tableau de bord — Douanes</h1>
      <p className="mt-2 text-gray-500">FE-S7 will populate this page.</p>
    </div>
  );
}
```

---

### ✅ Batch 4 checkpoint

```bash
cd C:/Users/moham/justforfun/terroir-ma-web
pnpm --filter @terroir/portal typecheck
pnpm --filter @terroir/portal lint
```

Expected: 0 errors, 0 warnings.

---

## Batch 5 — Environment + Final Build

### Task 11 — Create `.env.example` at terroir-ma-web root

**File:** `C:/Users/moham/justforfun/terroir-ma-web/.env.example`

```env
# ─────────────────────────────────────────────
# NextAuth (apps/portal)
# ─────────────────────────────────────────────
# Required: random secret, min 32 chars
AUTH_SECRET=change-me-generate-with-openssl-rand-base64-32
NEXTAUTH_URL=http://localhost:3001

# ─────────────────────────────────────────────
# Keycloak OIDC (apps/portal)
# ─────────────────────────────────────────────
KEYCLOAK_CLIENT_ID=terroir-portal
KEYCLOAK_CLIENT_SECRET=change-me
KEYCLOAK_ISSUER=http://localhost:8080/realms/terroir

# ─────────────────────────────────────────────
# API base URL (both apps)
# ─────────────────────────────────────────────
NEXT_PUBLIC_API_URL=http://localhost:3000

# Docker builds only — set to 'standalone' to enable Next.js standalone output
# Leave empty for local dev (Windows: symlink EPERM workaround)
NEXT_OUTPUT=
```

---

### Task 12 — Final build verification

```bash
cd C:/Users/moham/justforfun/terroir-ma-web

# 1. Typecheck both apps + api-client
pnpm typecheck

# 2. Lint both apps
pnpm lint

# 3. Build portal (requires real env or dummy values)
# Note: next build will fail if KEYCLOAK_ISSUER is unreachable at runtime
# — this is expected in dev without Keycloak running.
# Verify build compiles (TypeScript pass) — runtime auth works only with live Keycloak.
pnpm --filter @terroir/portal build
```

**Expected build outcome:**

- TypeScript: 0 errors
- Lint: 0 warnings
- `next build`: compiles successfully. Next.js may warn about unreachable OIDC endpoint — this is OK for the scaffold; auth flow only works with Keycloak running.

---

## Summary of Files Created / Modified

| File                                                                              | Action                                     |
| --------------------------------------------------------------------------------- | ------------------------------------------ |
| `apps/portal/src/auth.ts`                                                         | CREATE — NextAuth config                   |
| `apps/portal/src/app/api/auth/[...nextauth]/route.ts`                             | CREATE — route handler                     |
| `apps/portal/src/types/next-auth.d.ts`                                            | CREATE — type extensions                   |
| `apps/portal/src/middleware.ts`                                                   | MODIFY — replace with auth+intl+role guard |
| `apps/portal/src/lib/auth-utils.ts`                                               | CREATE — server helpers                    |
| `apps/portal/src/components/providers.tsx`                                        | CREATE — QueryClient + SessionProvider     |
| `apps/portal/src/app/[locale]/layout.tsx`                                         | MODIFY — add Providers wrapper             |
| `apps/portal/src/app/[locale]/login/page.tsx`                                     | CREATE — sign-in page                      |
| `apps/portal/src/app/[locale]/unauthorized/page.tsx`                              | CREATE — 403 page                          |
| `apps/portal/messages/fr.json`                                                    | MODIFY — add `auth.backHome`               |
| `apps/portal/messages/ar.json`                                                    | MODIFY — add `auth.backHome`               |
| `apps/portal/messages/zgh.json`                                                   | MODIFY — add `auth.backHome`               |
| `apps/portal/src/app/[locale]/(super-admin)/super-admin/layout.tsx`               | CREATE                                     |
| `apps/portal/src/app/[locale]/(super-admin)/super-admin/page.tsx`                 | CREATE                                     |
| `apps/portal/src/app/[locale]/(cooperative-admin)/cooperative-admin/layout.tsx`   | CREATE                                     |
| `apps/portal/src/app/[locale]/(cooperative-admin)/cooperative-admin/page.tsx`     | CREATE                                     |
| `apps/portal/src/app/[locale]/(cooperative-member)/cooperative-member/layout.tsx` | CREATE                                     |
| `apps/portal/src/app/[locale]/(cooperative-member)/cooperative-member/page.tsx`   | CREATE                                     |
| `apps/portal/src/app/[locale]/(lab-technician)/lab-technician/layout.tsx`         | CREATE                                     |
| `apps/portal/src/app/[locale]/(lab-technician)/lab-technician/page.tsx`           | CREATE                                     |
| `apps/portal/src/app/[locale]/(inspector)/inspector/layout.tsx`                   | CREATE                                     |
| `apps/portal/src/app/[locale]/(inspector)/inspector/page.tsx`                     | CREATE                                     |
| `apps/portal/src/app/[locale]/(certification-body)/certification-body/layout.tsx` | CREATE                                     |
| `apps/portal/src/app/[locale]/(certification-body)/certification-body/page.tsx`   | CREATE                                     |
| `apps/portal/src/app/[locale]/(customs-agent)/customs-agent/layout.tsx`           | CREATE                                     |
| `apps/portal/src/app/[locale]/(customs-agent)/customs-agent/page.tsx`             | CREATE                                     |
| `terroir-ma-web/.env.example`                                                     | CREATE                                     |

**Total: 27 files (12 created, 4 modified, 14 role-group files)**

---

## Story Point Estimate

| Batch                            | Tasks  | SP     |
| -------------------------------- | ------ | ------ |
| Batch 1 — Auth foundation        | 2      | 3      |
| Batch 2 — Middleware + Providers | 3      | 3      |
| Batch 3 — Login + Unauthorized   | 3      | 2      |
| Batch 4 — Role group shells      | 2      | 3      |
| Batch 5 — Env + build            | 2      | 2      |
| **Total**                        | **12** | **13** |
