# Frontend Webapp — FE-S1 Implementation Plan

> **For Claude:** Use /execute to implement this plan task-by-task.

**Goal:** Scaffold the `terroir-ma-web` monorepo with two Next.js 14 apps, a shared typed API client (openapi-ts codegen), shadcn/ui, next-intl trilingual routing, and Docker integration into `terroir-ma`.

**Architecture:** Separate repo (`terroir-ma-web`) at `C:\Users\moham\justforfun\terroir-ma-web`. pnpm workspace with `apps/portal`, `apps/public`, `packages/api-client`. No NestJS changes except adding two Docker services to `docker-compose.yml`.

**Tech Stack:** Next.js 14 App Router, TypeScript 5.4+ strict, pnpm workspaces, shadcn/ui, Tailwind CSS, next-intl, openapi-fetch, openapi-ts, Docker multi-stage

**Modules Affected:** frontend only — consumes existing NestJS API via `docs/api/openapi.json`

**Estimated Story Points:** 13

---

## Batch 1 — Repo Init + pnpm Workspace

### Task 1 — Initialize `terroir-ma-web` repo

**Directory:** `C:\Users\moham\justforfun\terroir-ma-web\`

**Create:** `pnpm-workspace.yaml`

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

**Create:** `package.json`

```json
{
  "name": "terroir-ma-web",
  "private": true,
  "scripts": {
    "dev:portal": "pnpm --filter @terroir/portal dev",
    "dev:public": "pnpm --filter @terroir/public dev",
    "build": "pnpm -r build",
    "typecheck": "pnpm -r typecheck",
    "lint": "pnpm -r lint",
    "generate-api": "bash scripts/generate-api.sh"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  },
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  }
}
```

**Create:** `.gitignore`

```
node_modules/
.next/
dist/
.env*.local
*.tsbuildinfo
```

**Create:** `.nvmrc`

```
20
```

**Verification:** `ls` confirms `pnpm-workspace.yaml`, `package.json`, `.gitignore` exist.

---

### Task 2 — Create `packages/api-client`

**Create:** `packages/api-client/package.json`

```json
{
  "name": "@terroir/api-client",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "generate": "openapi-ts --input openapi.json --output src/generated --client fetch",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "openapi-fetch": "^0.10.0"
  },
  "devDependencies": {
    "@hey-api/openapi-ts": "^0.46.0",
    "typescript": "^5.4.0"
  }
}
```

**Create:** `packages/api-client/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

**Create:** `packages/api-client/src/client.ts`

```ts
import createClient from 'openapi-fetch';
import type { paths } from './generated/types.gen';

/**
 * Creates a typed openapi-fetch client configured for the Terroir.ma NestJS API.
 * Pass accessToken for authenticated endpoints; omit for public endpoints (e.g. /verify/:uuid).
 */
export const createApiClient = (accessToken?: string) =>
  createClient<paths>({
    baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });

/**
 * Unwraps the NestJS response envelope { success, data, error, meta } → T.
 */
export const unwrap = <T>(res: { data?: { data?: T } }): T | undefined => res.data?.data;
```

**Create:** `packages/api-client/src/index.ts`

```ts
export { createApiClient, unwrap } from './client';
export type { paths, components, operations } from './generated/types.gen';
```

**Note:** `src/generated/` is populated by the codegen script in Task 3. Add a placeholder so TypeScript does not error before first codegen run:

**Create:** `packages/api-client/src/generated/.gitkeep`

```

```

**Verification:** `packages/api-client/src/client.ts` and `index.ts` exist.

---

### Task 3 — Codegen script + copy openapi.json

**Create:** `scripts/generate-api.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_OPENAPI="$REPO_ROOT/../terroir-ma/docs/api/openapi.json"
TARGET="$REPO_ROOT/packages/api-client/openapi.json"

if [ ! -f "$BACKEND_OPENAPI" ]; then
  echo "ERROR: openapi.json not found at $BACKEND_OPENAPI"
  echo "Run 'npm run export:openapi' in terroir-ma first."
  exit 1
fi

echo "Copying openapi.json from terroir-ma..."
cp "$BACKEND_OPENAPI" "$TARGET"

echo "Running openapi-ts codegen..."
pnpm --filter @terroir/api-client generate

echo "Done. Types generated in packages/api-client/src/generated/"
```

**Make executable (Unix):** `chmod +x scripts/generate-api.sh`

**Add to root `package.json` scripts** (already included in Task 1):

```
"generate-api": "bash scripts/generate-api.sh"
```

**Verification:** `bash scripts/generate-api.sh` completes without error, `packages/api-client/src/generated/types.gen.ts` is created.

---

**End of Batch 1 — Run:**

```bash
cd C:\Users\moham\justforfun\terroir-ma-web
pnpm install
pnpm typecheck
```

---

## Batch 2 — Portal App Scaffold

### Task 4 — Create `apps/portal` Next.js 14 app

**Run:**

```bash
cd C:\Users\moham\justforfun\terroir-ma-web
pnpm create next-app apps/portal \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-git
```

**Modify:** `apps/portal/package.json` — set name and add workspace dep:

```json
{
  "name": "@terroir/portal",
  "version": "0.1.0",
  "scripts": {
    "dev": "next dev -p 3001",
    "build": "next build",
    "start": "next start -p 3001",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@terroir/api-client": "workspace:*",
    "next": "14.2.0",
    "react": "^18",
    "react-dom": "^18",
    "next-auth": "^5.0.0-beta.19",
    "next-intl": "^3.14.0",
    "@tanstack/react-query": "^5.40.0",
    "openapi-fetch": "^0.10.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "eslint": "^8",
    "eslint-config-next": "14.2.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10",
    "postcss": "^8"
  }
}
```

**Verification:** `apps/portal/src/app/page.tsx` exists.

---

### Task 5 — Configure `next-intl` in portal

**Create:** `apps/portal/messages/fr.json`

```json
{
  "common": {
    "loading": "Chargement...",
    "error": "Une erreur est survenue",
    "save": "Enregistrer",
    "cancel": "Annuler",
    "confirm": "Confirmer",
    "logout": "Déconnexion"
  },
  "auth": {
    "login": "Se connecter",
    "unauthorized": "Accès non autorisé",
    "unauthorized_desc": "Vous n'avez pas les droits nécessaires pour accéder à cette page."
  }
}
```

**Create:** `apps/portal/messages/ar.json`

```json
{
  "common": {
    "loading": "جار التحميل...",
    "error": "حدث خطأ ما",
    "save": "حفظ",
    "cancel": "إلغاء",
    "confirm": "تأكيد",
    "logout": "تسجيل الخروج"
  },
  "auth": {
    "login": "تسجيل الدخول",
    "unauthorized": "غير مصرح بالوصول",
    "unauthorized_desc": "ليس لديك الصلاحيات اللازمة للوصول إلى هذه الصفحة."
  }
}
```

**Create:** `apps/portal/messages/zgh.json`

```json
{
  "common": {
    "loading": "ⵉⵜⵜⵓⵙⴽⴰⵔ...",
    "error": "ⵉⵍⵉⵏ ⵓⵛⴽⵉⵡ",
    "save": "ⵙⴽⵜⵉ",
    "cancel": "ⵙⵔ",
    "confirm": "ⵙⵏⵜⵍ",
    "logout": "ⴼⴼⵖ"
  },
  "auth": {
    "login": "ⴽⵛⵎ",
    "unauthorized": "ⵓⵔ ⵜⵜⵓⵙⵔⴰ",
    "unauthorized_desc": "ⵓⵔ ⴷⴰⵔⴽ ⵜⵉⴽⵉⵍⵢⵉⵏ ⵏ ⵓⴽⵛⵎ ⵙ ⵓⵙⵙⴰⵖ ⴰ."
  }
}
```

**Create:** `apps/portal/src/i18n.ts`

```ts
import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`../messages/${locale}.json`)).default,
}));
```

**Create:** `apps/portal/src/navigation.ts`

```ts
import { createSharedPathnamesNavigation } from 'next-intl/navigation';

export const locales = ['fr', 'ar', 'zgh'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'fr';

export const { Link, redirect, usePathname, useRouter } = createSharedPathnamesNavigation({
  locales,
});
```

**Modify:** `apps/portal/next.config.ts`

```ts
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: [],
  },
};

export default withNextIntl(nextConfig);
```

**Verification:** No TypeScript errors in `src/i18n.ts`.

---

### Task 6 — Portal app directory structure + root layout

**Delete** boilerplate: `apps/portal/src/app/page.tsx`, `apps/portal/src/app/layout.tsx`, `apps/portal/src/app/globals.css`

**Create:** `apps/portal/src/app/[locale]/layout.tsx`

```tsx
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { Inter } from 'next/font/google';
import type { Metadata } from 'next';
import '../globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

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
    <html lang={locale} dir={dir} className={inter.variable}>
      <body>
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
```

**Create:** `apps/portal/src/app/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --font-inter: 'Inter', sans-serif;
}

[dir='rtl'] {
  font-family: 'Amiri', serif;
}
```

**Create:** `apps/portal/src/app/[locale]/page.tsx` (temporary placeholder)

```tsx
import { useTranslations } from 'next-intl';

export default function HomePage() {
  const t = useTranslations('auth');
  return (
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="text-2xl font-bold">Terroir.ma Portal — {t('login')}</h1>
    </main>
  );
}
```

**Verification:** `pnpm --filter @terroir/portal build` completes without error.

---

**End of Batch 2 — Run:**

```bash
cd C:\Users\moham\justforfun\terroir-ma-web
pnpm lint
pnpm typecheck
pnpm --filter @terroir/portal build
```

---

## Batch 3 — Public App Scaffold

### Task 7 — Create `apps/public` Next.js 14 app

**Run:**

```bash
cd C:\Users\moham\justforfun\terroir-ma-web
pnpm create next-app apps/public \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-git
```

**Modify:** `apps/public/package.json`

```json
{
  "name": "@terroir/public",
  "version": "0.1.0",
  "scripts": {
    "dev": "next dev -p 3002",
    "build": "next build",
    "start": "next start -p 3002",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@terroir/api-client": "workspace:*",
    "next": "14.2.0",
    "react": "^18",
    "react-dom": "^18",
    "next-intl": "^3.14.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "eslint": "^8",
    "eslint-config-next": "14.2.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10",
    "postcss": "^8"
  }
}
```

**Verification:** `apps/public/src/app/page.tsx` exists.

---

### Task 8 — Configure `next-intl` in public app + QR verify page

**Create:** `apps/public/messages/fr.json`

```json
{
  "verify": {
    "title": "Vérification de Certification",
    "status_granted": "Certifié",
    "status_revoked": "Révoqué",
    "status_pending": "En cours",
    "cooperative": "Coopérative",
    "product_type": "Type de produit",
    "region": "Région",
    "valid_until": "Valable jusqu'au",
    "cert_number": "N° de certification",
    "not_found": "Certification introuvable",
    "not_found_desc": "Ce QR code n'est pas valide ou a expiré."
  }
}
```

**Create:** `apps/public/messages/ar.json`

```json
{
  "verify": {
    "title": "التحقق من الشهادة",
    "status_granted": "معتمد",
    "status_revoked": "ملغى",
    "status_pending": "قيد المعالجة",
    "cooperative": "التعاونية",
    "product_type": "نوع المنتج",
    "region": "المنطقة",
    "valid_until": "صالح حتى",
    "cert_number": "رقم الشهادة",
    "not_found": "الشهادة غير موجودة",
    "not_found_desc": "رمز QR هذا غير صالح أو انتهت صلاحيته."
  }
}
```

**Create:** `apps/public/messages/zgh.json`

```json
{
  "verify": {
    "title": "ⵙⵙⵉⵏ ⴰⵎⵙⴰⴷ",
    "status_granted": "ⵉⵜⵜⵓⵙⵏⵜⵍ",
    "status_revoked": "ⵉⵜⵜⵓⵙⵔⵔⵓ",
    "status_pending": "ⵉⵜⵜⵓⵙⴽⴰⵔ",
    "cooperative": "ⵜⴰⵡⵓⵔⵉ",
    "product_type": "ⴰⵏⴰⵡ ⵏ ⵓⵙⴽⵔ",
    "region": "ⵜⴰⵎⵏⴰⴹⵜ",
    "valid_until": "ⵉⵙⵉⵏ ⴰⵔ",
    "cert_number": "ⵓⵟⵟⵓⵏ ⵏ ⵓⵎⵙⴰⴷ",
    "not_found": "ⵓⵔ ⵉⵜⵜⵓⴼⵉ ⵓⵎⵙⴰⴷ",
    "not_found_desc": "QR ⴰⴷ ⵓⵔ ⵉⵙⵉⵏ."
  }
}
```

**Create:** `apps/public/src/i18n.ts`

```ts
import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`../messages/${locale}.json`)).default,
}));
```

**Create:** `apps/public/src/navigation.ts`

```ts
import { createSharedPathnamesNavigation } from 'next-intl/navigation';

export const locales = ['fr', 'ar', 'zgh'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'fr';

export const { Link, redirect, usePathname, useRouter } = createSharedPathnamesNavigation({
  locales,
});
```

**Modify:** `apps/public/next.config.ts`

```ts
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

const nextConfig = {
  output: 'standalone',
};

export default withNextIntl(nextConfig);
```

**Delete** boilerplate: `apps/public/src/app/page.tsx`, `apps/public/src/app/layout.tsx`

**Create:** `apps/public/src/app/[locale]/layout.tsx`

```tsx
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import type { Metadata } from 'next';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Terroir.ma — Vérification',
  description: "Vérifiez l'authenticité des produits du terroir marocain",
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
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
```

**Create:** `apps/public/src/app/[locale]/verify/[uuid]/page.tsx`

```tsx
import { createApiClient, unwrap } from '@terroir/api-client';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';

interface VerifyPageProps {
  params: { uuid: string; locale: string };
}

export default async function VerifyPage({ params }: VerifyPageProps) {
  const t = await getTranslations('verify');
  const client = createApiClient(); // no auth token — public endpoint

  const { data, error } = await client.GET('/verify/{uuid}' as any, {
    params: { path: { uuid: params.uuid } },
  });

  if (error || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <h1 className="text-xl font-bold text-red-700">{t('not_found')}</h1>
          <p className="mt-2 text-red-600">{t('not_found_desc')}</p>
        </div>
      </main>
    );
  }

  const cert = unwrap<Record<string, unknown>>(data as any);

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-md rounded-lg border border-green-200 bg-green-50 p-6">
        <h1 className="text-xl font-bold text-green-800">{t('title')}</h1>
        <dl className="mt-4 space-y-2 text-sm">
          <div>
            <dt className="font-medium text-gray-600">{t('cert_number')}</dt>
            <dd className="text-gray-900">{String(cert?.certificationNumber ?? '—')}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-600">{t('cooperative')}</dt>
            <dd className="text-gray-900">{String(cert?.cooperativeName ?? '—')}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-600">{t('product_type')}</dt>
            <dd className="text-gray-900">{String(cert?.productType ?? '—')}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-600">{t('region')}</dt>
            <dd className="text-gray-900">{String(cert?.region ?? '—')}</dd>
          </div>
        </dl>
      </div>
    </main>
  );
}
```

**Verification:** `pnpm --filter @terroir/public build` completes without error.

---

**End of Batch 3 — Run:**

```bash
pnpm lint
pnpm typecheck
pnpm --filter @terroir/public build
```

---

## Batch 4 — shadcn/ui Setup

### Task 9 — Install shadcn/ui in `apps/portal`

**Run:**

```bash
cd apps/portal
pnpm dlx shadcn@latest init --defaults
```

When prompted:

- Style: **Default**
- Base color: **Slate**
- CSS variables: **Yes**

**Add core components used across all role portals:**

```bash
pnpm dlx shadcn@latest add button card table badge input label select dialog sheet dropdown-menu avatar separator skeleton toast
```

**Verification:** `apps/portal/src/components/ui/button.tsx` exists.

---

### Task 10 — Install shadcn/ui in `apps/public`

**Run:**

```bash
cd apps/public
pnpm dlx shadcn@latest init --defaults
```

**Add minimal components for QR verify page:**

```bash
pnpm dlx shadcn@latest add card badge separator
```

**Verification:** `apps/public/src/components/ui/card.tsx` exists.

---

### Task 11 — Configure Tailwind for RTL logical properties in both apps

**Modify:** `apps/portal/tailwind.config.ts`

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        arabic: ['Amiri', 'serif'],
        tifinagh: ['Noto Sans Tifinagh', 'sans-serif'],
      },
      colors: {
        terroir: {
          green: '#2D6A4F',
          gold: '#B5892A',
          earth: '#8B6347',
        },
      },
    },
  },
  plugins: [],
};

export default config;
```

**Modify:** `apps/public/tailwind.config.ts` — same as above.

**Verification:** Both configs parse without error (`pnpm typecheck`).

---

**End of Batch 4 — Run:**

```bash
pnpm lint
pnpm typecheck
pnpm build
```

---

## Batch 5 — Docker Integration

### Task 12 — Dockerfile for `apps/portal`

**Create:** `apps/portal/Dockerfile`

```dockerfile
# Stage 1: install deps
FROM node:20-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Stage 2: build
FROM node:20-alpine AS builder
RUN corepack enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# Stage 3: runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
```

**Create:** `apps/portal/.dockerignore`

```
node_modules
.next
.env*.local
Dockerfile
.dockerignore
```

---

### Task 13 — Dockerfile for `apps/public`

**Create:** `apps/public/Dockerfile`

```dockerfile
FROM node:20-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:20-alpine AS builder
RUN corepack enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
```

**Create:** `apps/public/.dockerignore`

```
node_modules
.next
.env*.local
Dockerfile
.dockerignore
```

---

### Task 14 — Add frontend services to `terroir-ma/docker-compose.yml`

**File to modify:** `C:\Users\moham\justforfun\terroir-ma\docker-compose.yml`

Add the following two services inside the existing `services:` block (after the existing `terroir-api` service):

```yaml
terroir-portal:
  build:
    context: ../../terroir-ma-web/apps/portal
    dockerfile: Dockerfile
  container_name: terroir-portal
  ports:
    - '3001:3000'
  environment:
    NEXTAUTH_URL: http://localhost:3001
    NEXTAUTH_SECRET: ${NEXTAUTH_SECRET:-changeme-portal-secret}
    KEYCLOAK_CLIENT_ID: terroir-portal
    KEYCLOAK_CLIENT_SECRET: ${KEYCLOAK_PORTAL_SECRET:-changeme}
    KEYCLOAK_ISSUER: http://terroir-keycloak:8080/realms/terroir
    NEXT_PUBLIC_API_URL: http://terroir-api:3000
  depends_on:
    terroir-api:
      condition: service_healthy
    terroir-keycloak:
      condition: service_healthy
  networks:
    - terroir-network
  restart: unless-stopped

terroir-public:
  build:
    context: ../../terroir-ma-web/apps/public
    dockerfile: Dockerfile
  container_name: terroir-public
  ports:
    - '3002:3000'
  environment:
    NEXT_PUBLIC_API_URL: http://terroir-api:3000
  depends_on:
    terroir-api:
      condition: service_healthy
  networks:
    - terroir-network
  restart: unless-stopped
```

Add to `.env.example` in `terroir-ma`:

```
NEXTAUTH_SECRET=changeme-portal-secret-32chars
KEYCLOAK_PORTAL_SECRET=changeme
```

**Verification:** `docker compose config` in `terroir-ma/` validates without error.

---

**End of Batch 5 — Run:**

```bash
# In terroir-ma-web
pnpm lint
pnpm typecheck
pnpm build

# In terroir-ma
docker compose config
```

---

## Batch 6 — CI Pipeline + Final Verification

### Task 15 — GitHub Actions CI

**Create:** `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    name: Typecheck, Lint, Build
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v3
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Copy openapi.json placeholder
        run: |
          mkdir -p packages/api-client/src/generated
          echo '{}' > packages/api-client/openapi.json

      - name: Typecheck
        run: pnpm typecheck

      - name: Lint
        run: pnpm lint

      - name: Build portal
        run: pnpm --filter @terroir/portal build

      - name: Build public
        run: pnpm --filter @terroir/public build
```

**Verification:** File exists at `.github/workflows/ci.yml`.

---

### Task 16 — Root `tsconfig.json` + workspace references

**Create:** `tsconfig.json` (repo root)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "references": [
    { "path": "./apps/portal" },
    { "path": "./apps/public" },
    { "path": "./packages/api-client" }
  ]
}
```

**Create:** `apps/portal/tsconfig.json` (replace generated one)

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**Create:** `apps/public/tsconfig.json` — identical to portal's above.

---

### Task 17 — Final smoke verification

**Run all of the following in `terroir-ma-web/`:**

```bash
pnpm install
pnpm run generate-api        # copies openapi.json + runs openapi-ts
pnpm typecheck               # must pass across all packages
pnpm lint                    # must pass across all apps
pnpm --filter @terroir/portal build   # must complete
pnpm --filter @terroir/public build   # must complete
```

**Expected output:**

- `packages/api-client/src/generated/types.gen.ts` — generated from `terroir-ma` openapi.json
- Both apps build to `.next/standalone`
- Zero TypeScript errors
- Zero lint errors

**Access URLs after `docker compose up` in `terroir-ma/`:**

| Service                    | URL                                      |
| -------------------------- | ---------------------------------------- |
| NestJS API                 | `http://localhost:3000`                  |
| Staff portal (placeholder) | `http://localhost:3001/fr`               |
| Public QR verify           | `http://localhost:3002/fr/verify/<uuid>` |

---

**End of Batch 6 — Final:**

```bash
pnpm typecheck
pnpm lint
pnpm build
```

---

## Testing Tasks

### Task T1 — Verify codegen output types match API

After running `pnpm run generate-api`, spot-check:

- `types.gen.ts` contains `paths` interface with `/certifications`, `/verify/{uuid}`, `/cooperatives` entries
- `client.ts` compiles — `createApiClient()` returns typed client
- Import `createApiClient` from `@terroir/api-client` in a test file, confirm autocomplete resolves `/verify/{uuid}`

### Task T2 — Verify RTL layout

Start `apps/public` dev server (`pnpm dev`):

- Navigate to `http://localhost:3002/ar/verify/test-uuid`
- Confirm `<html dir="rtl">` in page source
- Confirm text alignment is right-to-left in browser

### Task T3 — Verify locale routing

- `http://localhost:3002/` → redirects to `/fr/`
- `http://localhost:3002/ar/verify/xyz` → renders Arabic text
- `http://localhost:3002/zgh/verify/xyz` → renders Tifinagh text

### Task T4 — Verify Docker build

```bash
cd C:\Users\moham\justforfun\terroir-ma
docker compose build terroir-portal terroir-public
docker compose up terroir-portal terroir-public
curl http://localhost:3001/fr   # must return HTML
curl http://localhost:3002/fr   # must return HTML
```

---

## Story Points

| Sprint                | Scope                                                            | SP      |
| --------------------- | ---------------------------------------------------------------- | ------- |
| **FE-S1 (this plan)** | Scaffold: repo, workspace, codegen, shadcn/ui, next-intl, Docker | **13**  |
| FE-S2                 | next-auth + Keycloak, middleware role guard, layout shells       | 13      |
| FE-S3                 | super-admin portal                                               | 13      |
| FE-S4                 | cooperative-admin portal                                         | 21      |
| FE-S5                 | certification-body + inspector portals                           | 21      |
| FE-S6                 | lab-technician portal                                            | 13      |
| FE-S7                 | customs-agent + cooperative-member portals                       | 8       |
| FE-S8                 | Public QR verify app (polish + trilingual)                       | 8       |
| FE-S9                 | RTL audit + Morocco formatters                                   | 13      |
| FE-S10                | Playwright E2E + Vitest component tests + CI                     | 13      |
| **Total**             |                                                                  | **136** |

---

> **Next sprint plan:** After FE-S1 executes successfully, run `/plan` again for FE-S2 (next-auth + Keycloak + role guard middleware).
