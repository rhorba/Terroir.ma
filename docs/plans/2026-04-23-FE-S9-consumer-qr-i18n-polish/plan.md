# FE-S9 Consumer QR Public App + i18n Polish Implementation Plan

> **For Claude:** Use /execute to implement this plan task-by-task.

**Goal:** Fix the public QR verify page (correct URL, typed response, richer display) and remove all hardcoded `/fr/` locale prefixes from portal sidebar layouts.

**Architecture:** Two apps in `terroir-ma-web` monorepo — `apps/public` (consumer-facing, no auth) and `apps/portal` (role-based, Keycloak auth). Backend endpoint `GET /api/v1/verify/:uuid?lang=` returns full QrVerificationResult wrapped in `{ success, data }` envelope.

**Tech Stack:** Next.js 14 App Router, next-intl, TypeScript strict, Tailwind CSS

**Modules Affected:**

- `apps/public/src/lib/` — new typed fetch helper
- `apps/public/src/app/[locale]/verify/[uuid]/page.tsx` — rewrite
- `apps/public/messages/*.json` — add 3 keys to all 3 locales
- `apps/portal/src/app/[locale]/**/layout.tsx` — 7 layouts, remove hardcoded `/fr/`

**Estimated Story Points:** 8

---

## Workstream A — Fix & enhance public QR verify page

### Task 1 — Create `apps/public/src/lib/api-public.ts`

**File:** `apps/public/src/lib/api-public.ts` — CREATE

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export type CertificationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'DOCUMENT_REVIEW'
  | 'INSPECTION_SCHEDULED'
  | 'INSPECTION_IN_PROGRESS'
  | 'INSPECTION_COMPLETE'
  | 'LAB_TESTING'
  | 'LAB_RESULTS_RECEIVED'
  | 'UNDER_REVIEW'
  | 'GRANTED'
  | 'DENIED'
  | 'REVOKED'
  | 'RENEWED';

export type CertificationType = 'IGP' | 'AOP' | 'LA';

export interface VerifyCertification {
  id: string;
  certificationNumber: string | null;
  cooperativeName: string;
  productTypeCode: string;
  certificationType: CertificationType;
  regionCode: string;
  currentStatus: CertificationStatus;
  validFrom: string | null;
  validUntil: string | null;
}

export interface QrVerificationData {
  valid: boolean;
  certification: VerifyCertification | null;
  message: string;
  statusDisplay: string | undefined;
  lang: string;
  rtl: boolean;
}

export async function fetchVerification(
  uuid: string,
  lang: string,
): Promise<QrVerificationData | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/verify/${encodeURIComponent(uuid)}?lang=${lang}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: QrVerificationData };
    return body.data ?? null;
  } catch {
    return null;
  }
}
```

**Verification:** File created, no typecheck yet.

---

### Task 2 — Rewrite `apps/public/src/app/[locale]/verify/[uuid]/page.tsx`

**File:** `apps/public/src/app/[locale]/verify/[uuid]/page.tsx` — REPLACE

Replace the entire file with:

```typescript
import { getTranslations } from 'next-intl/server';
import { fetchVerification, type CertificationStatus } from '@/lib/api-public';

interface VerifyPageProps {
  params: { uuid: string; locale: string };
}

function statusColor(status: CertificationStatus): string {
  if (status === 'GRANTED' || status === 'RENEWED') return 'bg-green-100 text-green-800';
  if (status === 'REVOKED' || status === 'DENIED') return 'bg-red-100 text-red-800';
  return 'bg-amber-100 text-amber-800';
}

export default async function VerifyPage({ params }: VerifyPageProps) {
  const t = await getTranslations('verify');
  const data = await fetchVerification(params.uuid, params.locale);
  const cert = data?.certification ?? null;

  if (!data || !cert) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <h1 className="text-xl font-bold text-red-700">{t('not_found')}</h1>
          <p className="mt-2 text-red-600">{t('not_found_desc')}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-md rounded-lg border border-green-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-green-800">{t('title')}</h1>

        {data.statusDisplay && (
          <span
            className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold ${statusColor(cert.currentStatus)}`}
          >
            {data.statusDisplay}
          </span>
        )}

        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="font-medium text-gray-500">{t('cert_number')}</dt>
            <dd className="mt-0.5 font-mono text-gray-900">{cert.certificationNumber ?? '—'}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">{t('cooperative')}</dt>
            <dd className="mt-0.5 text-gray-900">{cert.cooperativeName}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">{t('product_type')}</dt>
            <dd className="mt-0.5 text-gray-900">{cert.productTypeCode}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">{t('cert_type')}</dt>
            <dd className="mt-0.5 text-gray-900">{cert.certificationType}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">{t('region')}</dt>
            <dd className="mt-0.5 text-gray-900">{cert.regionCode}</dd>
          </div>
          {cert.validFrom && (
            <div>
              <dt className="font-medium text-gray-500">{t('valid_from')}</dt>
              <dd className="mt-0.5 text-gray-900">{cert.validFrom}</dd>
            </div>
          )}
          {cert.validUntil && (
            <div>
              <dt className="font-medium text-gray-500">{t('valid_until')}</dt>
              <dd className="mt-0.5 text-gray-900">{cert.validUntil}</dd>
            </div>
          )}
        </dl>

        {data.message && (
          <p className="mt-4 text-xs text-gray-400">{data.message}</p>
        )}
      </div>
    </main>
  );
}
```

**Verification:** File replaced. Imports from `@/lib/api-public`.

---

### Task 3 — Update `apps/public/messages/*.json` — add `valid_from`, `cert_type` keys

**File:** `apps/public/messages/fr.json` — ADD keys `valid_from` and `cert_type`:

```json
{
  "verify": {
    "title": "Vérification de Certification",
    "status_granted": "Certifié",
    "status_revoked": "Révoqué",
    "status_pending": "En cours",
    "cooperative": "Coopérative",
    "product_type": "Type de produit",
    "cert_type": "Type de certification",
    "region": "Région",
    "valid_from": "Valable depuis",
    "valid_until": "Valable jusqu'au",
    "cert_number": "N° de certification",
    "not_found": "Certification introuvable",
    "not_found_desc": "Ce QR code n'est pas valide ou a expiré."
  }
}
```

**File:** `apps/public/messages/ar.json` — ADD keys `valid_from` and `cert_type`:

```json
{
  "verify": {
    "title": "التحقق من الشهادة",
    "status_granted": "معتمد",
    "status_revoked": "ملغى",
    "status_pending": "قيد المعالجة",
    "cooperative": "التعاونية",
    "product_type": "نوع المنتج",
    "cert_type": "نوع الشهادة",
    "region": "المنطقة",
    "valid_from": "صالح منذ",
    "valid_until": "صالح حتى",
    "cert_number": "رقم الشهادة",
    "not_found": "الشهادة غير موجودة",
    "not_found_desc": "رمز QR هذا غير صالح أو انتهت صلاحيته."
  }
}
```

**File:** `apps/public/messages/zgh.json` — ADD keys `valid_from` and `cert_type`:

```json
{
  "verify": {
    "title": "ⵙⵙⵉⵏ ⴰⵎⵙⴰⴷ",
    "status_granted": "ⵉⵜⵜⵓⵙⵏⵜⵍ",
    "status_revoked": "ⵉⵜⵜⵓⵙⵔⵔⵓ",
    "status_pending": "ⵉⵜⵜⵓⵙⴽⴰⵔ",
    "cooperative": "ⵜⴰⵡⵓⵔⵉ",
    "product_type": "ⴰⵏⴰⵡ ⵏ ⵓⵙⴽⵔ",
    "cert_type": "ⴰⵏⴰⵡ ⵏ ⵓⵎⵙⴰⴷ",
    "region": "ⵜⴰⵎⵏⴰⴹⵜ",
    "valid_from": "ⵉⵙⵉⵏ ⵙⴳ",
    "valid_until": "ⵉⵙⵉⵏ ⴰⵔ",
    "cert_number": "ⵓⵟⵟⵓⵏ ⵏ ⵓⵎⵙⴰⴷ",
    "not_found": "ⵓⵔ ⵉⵜⵜⵓⴼⵉ ⵓⵎⵙⴰⴷ",
    "not_found_desc": "QR ⴰⴷ ⵓⵔ ⵉⵙⵉⵏ."
  }
}
```

**Verification:** All 3 message files updated with `valid_from` and `cert_type` keys.

---

### Task 4 — Typecheck batch 1

```bash
pnpm --filter @terroir/public typecheck
```

**Expected:** 0 errors. Fix any before proceeding.

---

## Workstream B — Fix portal sidebar hardcoded locale links

**Pattern for every layout fix:**

1. Accept `params: { locale: string }` in the component signature.
2. Move `NAV` array inside the component body (so `locale` is in scope).
3. Replace `/fr/` prefix with `/${locale}/` in every href.
4. Fix `redirect('/fr/login')` → `redirect(\`/${locale}/login\`)`.

---

### Task 5 — Fix `(super-admin)/super-admin/layout.tsx`

**File:** `apps/portal/src/app/[locale]/(super-admin)/super-admin/layout.tsx` — MODIFY

```typescript
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function SuperAdminLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const session = await auth();
  if (!session) redirect(`/${locale}/login`);

  const NAV = [
    { href: `/${locale}/super-admin/cooperatives`, label: 'Coopératives' },
    { href: `/${locale}/super-admin/labs`, label: 'Laboratoires' },
    { href: `/${locale}/super-admin/specifications`, label: 'Spécifications SDOQ' },
    { href: `/${locale}/super-admin/settings`, label: 'Paramètres' },
    { href: `/${locale}/super-admin/settings/audit-log`, label: "Journal d'audit" },
  ];

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

**Verification:** File saved.

---

### Task 6 — Fix `(cooperative-admin)/cooperative-admin/layout.tsx`

**File:** `apps/portal/src/app/[locale]/(cooperative-admin)/cooperative-admin/layout.tsx` — MODIFY

```typescript
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function CooperativeAdminLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const session = await auth();
  if (!session) redirect(`/${locale}/login`);

  const NAV = [
    { href: `/${locale}/cooperative-admin`, label: 'Tableau de bord' },
    { href: `/${locale}/cooperative-admin/members`, label: 'Membres' },
    { href: `/${locale}/cooperative-admin/farms`, label: 'Fermes' },
    { href: `/${locale}/cooperative-admin/products`, label: 'Produits' },
    { href: `/${locale}/cooperative-admin/batches`, label: 'Lots de production' },
  ];

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
            <Link
              key={href}
              href={href}
              className="rounded px-3 py-2 text-sm hover:bg-green-700"
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

**Verification:** File saved.

---

### Task 7 — Fix `(cooperative-member)/cooperative-member/layout.tsx`

**File:** `apps/portal/src/app/[locale]/(cooperative-member)/cooperative-member/layout.tsx` — MODIFY

```typescript
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function CooperativeMemberLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const session = await auth();
  if (!session) redirect(`/${locale}/login`);

  const NAV = [
    { href: `/${locale}/cooperative-member`, label: 'Mon espace' },
    { href: `/${locale}/cooperative-member/harvests`, label: 'Mes Récoltes' },
    { href: `/${locale}/cooperative-member/batches`, label: 'Mes Lots' },
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 bg-green-800 p-4 text-white">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-green-300">
          Membre
        </p>
        <p className="mb-6 truncate text-sm text-green-100">
          {session.user?.name ?? session.user?.email}
        </p>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="rounded px-3 py-2 text-sm hover:bg-green-600"
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

**Verification:** File saved.

---

### Task 8 — Fix `(inspector)/inspector/layout.tsx`

**File:** `apps/portal/src/app/[locale]/(inspector)/inspector/layout.tsx` — MODIFY

```typescript
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function InspectorLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const session = await auth();
  if (!session) redirect(`/${locale}/login`);

  const NAV = [
    { href: `/${locale}/inspector`, label: 'Tableau de bord' },
    { href: `/${locale}/inspector/inspections`, label: 'Mes Inspections' },
  ];

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
            <Link
              key={href}
              href={href}
              className="rounded px-3 py-2 text-sm hover:bg-amber-700"
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

**Verification:** File saved.

---

### Task 9 — Fix `(lab-technician)/lab-technician/layout.tsx`

**File:** `apps/portal/src/app/[locale]/(lab-technician)/lab-technician/layout.tsx` — MODIFY

```typescript
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function LabTechnicianLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const session = await auth();
  if (!session) redirect(`/${locale}/login`);

  const NAV = [
    { href: `/${locale}/lab-technician`, label: 'Tableau de bord' },
    { href: `/${locale}/lab-technician/queue`, label: "File d'attente" },
    { href: `/${locale}/lab-technician/submit`, label: 'Soumettre un test' },
  ];

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
            <Link
              key={href}
              href={href}
              className="rounded px-3 py-2 text-sm hover:bg-blue-700"
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

**Verification:** File saved.

---

### Task 10 — Fix `(certification-body)/certification-body/layout.tsx`

**File:** `apps/portal/src/app/[locale]/(certification-body)/certification-body/layout.tsx` — MODIFY

```typescript
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function CertificationBodyLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const session = await auth();
  if (!session) redirect(`/${locale}/login`);

  const NAV = [
    { href: `/${locale}/certification-body`, label: 'Tableau de bord' },
    { href: `/${locale}/certification-body/certifications`, label: 'Certifications' },
  ];

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
            <Link
              key={href}
              href={href}
              className="rounded px-3 py-2 text-sm hover:bg-purple-700"
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

**Verification:** File saved.

---

### Task 11 — Fix `(customs-agent)/customs-agent/layout.tsx`

**File:** `apps/portal/src/app/[locale]/(customs-agent)/customs-agent/layout.tsx` — MODIFY

```typescript
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function CustomsAgentLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const session = await auth();
  if (!session) redirect(`/${locale}/login`);

  const NAV = [
    { href: `/${locale}/customs-agent/export-documents`, label: "Documents d'export" },
  ];

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
            <Link
              key={href}
              href={href}
              className="rounded px-3 py-2 text-sm hover:bg-slate-600"
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

**Verification:** File saved.

---

### Task 12 — Typecheck batch 2

```bash
pnpm --filter @terroir/portal typecheck
```

**Expected:** 0 errors. Fix any before proceeding.

---

## Workstream C — Final verification + commit

### Task 13 — Lint + build both apps + commit + push

```bash
# Lint both apps
pnpm --filter @terroir/public lint
pnpm --filter @terroir/portal lint

# Build both apps
pnpm --filter @terroir/public build
pnpm --filter @terroir/portal build

# Commit terroir-ma-web
cd /c/Users/moham/justforfun/terroir-ma-web
git add apps/public/src/lib/api-public.ts
git add apps/public/src/app/[locale]/verify/[uuid]/page.tsx
git add apps/public/messages/fr.json apps/public/messages/ar.json apps/public/messages/zgh.json
git add "apps/portal/src/app/[locale]/(super-admin)/super-admin/layout.tsx"
git add "apps/portal/src/app/[locale]/(cooperative-admin)/cooperative-admin/layout.tsx"
git add "apps/portal/src/app/[locale]/(cooperative-member)/cooperative-member/layout.tsx"
git add "apps/portal/src/app/[locale]/(inspector)/inspector/layout.tsx"
git add "apps/portal/src/app/[locale]/(lab-technician)/lab-technician/layout.tsx"
git add "apps/portal/src/app/[locale]/(certification-body)/certification-body/layout.tsx"
git add "apps/portal/src/app/[locale]/(customs-agent)/customs-agent/layout.tsx"
git commit -m "feat(public): FE-S9 — typed QR verify page, i18n fix for all portal layouts"
git push

# Commit terroir-ma (plan)
cd /c/Users/moham/justforfun/terroir-ma
git add docs/plans/2026-04-23-FE-S9-consumer-qr-i18n-polish/
git commit -m "chore(session): save state 2026-04-23 — FE-S9 complete"
git push
```

**Expected:** 0 lint warnings, build passes for both apps, commits pushed.

---

## Files to Create/Modify

| File                                                  | Action                                                                  |
| ----------------------------------------------------- | ----------------------------------------------------------------------- |
| `apps/public/src/lib/api-public.ts`                   | Create — typed fetch helper with `QrVerificationData` types             |
| `apps/public/src/app/[locale]/verify/[uuid]/page.tsx` | Replace — richer display, status badge, validFrom/validUntil, cert type |
| `apps/public/messages/fr.json`                        | Modify — add `valid_from`, `cert_type`                                  |
| `apps/public/messages/ar.json`                        | Modify — add `valid_from`, `cert_type`                                  |
| `apps/public/messages/zgh.json`                       | Modify — add `valid_from`, `cert_type`                                  |
| `(super-admin)/super-admin/layout.tsx`                | Modify — locale from params                                             |
| `(cooperative-admin)/cooperative-admin/layout.tsx`    | Modify — locale from params                                             |
| `(cooperative-member)/cooperative-member/layout.tsx`  | Modify — locale from params                                             |
| `(inspector)/inspector/layout.tsx`                    | Modify — locale from params                                             |
| `(lab-technician)/lab-technician/layout.tsx`          | Modify — locale from params                                             |
| `(certification-body)/certification-body/layout.tsx`  | Modify — locale from params                                             |
| `(customs-agent)/customs-agent/layout.tsx`            | Modify — locale from params                                             |

**Total: 12 files — 8 SP**

---

## Key Bugs Fixed

| Bug                                                    | Location                  | Fix                                        |
| ------------------------------------------------------ | ------------------------- | ------------------------------------------ |
| Wrong API path `/verify/:uuid` (missing `/api/v1`)     | `apps/public` verify page | Use `/api/v1/verify/:uuid?lang=`           |
| `body.data` mapped as flat `CertificationVerification` | verify page               | Read `body.data.certification.*` correctly |
| Hardcoded `/fr/` in 7 portal sidebar NAVs              | all role layouts          | Use `params.locale`                        |
| Hardcoded `/fr/login` redirects                        | all role layouts          | Use `` `/${locale}/login` ``               |
| Missing `valid_from`, `cert_type` i18n keys            | public messages           | Added to fr/ar/zgh                         |
