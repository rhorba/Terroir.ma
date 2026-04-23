# FE-S8 — Cooperative-Member Portal Implementation Plan

> **For Claude:** Use /execute to implement this plan task-by-task.

**Goal:** Build all cooperative-member pages under `(cooperative-member)/cooperative-member/` — dashboard with live counts, harvest list + log-harvest form, batch list + create-batch form.

**Architecture:**

- Next.js 14 App Router — RSC for list/prefetch pages, Client Components for forms
- Server Actions for mutations (logHarvest, createBatch)
- `apiFetch<T>` + `getCooperativeId()` from `@/lib/auth-utils` — cooperativeId scoped from Keycloak JWT
- Sidebar: green theme (already in layout), 3 NAV links after FE-S8

**Tech Stack:** Next.js 14, TypeScript 5.4 strict, Tailwind CSS v3, Server Actions, `apiFetch`

**Modules Affected:** `apps/portal` (frontend only — no backend changes needed)

**Estimated Story Points:** 13

---

## Backend Endpoints Used (all already implemented)

| Endpoint                               | Method | Role               | Purpose                                           |
| -------------------------------------- | ------ | ------------------ | ------------------------------------------------- |
| `GET /api/v1/harvests/cooperative/:id` | GET    | cooperative-member | List all harvests for cooperative (returns array) |
| `POST /api/v1/harvests`                | POST   | cooperative-member | Log a new harvest                                 |
| `GET /api/v1/batches/cooperative/:id`  | GET    | cooperative-member | List all batches for cooperative (returns array)  |
| `POST /api/v1/batches`                 | POST   | cooperative-member | Create a new production batch                     |
| `GET /api/v1/cooperatives/:id/farms`   | GET    | cooperative-member | List farms (for harvest form farmId select)       |
| `GET /api/v1/product-types?limit=100`  | GET    | any authenticated  | List product types (for selects)                  |

---

## DTO Shapes (for Server Actions)

**POST /harvests** body:

```ts
{
  farmId: string;          // UUID — from farms select
  productTypeCode: string; // e.g. "ARGAN_OIL"
  quantityKg: number;      // min 0.1, max 1_000_000
  harvestDate: string;     // ISO date "YYYY-MM-DD"
  campaignYear: string;    // "YYYY/YYYY" format
  method: string;          // min 2, max 100 chars
  metadata?: Record<string, unknown>;
}
```

**POST /batches** body:

```ts
{
  productTypeCode: string;  // e.g. "ARGAN_OIL"
  harvestIds: string[];     // min 1 harvest ID
  totalQuantityKg: number;  // min 0.1, max 10_000_000
  processingDate: string;   // ISO date "YYYY-MM-DD"
}
```

---

## Auth Context

- `getCooperativeId()` from `@/lib/auth-utils` → returns `string | null` (the cooperative's UUID from Keycloak JWT)
- RSC pages call `getCooperativeId()` server-side, pass cooperativeId as prop/fetch param
- If null (dev without Keycloak): show graceful fallback — never crash

---

## Files Created / Modified (10 files)

| #   | File                                                                        | Action                                              |
| --- | --------------------------------------------------------------------------- | --------------------------------------------------- |
| 1   | `(cooperative-member)/cooperative-member/layout.tsx`                        | Modified — add dashboard NAV link                   |
| 2   | `(cooperative-member)/cooperative-member/page.tsx`                          | Replaced — RSC dashboard with 2 stat cards          |
| 3   | `(cooperative-member)/cooperative-member/harvests/page.tsx`                 | Created — RSC harvest list                          |
| 4   | `(cooperative-member)/cooperative-member/harvests/actions.ts`               | Created — `logHarvest` SA                           |
| 5   | `(cooperative-member)/cooperative-member/harvests/new/page.tsx`             | Created — RSC prefetch farms + types → renders form |
| 6   | `(cooperative-member)/cooperative-member/harvests/new/log-harvest-form.tsx` | Created — client form                               |
| 7   | `(cooperative-member)/cooperative-member/batches/page.tsx`                  | Created — RSC batch list                            |
| 8   | `(cooperative-member)/cooperative-member/batches/actions.ts`                | Created — `createBatch` SA                          |
| 9   | `(cooperative-member)/cooperative-member/batches/new/page.tsx`              | Created — RSC prefetch harvests + types             |
| 10  | `(cooperative-member)/cooperative-member/batches/new/create-batch-form.tsx` | Created — client form with harvest checkboxes       |

---

## Routes Added (4 new → 42 portal total)

| Route                              | Type           | Purpose                          |
| ---------------------------------- | -------------- | -------------------------------- |
| `/cooperative-member` (dashboard)  | RSC — replaced | 2 stat cards: harvests + batches |
| `/cooperative-member/harvests`     | RSC — new      | List all member harvests         |
| `/cooperative-member/harvests/new` | Client — new   | Log a new harvest                |
| `/cooperative-member/batches`      | RSC — new      | List all member batches          |
| `/cooperative-member/batches/new`  | Client — new   | Create a new batch               |

_(dashboard updated, 4 new routes → +4)_

---

## Tasks

### Batch 1 — Layout + Dashboard (Tasks 1–3)

#### Task 1 — Update `layout.tsx` — add dashboard NAV link

**File:** `apps/portal/src/app/[locale]/(cooperative-member)/cooperative-member/layout.tsx`

Add "Mon espace" as the first NAV entry (dashboard link). Keep existing harvests + batches links.

```tsx
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

const NAV = [
  { href: '/fr/cooperative-member', label: 'Mon espace' },
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

#### Task 2 — Replace `page.tsx` — RSC dashboard with 2 stat cards

**File:** `apps/portal/src/app/[locale]/(cooperative-member)/cooperative-member/page.tsx`

Strategy:

- `getCooperativeId()` → cooperativeId
- `Promise.all` → `GET /harvests/cooperative/:id` + `GET /batches/cooperative/:id`
- Both return arrays → `.length` for counts
- try/catch → zeros if backend offline

```tsx
import { apiFetch } from '@/lib/api-server';
import { getCooperativeId } from '@/lib/auth-utils';
import { PageHeader } from '@/components/admin/page-header';
import Link from 'next/link';

function StatCard({
  label,
  value,
  href,
  color,
}: {
  label: string;
  value: number;
  href: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
    >
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
      <p className="mt-1 text-xs text-gray-400">Voir →</p>
    </Link>
  );
}

export default async function CooperativeMemberHome() {
  const cooperativeId = await getCooperativeId();

  let harvestCount = 0;
  let batchCount = 0;

  if (cooperativeId) {
    try {
      const [harvests, batches] = await Promise.all([
        apiFetch<unknown[]>(`/api/v1/harvests/cooperative/${cooperativeId}`),
        apiFetch<unknown[]>(`/api/v1/batches/cooperative/${cooperativeId}`),
      ]);
      harvestCount = Array.isArray(harvests) ? harvests.length : 0;
      batchCount = Array.isArray(batches) ? batches.length : 0;
    } catch {
      // backend offline — show zeros
    }
  }

  return (
    <div>
      <PageHeader title="Mon espace" subtitle="Membre coopérative — Terroir.ma" />
      <div className="mt-6 grid grid-cols-2 gap-6">
        <StatCard
          label="Mes récoltes"
          value={harvestCount}
          href="/fr/cooperative-member/harvests"
          color="text-green-700"
        />
        <StatCard
          label="Mes lots"
          value={batchCount}
          href="/fr/cooperative-member/batches"
          color="text-emerald-700"
        />
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

### Batch 2 — Harvest List + Server Action (Tasks 4–6)

#### Task 4 — Create `harvests/page.tsx` — RSC harvest list

**File:** `apps/portal/src/app/[locale]/(cooperative-member)/cooperative-member/harvests/page.tsx`

- `getCooperativeId()` → cooperativeId
- `GET /harvests/cooperative/:id` → array of Harvest
- Columns: farm (farmId short), product type, quantity (kg), harvest date, campaign year, method
- "Saisir une récolte" button links to `/harvests/new`

```tsx
import { apiFetch } from '@/lib/api-server';
import { getCooperativeId } from '@/lib/auth-utils';
import { PageHeader } from '@/components/admin/page-header';
import Link from 'next/link';

type Harvest = {
  id: string;
  farmId: string;
  productTypeCode: string;
  quantityKg: number;
  harvestDate: string;
  campaignYear: string;
  method: string;
};

export default async function HarvestsPage() {
  const cooperativeId = await getCooperativeId();

  if (!cooperativeId) {
    return <p className="text-gray-500">Coopérative non configurée dans la session.</p>;
  }

  let harvests: Harvest[] = [];
  try {
    harvests = await apiFetch<Harvest[]>(`/api/v1/harvests/cooperative/${cooperativeId}`);
    if (!Array.isArray(harvests)) harvests = [];
  } catch {
    return <p className="text-red-600">Backend indisponible.</p>;
  }

  return (
    <div>
      <PageHeader
        title="Mes Récoltes"
        subtitle={`${harvests.length} récolte(s) enregistrée(s)`}
        action={
          <Link
            href="/fr/cooperative-member/harvests/new"
            className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
          >
            + Saisir une récolte
          </Link>
        }
      />

      <div className="mt-6 overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {[
                'Ferme',
                'Type produit',
                'Quantité (kg)',
                'Date récolte',
                'Campagne',
                'Méthode',
              ].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-gray-700">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {harvests.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Aucune récolte enregistrée. Commencez par saisir une récolte.
                </td>
              </tr>
            )}
            {harvests.map((h) => (
              <tr key={h.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs">{h.farmId.slice(0, 8)}…</td>
                <td className="px-4 py-3">{h.productTypeCode}</td>
                <td className="px-4 py-3">{Number(h.quantityKg).toFixed(2)}</td>
                <td className="px-4 py-3">{h.harvestDate}</td>
                <td className="px-4 py-3">{h.campaignYear}</td>
                <td className="px-4 py-3 text-gray-500">{h.method}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

#### Task 5 — Create `harvests/actions.ts` — `logHarvest` Server Action

**File:** `apps/portal/src/app/[locale]/(cooperative-member)/cooperative-member/harvests/actions.ts`

```ts
'use server';

import { apiFetch } from '@/lib/api-server';
import { revalidatePath } from 'next/cache';

export async function logHarvest(formData: {
  farmId: string;
  productTypeCode: string;
  quantityKg: number;
  harvestDate: string;
  campaignYear: string;
  method: string;
}): Promise<{ error?: string }> {
  try {
    await apiFetch('/api/v1/harvests', {
      method: 'POST',
      body: JSON.stringify(formData),
    });
    revalidatePath('/fr/cooperative-member/harvests');
    revalidatePath('/fr/cooperative-member');
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

### Batch 3 — Log Harvest Form (Tasks 7–9)

#### Task 7 — Create `harvests/new/page.tsx` — RSC prefetch + render form

**File:** `apps/portal/src/app/[locale]/(cooperative-member)/cooperative-member/harvests/new/page.tsx`

- `getCooperativeId()` → cooperativeId
- `Promise.all` → farms + product types
- Pass as props to `LogHarvestForm` client component

```tsx
import { getCooperativeId } from '@/lib/auth-utils';
import { apiFetch } from '@/lib/api-server';
import { PageHeader } from '@/components/admin/page-header';
import { LogHarvestForm } from './log-harvest-form';

type Farm = { id: string; name: string; regionCode: string };
type FarmsResponse = { data: Farm[] };
type ProductType = { id: string; code: string; nameFr: string };
type ProductTypesResponse = { data: ProductType[] };

export default async function NewHarvestPage() {
  const cooperativeId = await getCooperativeId();

  if (!cooperativeId) {
    return <p className="text-gray-500">Coopérative non configurée dans la session.</p>;
  }

  let farms: Farm[] = [];
  let productTypes: ProductType[] = [];

  try {
    const [farmsRes, ptRes] = await Promise.all([
      apiFetch<FarmsResponse>(`/api/v1/cooperatives/${cooperativeId}/farms?limit=100`),
      apiFetch<ProductTypesResponse>('/api/v1/product-types?limit=100'),
    ]);
    farms = farmsRes.data ?? [];
    productTypes = ptRes.data ?? [];
  } catch {
    return <p className="text-red-600">Impossible de charger les données. Backend indisponible.</p>;
  }

  return (
    <div>
      <PageHeader title="Saisir une récolte" subtitle="Enregistrez une nouvelle récolte" />
      <div className="mt-6">
        <LogHarvestForm farms={farms} productTypes={productTypes} />
      </div>
    </div>
  );
}
```

#### Task 8 — Create `harvests/new/log-harvest-form.tsx` — client form

**File:** `apps/portal/src/app/[locale]/(cooperative-member)/cooperative-member/harvests/new/log-harvest-form.tsx`

Fields:

- `farmId` — `<select>` from farms prop (id, name, regionCode)
- `productTypeCode` — `<select>` from productTypes prop (code, nameFr)
- `quantityKg` — `<input type="number" min="0.1" step="0.1">`
- `harvestDate` — `<input type="date">`
- `campaignYear` — `<input type="text" placeholder="2025/2026" pattern="\d{4}/\d{4}">`
- `method` — `<input type="text" placeholder="ex: cueillette manuelle">`
- On success: redirect to `/fr/cooperative-member/harvests`

```tsx
'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { logHarvest } from '../actions';

type Farm = { id: string; name: string; regionCode: string };
type ProductType = { id: string; code: string; nameFr: string };

export function LogHarvestForm({
  farms,
  productTypes,
}: {
  farms: Farm[];
  productTypes: ProductType[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);

    startTransition(async () => {
      const res = await logHarvest({
        farmId: fd.get('farmId') as string,
        productTypeCode: fd.get('productTypeCode') as string,
        quantityKg: parseFloat(fd.get('quantityKg') as string),
        harvestDate: fd.get('harvestDate') as string,
        campaignYear: fd.get('campaignYear') as string,
        method: fd.get('method') as string,
      });
      if (res.error) {
        setError(res.error);
      } else {
        router.push('/fr/cooperative-member/harvests');
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-2xl space-y-6 rounded-lg border bg-white p-6 shadow-sm"
    >
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Ferme <span className="text-red-500">*</span>
        </label>
        <select
          name="farmId"
          required
          className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">— Sélectionner une ferme —</option>
          {farms.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name} ({f.regionCode})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Type de produit <span className="text-red-500">*</span>
        </label>
        <select
          name="productTypeCode"
          required
          className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">— Sélectionner un type —</option>
          {productTypes.map((pt) => (
            <option key={pt.id} value={pt.code}>
              {pt.nameFr} ({pt.code})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Quantité (kg) <span className="text-red-500">*</span>
          </label>
          <input
            name="quantityKg"
            type="number"
            min="0.1"
            max="1000000"
            step="0.1"
            required
            placeholder="ex: 1250.5"
            className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Date de récolte <span className="text-red-500">*</span>
          </label>
          <input
            name="harvestDate"
            type="date"
            required
            className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Année de campagne <span className="text-red-500">*</span>
          </label>
          <input
            name="campaignYear"
            type="text"
            required
            placeholder="2025/2026"
            pattern="\d{4}/\d{4}"
            title="Format: AAAA/AAAA (ex: 2025/2026)"
            className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Méthode de récolte <span className="text-red-500">*</span>
          </label>
          <input
            name="method"
            type="text"
            required
            minLength={2}
            maxLength={100}
            placeholder="ex: cueillette manuelle"
            className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-green-700 px-6 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {pending ? 'Enregistrement…' : '🌿 Enregistrer la récolte'}
        </button>
        <a
          href="/fr/cooperative-member/harvests"
          className="rounded border px-6 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          Annuler
        </a>
      </div>
    </form>
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

### Batch 4 — Batch List + Create Batch (Tasks 10–12)

#### Task 10 — Create `batches/page.tsx` — RSC batch list

**File:** `apps/portal/src/app/[locale]/(cooperative-member)/cooperative-member/batches/page.tsx`

- `getCooperativeId()` → cooperativeId
- `GET /batches/cooperative/:id` → array of ProductionBatch
- Columns: batch number, product type, status badge, quantity (kg), processing date
- "Créer un lot" button → `/batches/new`

```tsx
import { apiFetch } from '@/lib/api-server';
import { getCooperativeId } from '@/lib/auth-utils';
import { PageHeader } from '@/components/admin/page-header';
import { StatusBadge } from '@/components/admin/status-badge';
import Link from 'next/link';

type Batch = {
  id: string;
  batchNumber: string;
  productTypeCode: string;
  status: string;
  totalQuantityKg: number;
  processingDate: string;
};

export default async function BatchesPage() {
  const cooperativeId = await getCooperativeId();

  if (!cooperativeId) {
    return <p className="text-gray-500">Coopérative non configurée dans la session.</p>;
  }

  let batches: Batch[] = [];
  try {
    batches = await apiFetch<Batch[]>(`/api/v1/batches/cooperative/${cooperativeId}`);
    if (!Array.isArray(batches)) batches = [];
  } catch {
    return <p className="text-red-600">Backend indisponible.</p>;
  }

  return (
    <div>
      <PageHeader
        title="Mes Lots"
        subtitle={`${batches.length} lot(s) enregistré(s)`}
        action={
          <Link
            href="/fr/cooperative-member/batches/new"
            className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
          >
            + Créer un lot
          </Link>
        }
      />

      <div className="mt-6 overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['N° Lot', 'Type produit', 'Statut', 'Quantité (kg)', 'Date traitement'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-gray-700">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {batches.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  Aucun lot créé. Commencez par créer un lot à partir de vos récoltes.
                </td>
              </tr>
            )}
            {batches.map((b) => (
              <tr key={b.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs">{b.batchNumber}</td>
                <td className="px-4 py-3">{b.productTypeCode}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={b.status} />
                </td>
                <td className="px-4 py-3">{Number(b.totalQuantityKg).toFixed(2)}</td>
                <td className="px-4 py-3">{b.processingDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

#### Task 11 — Create `batches/actions.ts` — `createBatch` Server Action

**File:** `apps/portal/src/app/[locale]/(cooperative-member)/cooperative-member/batches/actions.ts`

```ts
'use server';

import { apiFetch } from '@/lib/api-server';
import { revalidatePath } from 'next/cache';

export async function createBatch(formData: {
  productTypeCode: string;
  harvestIds: string[];
  totalQuantityKg: number;
  processingDate: string;
}): Promise<{ error?: string }> {
  try {
    await apiFetch('/api/v1/batches', {
      method: 'POST',
      body: JSON.stringify(formData),
    });
    revalidatePath('/fr/cooperative-member/batches');
    revalidatePath('/fr/cooperative-member');
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur serveur' };
  }
}
```

#### Task 12 — Create `batches/new/page.tsx` + `create-batch-form.tsx`

**File A:** `apps/portal/src/app/[locale]/(cooperative-member)/cooperative-member/batches/new/page.tsx`

RSC that prefetches:

- harvests for cooperative → to populate checkboxes
- product types → for select

```tsx
import { getCooperativeId } from '@/lib/auth-utils';
import { apiFetch } from '@/lib/api-server';
import { PageHeader } from '@/components/admin/page-header';
import { CreateBatchForm } from './create-batch-form';

type Harvest = {
  id: string;
  productTypeCode: string;
  quantityKg: number;
  harvestDate: string;
  farmId: string;
};

type ProductType = { id: string; code: string; nameFr: string };
type ProductTypesResponse = { data: ProductType[] };

export default async function NewBatchPage() {
  const cooperativeId = await getCooperativeId();

  if (!cooperativeId) {
    return <p className="text-gray-500">Coopérative non configurée dans la session.</p>;
  }

  let harvests: Harvest[] = [];
  let productTypes: ProductType[] = [];

  try {
    const [harvestsData, ptRes] = await Promise.all([
      apiFetch<Harvest[]>(`/api/v1/harvests/cooperative/${cooperativeId}`),
      apiFetch<ProductTypesResponse>('/api/v1/product-types?limit=100'),
    ]);
    harvests = Array.isArray(harvestsData) ? harvestsData : [];
    productTypes = ptRes.data ?? [];
  } catch {
    return <p className="text-red-600">Impossible de charger les données. Backend indisponible.</p>;
  }

  return (
    <div>
      <PageHeader title="Créer un lot" subtitle="Regroupez des récoltes en un lot de production" />
      <div className="mt-6">
        <CreateBatchForm harvests={harvests} productTypes={productTypes} />
      </div>
    </div>
  );
}
```

**File B:** `apps/portal/src/app/[locale]/(cooperative-member)/cooperative-member/batches/new/create-batch-form.tsx`

Fields:

- `productTypeCode` — `<select>` from productTypes
- `harvestIds` — checkbox list showing productType + qty + date for each harvest
- `totalQuantityKg` — number (auto-suggested as sum of checked harvests, but editable)
- `processingDate` — date input

```tsx
'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBatch } from '../actions';

type Harvest = {
  id: string;
  productTypeCode: string;
  quantityKg: number;
  harvestDate: string;
  farmId: string;
};

type ProductType = { id: string; code: string; nameFr: string };

export function CreateBatchForm({
  harvests,
  productTypes,
}: {
  harvests: Harvest[];
  productTypes: ProductType[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function toggleHarvest(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedTotal = harvests
    .filter((h) => selectedIds.has(h.id))
    .reduce((sum, h) => sum + Number(h.quantityKg), 0);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (selectedIds.size === 0) {
      setError('Sélectionnez au moins une récolte.');
      return;
    }
    const fd = new FormData(e.currentTarget);
    setError(null);

    startTransition(async () => {
      const res = await createBatch({
        productTypeCode: fd.get('productTypeCode') as string,
        harvestIds: Array.from(selectedIds),
        totalQuantityKg: parseFloat(fd.get('totalQuantityKg') as string),
        processingDate: fd.get('processingDate') as string,
      });
      if (res.error) {
        setError(res.error);
      } else {
        router.push('/fr/cooperative-member/batches');
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-2xl space-y-6 rounded-lg border bg-white p-6 shadow-sm"
    >
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Type de produit <span className="text-red-500">*</span>
        </label>
        <select
          name="productTypeCode"
          required
          className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">— Sélectionner un type —</option>
          {productTypes.map((pt) => (
            <option key={pt.id} value={pt.code}>
              {pt.nameFr} ({pt.code})
            </option>
          ))}
        </select>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-gray-700">
          Récoltes à inclure <span className="text-red-500">*</span>
          {selectedIds.size > 0 && (
            <span className="ml-2 text-xs text-green-700">
              ({selectedIds.size} sélectionnée(s) — {selectedTotal.toFixed(2)} kg)
            </span>
          )}
        </p>
        {harvests.length === 0 ? (
          <p className="text-sm text-gray-400">
            Aucune récolte disponible. Saisissez des récoltes d&apos;abord.
          </p>
        ) : (
          <div className="max-h-48 space-y-2 overflow-y-auto rounded border p-3">
            {harvests.map((h) => (
              <label
                key={h.id}
                className="flex cursor-pointer items-center gap-3 rounded px-2 py-1 hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(h.id)}
                  onChange={() => toggleHarvest(h.id)}
                  className="h-4 w-4 rounded border-gray-300 text-green-600"
                />
                <span className="text-sm">
                  <span className="font-medium">{h.productTypeCode}</span>
                  {' — '}
                  {Number(h.quantityKg).toFixed(2)} kg
                  {' · '}
                  <span className="text-gray-500">{h.harvestDate}</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Quantité totale (kg) <span className="text-red-500">*</span>
          </label>
          <input
            name="totalQuantityKg"
            type="number"
            min="0.1"
            step="0.01"
            required
            value={selectedTotal > 0 ? selectedTotal.toFixed(2) : ''}
            onChange={() => {}}
            placeholder="ex: 3800.75"
            className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {selectedTotal > 0 && (
            <p className="mt-1 text-xs text-green-600">
              Auto-calculé depuis les récoltes sélectionnées
            </p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Date de traitement <span className="text-red-500">*</span>
          </label>
          <input
            name="processingDate"
            type="date"
            required
            className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-green-700 px-6 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {pending ? 'Création…' : '📦 Créer le lot'}
        </button>
        <a
          href="/fr/cooperative-member/batches"
          className="rounded border px-6 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          Annuler
        </a>
      </div>
    </form>
  );
}
```

---

### Batch 5 — Typecheck + Lint + Build + Commit + Push (Task 13)

#### Task 13 — Final verification + commit + push

```bash
# 1. Typecheck
cd C:/Users/moham/justforfun/terroir-ma-web
pnpm --filter @terroir/portal typecheck
# Expected: 0 errors

# 2. Lint
pnpm --filter @terroir/portal lint
# Expected: 0 warnings

# 3. Full build
pnpm --filter @terroir/portal build
# Expected: 42 routes compiled
# Verify in output:
#   cooperative-member (dashboard)
#   cooperative-member/harvests
#   cooperative-member/harvests/new
#   cooperative-member/batches
#   cooperative-member/batches/new

# 4. Commit (terroir-ma-web)
cd C:/Users/moham/justforfun/terroir-ma-web
git add "apps/portal/src/app/[locale]/(cooperative-member)/"
git commit -m "feat(cooperative-member): add FE-S8 portal — harvest log, batch creation"

# 5. Push
git push origin main

# 6. Session commit (terroir-ma)
cd C:/Users/moham/justforfun/terroir-ma
git add docs/plans/2026-04-23-FE-S8-cooperative-member-portal/
git commit -m "chore(session): save state 2026-04-23 — FE-S8 complete"
```

---

## Summary

| Batch | Tasks | Deliverable                                                          |
| ----- | ----- | -------------------------------------------------------------------- |
| 1     | 1–3   | Layout NAV (3 links) + dashboard 2 stat cards                        |
| 2     | 4–6   | Harvests list RSC + `logHarvest` SA                                  |
| 3     | 7–9   | Log-harvest RSC prefetch page + client form                          |
| 4     | 10–12 | Batches list RSC + `createBatch` SA + create-batch RSC + client form |
| 5     | 13    | Typecheck + lint + build + commit + push                             |

**Routes after FE-S8:** 42 (was 38)
**Files created/modified:** 10
**Story Points:** 13 / 13
