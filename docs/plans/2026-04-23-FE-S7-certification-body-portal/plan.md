# FE-S7 — Certification-Body Portal Implementation Plan

> **For Claude:** Use /execute to implement this plan task-by-task.

**Goal:** Build all certification-body pages under `(certification-body)/certification-body/` — dashboard with live stats, paginated certifications list, full certification detail with grant/deny/start-review/revoke decision forms, and PDF certificate link.

**Architecture:**

- Next.js 14 App Router — RSC for all list/detail pages, Client Components only for interactive forms
- Server Actions for all mutations (grant, deny, startReview, startFinalReview, revoke)
- `apiFetch<T>` from `@/lib/api-server` with Bearer token via `getAccessToken()`
- Sidebar: purple theme (already in layout), 2 working NAV links for FE-S7

**Tech Stack:** Next.js 14, TypeScript 5.4 strict, Tailwind CSS v3, shadcn/ui, Server Actions, `apiFetch`

**Modules Affected:** `apps/portal` (frontend only — no backend changes needed)

**Estimated Story Points:** 13

---

## Backend Endpoints Used (all already implemented)

| Endpoint                                        | Method | Role               | Purpose                                                      |
| ----------------------------------------------- | ------ | ------------------ | ------------------------------------------------------------ |
| `/api/v1/certifications/pending`                | GET    | certification-body | Paginated actionable list (SUBMITTED → UNDER_REVIEW)         |
| `/api/v1/certifications/analytics`              | GET    | certification-body | Stats breakdown by region / product type                     |
| `/api/v1/certifications/:id`                    | GET    | any authenticated  | Full certification entity                                    |
| `/api/v1/certifications/:id/grant`              | PATCH  | certification-body | Grant — body: `{ validFrom, validUntil }` (ISO date strings) |
| `/api/v1/certifications/:id/deny`               | PATCH  | certification-body | Deny — body: `{ reason }` (min 10 chars)                     |
| `/api/v1/certifications/:id/start-review`       | POST   | certification-body | Step 2 — body: `{ remarks? }`                                |
| `/api/v1/certifications/:id/start-final-review` | POST   | certification-body | Step 8 — no body                                             |
| `/api/v1/certifications/:id/revoke`             | PATCH  | certification-body | Revoke — body: `{ reason }`                                  |
| `/api/v1/certifications/:id/certificate.pdf`    | GET    | certification-body | PDF download — only for GRANTED / RENEWED                    |

---

## Certification Status Machine (relevant states for cert-body)

```
SUBMITTED → [start-review] → DOCUMENT_REVIEW
DOCUMENT_REVIEW → (schedule-inspection — FE-S10 scope)
LAB_RESULTS_RECEIVED → [start-final-review] → UNDER_REVIEW
UNDER_REVIEW → [grant] → GRANTED | [deny] → DENIED
GRANTED → [revoke] → REVOKED
```

**Conditional actions by status:**

- `SUBMITTED` → show "Démarrer l'examen" button
- `DOCUMENT_REVIEW` → info only (inspection scheduling is FE-S10 scope)
- `LAB_RESULTS_RECEIVED` → show "Démarrer examen final" button
- `UNDER_REVIEW` → show GrantForm + DenyForm
- `GRANTED` / `RENEWED` → show certificate section + "Révoquer" button
- All others → read-only

---

## Dashboard Stats Strategy

- Pending count: `GET /certifications/pending?page=1&limit=1` → `meta.total`
- Granted / Denied / Revoked totals: sum `byRegion[i].granted | denied | revoked` from `GET /certifications/analytics`
- Both calls run in `Promise.all` — single render pass

---

## Files Created / Modified (8 files)

| #   | File                                                                             | Action                                                              |
| --- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | `(certification-body)/certification-body/layout.tsx`                             | Modified — NAV trimmed to 2 working links                           |
| 2   | `(certification-body)/certification-body/page.tsx`                               | Replaced — real RSC dashboard with 4 stat cards                     |
| 3   | `(certification-body)/certification-body/certifications/page.tsx`                | Created — RSC pending list                                          |
| 4   | `(certification-body)/certification-body/certifications/actions.ts`              | Created — 5 Server Actions                                          |
| 5   | `(certification-body)/certification-body/certifications/[id]/page.tsx`           | Created — RSC detail page                                           |
| 6   | `(certification-body)/certification-body/certifications/[id]/grant-form.tsx`     | Created — client grant form                                         |
| 7   | `(certification-body)/certification-body/certifications/[id]/deny-form.tsx`      | Created — client deny form                                          |
| 8   | `(certification-body)/certification-body/certifications/[id]/action-buttons.tsx` | Created — client start-review / start-final-review / revoke buttons |

---

## Routes Added (3 new → 38 portal total)

| Route                                     | Type           | Purpose                      |
| ----------------------------------------- | -------------- | ---------------------------- |
| `/certification-body` (dashboard)         | RSC — replaced | 4 stat cards (live data)     |
| `/certification-body/certifications`      | RSC — new      | Pending certifications list  |
| `/certification-body/certifications/[id]` | RSC — new      | Full detail + decision forms |

---

## Tasks

### Batch 1 — Layout + Dashboard (Tasks 1–3)

#### Task 1 — Update `layout.tsx` — trim NAV to 2 implemented links

**File:** `apps/portal/src/app/[locale]/(certification-body)/certification-body/layout.tsx`

Replace the NAV array to only list pages that exist after FE-S7. Remove `qrcodes` and `export-documents` (no pages yet — avoids 404 links).

```tsx
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

const NAV = [
  { href: '/fr/certification-body', label: 'Tableau de bord' },
  { href: '/fr/certification-body/certifications', label: 'Certifications' },
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

#### Task 2 — Replace `page.tsx` — dashboard RSC with 4 stat cards

**File:** `apps/portal/src/app/[locale]/(certification-body)/certification-body/page.tsx`

Strategy:

- `Promise.all` → `GET /certifications/pending?page=1&limit=1` + `GET /certifications/analytics`
- Pending count from `pendingRes.meta.total`
- Granted / Denied / Revoked: sum across `analyticsRes.data.byRegion`
- try/catch → fallback to zeros so dashboard never crashes

```tsx
import { apiFetch } from '@/lib/api-server';
import { PageHeader } from '@/components/admin/page-header';

type PendingMeta = { meta: { total: number } };
type RegionRow = { granted: number; denied: number; revoked: number; total: number };
type Analytics = { data: { byRegion: RegionRow[] } };

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-lg border bg-white p-6 shadow-sm`}>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

export default async function CertificationBodyHome() {
  let pending = 0;
  let granted = 0;
  let denied = 0;
  let revoked = 0;

  try {
    const [pendingRes, analyticsRes] = await Promise.all([
      apiFetch<PendingMeta>('/api/v1/certifications/pending?page=1&limit=1'),
      apiFetch<Analytics>('/api/v1/certifications/analytics'),
    ]);
    pending = pendingRes.meta?.total ?? 0;
    const regions: RegionRow[] = analyticsRes.data?.byRegion ?? [];
    granted = regions.reduce((s, r) => s + (r.granted ?? 0), 0);
    denied = regions.reduce((s, r) => s + (r.denied ?? 0), 0);
    revoked = regions.reduce((s, r) => s + (r.revoked ?? 0), 0);
  } catch {
    // backend offline during dev — show zeros
  }

  return (
    <div>
      <PageHeader title="Tableau de bord" subtitle="Organisme de Certification — Terroir.ma" />
      <div className="mt-6 grid grid-cols-2 gap-6 md:grid-cols-4">
        <StatCard label="En attente" value={pending} color="text-purple-700" />
        <StatCard label="Accordées" value={granted} color="text-green-700" />
        <StatCard label="Refusées" value={denied} color="text-red-700" />
        <StatCard label="Révoquées" value={revoked} color="text-gray-700" />
      </div>
    </div>
  );
}
```

#### Task 3 — Typecheck batch 1

```bash
cd C:/Users/moham/justforfun/terroir-ma-web
pnpm --filter @terroir/portal typecheck
```

Expected: 0 errors.

---

### Batch 2 — Certifications List + Server Actions (Tasks 4–6)

#### Task 4 — Create `certifications/page.tsx` — RSC pending list

**File:** `apps/portal/src/app/[locale]/(certification-body)/certification-body/certifications/page.tsx`

- `GET /api/v1/certifications/pending?page=N&limit=20`
- Response shape: `{ data: Certification[], meta: { page, limit, total } }`
- Columns: certification number (or "—"), cooperative name, product type, region, status badge, requested date, "Examiner →" link
- Pagination: Previous / Next links via `?page=` query param

```tsx
import { apiFetch } from '@/lib/api-server';
import { PageHeader } from '@/components/admin/page-header';
import { StatusBadge } from '@/components/admin/status-badge';
import Link from 'next/link';

type Certification = {
  id: string;
  certificationNumber: string | null;
  cooperativeName: string;
  productTypeCode: string;
  regionCode: string;
  currentStatus: string;
  requestedAt: string;
};

type PagedResult = {
  data: Certification[];
  meta: { page: number; limit: number; total: number };
};

export default async function CertificationsListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? '1', 10));

  let result: PagedResult = { data: [], meta: { page: 1, limit: 20, total: 0 } };
  try {
    result = await apiFetch<PagedResult>(`/api/v1/certifications/pending?page=${page}&limit=20`);
  } catch {
    return <p className="text-red-600">Backend indisponible.</p>;
  }

  const { data: certs, meta } = result;
  const totalPages = Math.ceil(meta.total / meta.limit);

  return (
    <div>
      <PageHeader
        title="Demandes de certification"
        subtitle={`${meta.total} demande(s) en attente`}
      />

      <div className="mt-6 overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['N° Certification', 'Coopérative', 'Type', 'Région', 'Statut', 'Déposé le', ''].map(
                (h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-700">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y">
            {certs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  Aucune demande en attente.
                </td>
              </tr>
            )}
            {certs.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs">
                  {c.certificationNumber ?? c.id.slice(0, 8) + '…'}
                </td>
                <td className="px-4 py-3">{c.cooperativeName}</td>
                <td className="px-4 py-3">{c.productTypeCode}</td>
                <td className="px-4 py-3">{c.regionCode}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={c.currentStatus} />
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(c.requestedAt).toLocaleDateString('fr-MA')}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/fr/certification-body/certifications/${c.id}`}
                    className="font-medium text-purple-700 hover:underline"
                  >
                    Examiner →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-gray-500">
            Page {meta.page} / {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`?page=${page - 1}`}
                className="rounded border px-3 py-1 hover:bg-gray-50"
              >
                ← Précédent
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`?page=${page + 1}`}
                className="rounded border px-3 py-1 hover:bg-gray-50"
              >
                Suivant →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

#### Task 5 — Create `certifications/actions.ts` — 5 Server Actions

**File:** `apps/portal/src/app/[locale]/(certification-body)/certification-body/certifications/actions.ts`

```ts
'use server';

import { apiFetch } from '@/lib/api-server';
import { revalidatePath } from 'next/cache';

export async function grantCertification(
  id: string,
  validFrom: string,
  validUntil: string,
): Promise<{ error?: string }> {
  try {
    await apiFetch(`/api/v1/certifications/${id}/grant`, {
      method: 'PATCH',
      body: JSON.stringify({ validFrom, validUntil }),
    });
    revalidatePath('/fr/certification-body/certifications');
    revalidatePath(`/fr/certification-body/certifications/${id}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur serveur' };
  }
}

export async function denyCertification(id: string, reason: string): Promise<{ error?: string }> {
  try {
    await apiFetch(`/api/v1/certifications/${id}/deny`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
    revalidatePath('/fr/certification-body/certifications');
    revalidatePath(`/fr/certification-body/certifications/${id}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur serveur' };
  }
}

export async function startReview(id: string, remarks?: string): Promise<{ error?: string }> {
  try {
    await apiFetch(`/api/v1/certifications/${id}/start-review`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
    revalidatePath(`/fr/certification-body/certifications/${id}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur serveur' };
  }
}

export async function startFinalReview(id: string): Promise<{ error?: string }> {
  try {
    await apiFetch(`/api/v1/certifications/${id}/start-final-review`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    revalidatePath(`/fr/certification-body/certifications/${id}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur serveur' };
  }
}

export async function revokeCertification(id: string, reason: string): Promise<{ error?: string }> {
  try {
    await apiFetch(`/api/v1/certifications/${id}/revoke`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
    revalidatePath('/fr/certification-body/certifications');
    revalidatePath(`/fr/certification-body/certifications/${id}`);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur serveur' };
  }
}
```

#### Task 6 — Typecheck batch 2

```bash
pnpm --filter @terroir/portal typecheck
```

Expected: 0 errors.

---

### Batch 3 — Certification Detail Page (Tasks 7–9)

#### Task 7 — Create `certifications/[id]/page.tsx` — RSC detail

**File:** `apps/portal/src/app/[locale]/(certification-body)/certification-body/certifications/[id]/page.tsx`

- `GET /api/v1/certifications/:id` — full entity
- 4 stat cards: Status, Type certif., Région, Coopérative
- Dates row: requested, granted (if any), valid from/until (if GRANTED/RENEWED)
- Denial section: if DENIED, show `denialReason`
- Revocation section: if REVOKED, show `revocationReason`
- Certificate section: if GRANTED or RENEWED — show `certificationNumber` + PDF download link
- Action section: conditional by `currentStatus` — renders `GrantForm`, `DenyForm`, `ActionButtons`

```tsx
import { apiFetch } from '@/lib/api-server';
import { PageHeader } from '@/components/admin/page-header';
import { StatusBadge } from '@/components/admin/status-badge';
import Link from 'next/link';
import { GrantForm } from './grant-form';
import { DenyForm } from './deny-form';
import { ActionButtons } from './action-buttons';

type Certification = {
  id: string;
  certificationNumber: string | null;
  cooperativeName: string;
  productTypeCode: string;
  certificationType: string;
  regionCode: string;
  currentStatus: string;
  requestedAt: string;
  grantedAt: string | null;
  validFrom: string | null;
  validUntil: string | null;
  deniedAt: string | null;
  denialReason: string | null;
  revokedAt: string | null;
  revocationReason: string | null;
};

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <div className="mt-1 text-sm font-semibold text-gray-800">{value}</div>
    </div>
  );
}

const GRANTED_STATUSES = ['GRANTED', 'RENEWED'];

export default async function CertificationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let cert: Certification | null = null;
  try {
    cert = await apiFetch<Certification>(`/api/v1/certifications/${id}`);
  } catch {
    return <p className="text-red-600">Certification introuvable ou backend indisponible.</p>;
  }

  if (!cert) return <p className="text-red-600">Certification introuvable.</p>;

  const isGranted = GRANTED_STATUSES.includes(cert.currentStatus);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Link
          href="/fr/certification-body/certifications"
          className="text-sm text-purple-700 hover:underline"
        >
          ← Retour à la liste
        </Link>
      </div>

      <PageHeader
        title={cert.certificationNumber ?? `Certification — ${id.slice(0, 8)}…`}
        subtitle={`${cert.cooperativeName} · ${cert.productTypeCode}`}
      />

      {/* Stat cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 rounded-lg border bg-white p-6 shadow-sm md:grid-cols-4">
        <Stat label="Statut" value={<StatusBadge status={cert.currentStatus} />} />
        <Stat label="Type" value={cert.certificationType} />
        <Stat label="Région" value={cert.regionCode} />
        <Stat label="Coopérative" value={cert.cooperativeName} />
      </div>

      {/* Dates */}
      <div className="mb-8 grid grid-cols-2 gap-4 rounded-lg border bg-white p-6 shadow-sm md:grid-cols-4">
        <Stat label="Déposé le" value={new Date(cert.requestedAt).toLocaleDateString('fr-MA')} />
        <Stat
          label="Accordé le"
          value={cert.grantedAt ? new Date(cert.grantedAt).toLocaleDateString('fr-MA') : '—'}
        />
        <Stat label="Valide du" value={cert.validFrom ?? '—'} />
        <Stat label="Valide jusqu'au" value={cert.validUntil ?? '—'} />
      </div>

      {/* Denial info */}
      {cert.currentStatus === 'DENIED' && cert.denialReason && (
        <div className="mb-8 rounded-lg border border-red-200 bg-red-50 p-6">
          <h2 className="mb-2 text-base font-semibold text-red-800">Motif de refus</h2>
          <p className="text-sm text-red-700">{cert.denialReason}</p>
        </div>
      )}

      {/* Revocation info */}
      {cert.currentStatus === 'REVOKED' && cert.revocationReason && (
        <div className="mb-8 rounded-lg border border-gray-200 bg-gray-50 p-6">
          <h2 className="mb-2 text-base font-semibold text-gray-800">Motif de révocation</h2>
          <p className="text-sm text-gray-700">{cert.revocationReason}</p>
        </div>
      )}

      {/* Certificate section — GRANTED or RENEWED only */}
      {isGranted && cert.certificationNumber && (
        <div className="mb-8 rounded-lg border border-green-200 bg-green-50 p-6">
          <h2 className="mb-3 text-base font-semibold text-green-800">Certificat émis</h2>
          <p className="mb-1 font-mono text-sm font-bold text-green-900">
            {cert.certificationNumber}
          </p>
          <p className="mb-4 text-sm text-green-700">
            Valable du {cert.validFrom} au {cert.validUntil}
          </p>
          <a
            href={`/api/v1/certifications/${id}/certificate.pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
          >
            Télécharger le certificat PDF →
          </a>
        </div>
      )}

      {/* Action section — conditional by status */}
      <div className="space-y-6">
        {cert.currentStatus === 'UNDER_REVIEW' && (
          <>
            <GrantForm certificationId={id} />
            <DenyForm certificationId={id} />
          </>
        )}
        <ActionButtons certificationId={id} currentStatus={cert.currentStatus} />
      </div>
    </div>
  );
}
```

#### Task 8 — Create `certifications/[id]/grant-form.tsx` — client grant form

**File:** `apps/portal/src/app/[locale]/(certification-body)/certification-body/certifications/[id]/grant-form.tsx`

- validFrom date input (required)
- validUntil date input (required)
- Calls `grantCertification(id, validFrom, validUntil)` SA
- On success: redirect to list page

```tsx
'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { grantCertification } from '../actions';

export function GrantForm({ certificationId }: { certificationId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const validFrom = fd.get('validFrom') as string;
    const validUntil = fd.get('validUntil') as string;
    setError(null);

    startTransition(async () => {
      const res = await grantCertification(certificationId, validFrom, validUntil);
      if (res.error) {
        setError(res.error);
      } else {
        router.push('/fr/certification-body/certifications');
      }
    });
  }

  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-6">
      <h2 className="mb-4 text-base font-semibold text-green-800">Accorder la certification</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Valide du <span className="text-red-500">*</span>
            </label>
            <input
              name="validFrom"
              type="date"
              required
              className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Valide jusqu'au <span className="text-red-500">*</span>
            </label>
            <input
              name="validUntil"
              type="date"
              required
              className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="rounded bg-green-700 px-6 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {pending ? 'Traitement…' : '✅ Accorder la certification'}
        </button>
      </form>
    </div>
  );
}
```

#### Task 9 — Typecheck + lint batch 3

```bash
pnpm --filter @terroir/portal typecheck
pnpm --filter @terroir/portal lint
```

Expected: 0 errors, 0 warnings.

---

### Batch 4 — Deny Form + Action Buttons (Tasks 10–12)

#### Task 10 — Create `certifications/[id]/deny-form.tsx` — client deny form

**File:** `apps/portal/src/app/[locale]/(certification-body)/certification-body/certifications/[id]/deny-form.tsx`

- reason textarea (required, minLength 10 enforced client-side)
- Calls `denyCertification(id, reason)` SA
- On success: redirect to list page

```tsx
'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { denyCertification } from '../actions';

export function DenyForm({ certificationId }: { certificationId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const reason = (fd.get('reason') as string).trim();

    if (reason.length < 10) {
      setError('Le motif doit comporter au moins 10 caractères.');
      return;
    }
    setError(null);

    startTransition(async () => {
      const res = await denyCertification(certificationId, reason);
      if (res.error) {
        setError(res.error);
      } else {
        router.push('/fr/certification-body/certifications');
      }
    });
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6">
      <h2 className="mb-4 text-base font-semibold text-red-800">Refuser la certification</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Motif du refus <span className="text-red-500">*</span>
          </label>
          <textarea
            name="reason"
            required
            minLength={10}
            rows={4}
            placeholder="Expliquez les raisons du refus (min. 10 caractères)…"
            className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
          />
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="rounded bg-red-700 px-6 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
        >
          {pending ? 'Traitement…' : '❌ Refuser la certification'}
        </button>
      </form>
    </div>
  );
}
```

#### Task 11 — Create `certifications/[id]/action-buttons.tsx` — start-review / start-final-review / revoke

**File:** `apps/portal/src/app/[locale]/(certification-body)/certification-body/certifications/[id]/action-buttons.tsx`

- `SUBMITTED` → "Démarrer l'examen" (startReview SA, no body)
- `LAB_RESULTS_RECEIVED` → "Démarrer examen final" (startFinalReview SA)
- `GRANTED` / `RENEWED` → inline revoke form with reason textarea
- All buttons use `useTransition` for pending state

```tsx
'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { startReview, startFinalReview, revokeCertification } from '../actions';

interface ActionButtonsProps {
  certificationId: string;
  currentStatus: string;
}

export function ActionButtons({ certificationId, currentStatus }: ActionButtonsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showRevokeForm, setShowRevokeForm] = useState(false);

  function run(action: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  function handleRevoke(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const reason = (fd.get('revokeReason') as string).trim();
    if (reason.length < 5) {
      setError('Motif trop court.');
      return;
    }
    run(() => revokeCertification(certificationId, reason));
    setShowRevokeForm(false);
  }

  return (
    <div className="space-y-4">
      {currentStatus === 'SUBMITTED' && (
        <button
          onClick={() => run(() => startReview(certificationId))}
          disabled={pending}
          className="rounded bg-purple-700 px-6 py-2 text-sm font-medium text-white hover:bg-purple-800 disabled:opacity-50"
        >
          {pending ? 'Traitement…' : "🔍 Démarrer l'examen documentaire"}
        </button>
      )}

      {currentStatus === 'LAB_RESULTS_RECEIVED' && (
        <button
          onClick={() => run(() => startFinalReview(certificationId))}
          disabled={pending}
          className="rounded bg-purple-700 px-6 py-2 text-sm font-medium text-white hover:bg-purple-800 disabled:opacity-50"
        >
          {pending ? 'Traitement…' : "🔬 Démarrer l'examen final"}
        </button>
      )}

      {(currentStatus === 'GRANTED' || currentStatus === 'RENEWED') && (
        <div>
          {!showRevokeForm ? (
            <button
              onClick={() => setShowRevokeForm(true)}
              className="rounded border border-gray-400 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Révoquer la certification
            </button>
          ) : (
            <form
              onSubmit={handleRevoke}
              className="space-y-3 rounded-lg border bg-white p-4 shadow-sm"
            >
              <p className="text-sm font-medium text-gray-700">Motif de révocation</p>
              <textarea
                name="revokeReason"
                required
                rows={3}
                placeholder="Raison de la révocation…"
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-900 disabled:opacity-50"
                >
                  {pending ? 'Traitement…' : 'Confirmer la révocation'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRevokeForm(false)}
                  className="rounded border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Annuler
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
```

#### Task 12 — Typecheck + lint batch 4

```bash
pnpm --filter @terroir/portal typecheck
pnpm --filter @terroir/portal lint
```

Expected: 0 errors, 0 warnings.

---

### Batch 5 — Build + Commit + Push (Task 13)

#### Task 13 — Full build verification + commit + push

```bash
# 1. Full build
cd C:/Users/moham/justforfun/terroir-ma-web
pnpm --filter @terroir/portal build

# Expected: 38 routes compiled, 0 errors
# Verify in output: certification-body, certification-body/certifications, certification-body/certifications/[id]

# 2. Commit (terroir-ma-web)
cd C:/Users/moham/justforfun/terroir-ma-web
git add apps/portal/src/app/\[locale\]/\(certification-body\)/
git commit -m "feat(certification-body): add FE-S7 portal — certifications list, detail, grant/deny/revoke forms"

# 3. Push
git push origin main

# 4. Session commit (terroir-ma)
cd C:/Users/moham/justforfun/terroir-ma
git add docs/plans/2026-04-23-FE-S7-certification-body-portal/
git commit -m "chore(session): save state 2026-04-23 — FE-S7 complete"
```

---

## Summary

| Batch | Tasks | Deliverable                                                        |
| ----- | ----- | ------------------------------------------------------------------ |
| 1     | 1–3   | Layout NAV + dashboard stat cards                                  |
| 2     | 4–6   | Certifications pending list + 5 Server Actions                     |
| 3     | 7–9   | Certification detail RSC + GrantForm                               |
| 4     | 10–12 | DenyForm + ActionButtons (startReview / startFinalReview / revoke) |
| 5     | 13    | `next build` + commit + push                                       |

**Routes after FE-S7:** 38 (was 35)
**Files created/modified:** 8
**Story Points:** 13 / 13
