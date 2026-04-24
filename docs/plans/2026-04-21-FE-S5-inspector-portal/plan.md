# FE-S5 — Inspector Portal Implementation Plan

> **For Claude:** Use /execute to implement this plan task-by-task.

**Goal:** Build all inspector-role pages under `(inspector)/inspector/` — inspection schedule list, inspection detail with report filing, and read-only batch/product views.

**Architecture:** Next.js RSC pages + Server Actions + `apiFetch` helper. No new backend work — all endpoints already exist (`/api/v1/inspections/my`, `/api/v1/inspections/{id}`, `PATCH /api/v1/inspections/{id}/report`, `/api/v1/batches/{id}`, `/api/v1/products/{id}`).

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Tailwind CSS, Server Components + Server Actions

**Modules Affected:** `apps/portal` only

**Estimated Story Points:** 13

---

## Existing Context (read before executing)

- Layout scaffold: `apps/portal/src/app/[locale]/(inspector)/inspector/layout.tsx` — amber sidebar, needs NAV expanded
- Placeholder dashboard: `apps/portal/src/app/[locale]/(inspector)/inspector/page.tsx` — replace fully
- Shared components: `@/components/admin/{page-header,data-table,status-badge,action-button,confirm-modal}`
- API helper: `@/lib/api-server` → `apiFetch<T>(path, init?)`
- Auth helpers: `@/lib/auth-utils` → `getAccessToken()`, `getRoles()`
- Pattern: RSC pages call `apiFetch`, client forms use `useTransition` + Server Actions, redirect to list after success
- Amber color theme for inspector (sidebar `bg-amber-900`, hover `hover:bg-amber-700`, accent `text-amber-300`)

---

## Inspection API shapes (inferred from types.gen.ts)

```ts
type Inspection = {
  id: string;
  certificationId: string;
  inspectorId: string;
  inspectorName: string | null;
  status: string; // SCHEDULED | IN_PROGRESS | COMPLETED
  scheduledDate: string;
  farmIds: string[];
  passed: boolean | null;
  reportSummary: string | null;
  detailedObservations: string | null;
  nonConformities: string | null;
  createdAt: string;
  updatedAt: string;
};

type PagedInspections = {
  success: boolean;
  data: Inspection[];
  meta: { page: number; limit: number; total: number };
};
```

```ts
// FileInspectionReportDto (from types.gen.ts)
type ReportPayload = {
  passed: boolean;
  reportSummary: string; // min 20 chars enforced by backend
  detailedObservations?: string;
  nonConformities?: string;
};
```

---

## Batch 1 — Layout + Dashboard (Tasks 1–3)

### Task 1 — Update `inspector/layout.tsx` with full NAV

**File:** `apps/portal/src/app/[locale]/(inspector)/inspector/layout.tsx`

Replace the entire file:

```tsx
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

const NAV = [
  { href: '/fr/inspector', label: 'Tableau de bord' },
  { href: '/fr/inspector/inspections', label: 'Mes Inspections' },
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

**Verification:** File saves, no TS errors.

---

### Task 2 — Replace `inspector/page.tsx` with stat dashboard

**File:** `apps/portal/src/app/[locale]/(inspector)/inspector/page.tsx`

Replace the entire file:

```tsx
import { apiFetch } from '@/lib/api-server';

type PagedInspections = {
  success: boolean;
  data: { status: string }[];
  meta: { total: number };
};

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-lg border p-6 shadow-sm ${color}`}>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-800">{value}</p>
    </div>
  );
}

export default async function InspectorDashboard() {
  let inspections: PagedInspections = { success: true, data: [], meta: { total: 0 } };
  try {
    inspections = await apiFetch<PagedInspections>('/api/v1/inspections/my?page=1&limit=100');
  } catch {
    // API unavailable in dev without backend
  }

  const all = inspections.data;
  const scheduled = all.filter((i) => i.status === 'SCHEDULED').length;
  const inProgress = all.filter((i) => i.status === 'IN_PROGRESS').length;
  const completed = all.filter((i) => i.status === 'COMPLETED').length;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-800">Tableau de bord — Inspecteur</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total" value={inspections.meta.total} color="bg-white" />
        <StatCard label="Planifiées" value={scheduled} color="bg-amber-50" />
        <StatCard label="En cours" value={inProgress} color="bg-blue-50" />
        <StatCard label="Terminées" value={completed} color="bg-green-50" />
      </div>
    </div>
  );
}
```

**Verification:** File saves, no TS errors.

---

### Task 3 — Typecheck batch 1

```bash
cd apps/portal && pnpm tsc --noEmit
```

Fix any errors before continuing.

---

## Batch 2 — Inspection List (Tasks 4–6)

### Task 4 — Create `inspector/inspections/page.tsx`

**File:** `apps/portal/src/app/[locale]/(inspector)/inspector/inspections/page.tsx` _(new)_

```tsx
import { apiFetch } from '@/lib/api-server';
import { PageHeader } from '@/components/admin/page-header';
import { DataTable } from '@/components/admin/data-table';
import { StatusBadge } from '@/components/admin/status-badge';
import Link from 'next/link';

type Inspection = {
  id: string;
  certificationId: string;
  status: string;
  scheduledDate: string;
  passed: boolean | null;
  createdAt: string;
};

type PagedInspections = {
  success: boolean;
  data: Inspection[];
  meta: { page: number; limit: number; total: number };
};

export default async function InspectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));

  let result: PagedInspections = {
    success: true,
    data: [],
    meta: { page: 1, limit: 20, total: 0 },
  };
  try {
    result = await apiFetch<PagedInspections>(`/api/v1/inspections/my?page=${page}&limit=20`);
  } catch {
    // backend unavailable in dev
  }

  return (
    <div>
      <PageHeader title="Mes Inspections" subtitle={`${result.meta.total} inspection(s)`} />

      <DataTable
        head={['Certification', 'Statut', 'Date planifiée', 'Résultat', 'Créée le', '']}
        isEmpty={result.data.length === 0}
        empty="Aucune inspection assignée."
      >
        {result.data.map((i) => (
          <tr key={i.id} className="hover:bg-gray-50">
            <td className="px-4 py-3 font-mono text-xs">{i.certificationId.slice(0, 8)}…</td>
            <td className="px-4 py-3">
              <StatusBadge status={i.status} />
            </td>
            <td className="px-4 py-3">{new Date(i.scheduledDate).toLocaleDateString('fr-MA')}</td>
            <td className="px-4 py-3">
              {i.passed === null ? '—' : i.passed ? '✅ Conforme' : '❌ Non conforme'}
            </td>
            <td className="px-4 py-3 text-gray-500">
              {new Date(i.createdAt).toLocaleDateString('fr-MA')}
            </td>
            <td className="px-4 py-3">
              <Link
                href={`/fr/inspector/inspections/${i.id}`}
                className="text-amber-700 hover:underline text-sm"
              >
                Voir →
              </Link>
            </td>
          </tr>
        ))}
      </DataTable>

      <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
        <span>{result.meta.total} résultats</span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link href={`?page=${page - 1}`} className="rounded border px-3 py-1 hover:bg-gray-50">
              Précédent
            </Link>
          )}
          {page * 20 < result.meta.total && (
            <Link href={`?page=${page + 1}`} className="rounded border px-3 py-1 hover:bg-gray-50">
              Suivant
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Verification:** File saves, no TS errors.

---

### Task 5 — Create `inspector/inspections/actions.ts`

**File:** `apps/portal/src/app/[locale]/(inspector)/inspector/inspections/actions.ts` _(new)_

```ts
'use server';
import { apiFetch } from '@/lib/api-server';
import { revalidatePath } from 'next/cache';

type ReportPayload = {
  passed: boolean;
  reportSummary: string;
  detailedObservations?: string;
  nonConformities?: string;
};

export async function fileReport(inspectionId: string, payload: ReportPayload): Promise<void> {
  await apiFetch(`/api/v1/inspections/${inspectionId}/report`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  revalidatePath('/fr/inspector/inspections');
}
```

**Verification:** File saves, no TS errors.

---

### Task 6 — Typecheck batch 2

```bash
cd apps/portal && pnpm tsc --noEmit
```

Fix any errors before continuing.

---

## Batch 3 — Inspection Detail + Report Form (Tasks 7–9)

### Task 7 — Create `inspector/inspections/[id]/page.tsx`

**File:** `apps/portal/src/app/[locale]/(inspector)/inspector/inspections/[id]/page.tsx` _(new)_

```tsx
import { apiFetch } from '@/lib/api-server';
import { PageHeader } from '@/components/admin/page-header';
import { StatusBadge } from '@/components/admin/status-badge';
import Link from 'next/link';
import { ReportForm } from './report-form';

type Inspection = {
  id: string;
  certificationId: string;
  status: string;
  scheduledDate: string;
  farmIds: string[];
  passed: boolean | null;
  reportSummary: string | null;
  detailedObservations: string | null;
  nonConformities: string | null;
  inspectorName: string | null;
  createdAt: string;
};

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <div className="mt-1 text-sm font-semibold text-gray-800">{value}</div>
    </div>
  );
}

export default async function InspectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let inspection: Inspection | null = null;
  try {
    inspection = await apiFetch<Inspection>(`/api/v1/inspections/${id}`);
  } catch {
    return <p className="text-red-600">Inspection introuvable.</p>;
  }

  const canReport = inspection.status === 'SCHEDULED' || inspection.status === 'IN_PROGRESS';

  return (
    <div>
      <PageHeader
        title={`Inspection — ${id.slice(0, 8)}…`}
        subtitle={`Certification: ${inspection.certificationId.slice(0, 8)}…`}
      />

      {/* Summary cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 rounded-lg border bg-white p-6 shadow-sm md:grid-cols-4">
        <Stat label="Statut" value={<StatusBadge status={inspection.status} />} />
        <Stat
          label="Date planifiée"
          value={new Date(inspection.scheduledDate).toLocaleDateString('fr-MA')}
        />
        <Stat label="Inspecteur" value={inspection.inspectorName ?? '—'} />
        <Stat
          label="Résultat"
          value={
            inspection.passed === null ? '—' : inspection.passed ? '✅ Conforme' : '❌ Non conforme'
          }
        />
      </div>

      {/* Farms linked */}
      {inspection.farmIds.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-2 text-lg font-semibold">
            Fermes inspectées ({inspection.farmIds.length})
          </h2>
          <ul className="flex flex-wrap gap-2">
            {inspection.farmIds.map((fid) => (
              <li
                key={fid}
                className="rounded bg-amber-50 px-3 py-1 font-mono text-xs text-amber-800"
              >
                {fid.slice(0, 8)}…
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Existing report */}
      {inspection.reportSummary && (
        <div className="mb-8 rounded-lg border bg-green-50 p-6">
          <h2 className="mb-3 text-lg font-semibold">Rapport déposé</h2>
          <p className="text-sm font-medium text-gray-700">{inspection.reportSummary}</p>
          {inspection.detailedObservations && (
            <p className="mt-3 whitespace-pre-line text-sm text-gray-600">
              {inspection.detailedObservations}
            </p>
          )}
          {inspection.nonConformities && (
            <p className="mt-3 text-sm text-red-700">
              <span className="font-semibold">Non-conformités : </span>
              {inspection.nonConformities}
            </p>
          )}
        </div>
      )}

      {/* Certification link */}
      <div className="mb-6">
        <Link
          href={`/fr/inspector/certifications/${inspection.certificationId}`}
          className="text-sm text-amber-700 hover:underline"
        >
          Voir la certification liée →
        </Link>
      </div>

      {/* Report form (only if not yet completed) */}
      {canReport && <ReportForm inspectionId={inspection.id} />}
    </div>
  );
}
```

**Verification:** File saves. Missing `ReportForm` import is expected — created next task.

---

### Task 8 — Create `inspector/inspections/[id]/report-form.tsx`

**File:** `apps/portal/src/app/[locale]/(inspector)/inspector/inspections/[id]/report-form.tsx` _(new)_

```tsx
'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { fileReport } from '../actions';

export function ReportForm({ inspectionId }: { inspectionId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const passed = fd.get('passed') === 'true';

    startTransition(async () => {
      await fileReport(inspectionId, {
        passed,
        reportSummary: fd.get('reportSummary') as string,
        detailedObservations: (fd.get('detailedObservations') as string) || undefined,
        nonConformities: (fd.get('nonConformities') as string) || undefined,
      });
      router.push('/fr/inspector/inspections');
    });
  }

  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">Déposer le rapport</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <fieldset className="flex gap-6">
          <legend className="mb-2 text-sm font-medium text-gray-700">
            Résultat de l'inspection
          </legend>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="passed" value="true" required className="accent-green-700" />
            <span className="text-sm">✅ Conforme</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="passed" value="false" className="accent-red-600" />
            <span className="text-sm">❌ Non conforme</span>
          </label>
        </fieldset>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Résumé du rapport <span className="text-red-500">*</span>
          </label>
          <textarea
            name="reportSummary"
            required
            minLength={20}
            rows={3}
            placeholder="Résumé des observations (min 20 caractères)"
            className="w-full rounded border px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Observations détaillées
          </label>
          <textarea
            name="detailedObservations"
            rows={4}
            placeholder="Observations complètes en Markdown (optionnel)"
            className="w-full rounded border px-3 py-2 text-sm font-mono"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Non-conformités</label>
          <textarea
            name="nonConformities"
            rows={2}
            placeholder="Liste des non-conformités constatées (optionnel)"
            className="w-full rounded border px-3 py-2 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-amber-700 px-4 py-2 text-white hover:bg-amber-800 disabled:opacity-50"
        >
          {isPending ? 'Envoi…' : 'Soumettre le rapport'}
        </button>
      </form>
    </div>
  );
}
```

**Verification:** File saves, no TS errors. Inspection detail page now resolves cleanly.

---

### Task 9 — Typecheck + lint batch 3

```bash
cd apps/portal && pnpm tsc --noEmit && pnpm eslint src --max-warnings=0
```

Fix any errors before continuing.

---

## Batch 4 — Read-only Batch + Product Views (Tasks 10–12)

### Task 10 — Create `inspector/batches/[id]/page.tsx`

**File:** `apps/portal/src/app/[locale]/(inspector)/inspector/batches/[id]/page.tsx` _(new)_

```tsx
import { apiFetch } from '@/lib/api-server';
import { PageHeader } from '@/components/admin/page-header';
import { StatusBadge } from '@/components/admin/status-badge';

type Batch = {
  id: string;
  batchNumber?: string;
  campaignYear: string;
  totalQuantityKg: number;
  status: string;
  createdAt: string;
};

type ProcessingStep = {
  id: string;
  stepType: string;
  doneAt: string;
  notes: string | null;
};

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <div className="mt-1 text-sm font-semibold text-gray-800">{value}</div>
    </div>
  );
}

export default async function InspectorBatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let batch: Batch | null = null;
  let steps: ProcessingStep[] = [];

  try {
    [batch, steps] = await Promise.all([
      apiFetch<Batch>(`/api/v1/batches/${id}`),
      apiFetch<ProcessingStep[]>(`/api/v1/batches/${id}/processing-steps`),
    ]);
  } catch {
    return <p className="text-red-600">Lot introuvable.</p>;
  }

  return (
    <div>
      <PageHeader
        title={`Lot ${batch.batchNumber ?? id.slice(0, 8)}`}
        subtitle={`Campagne ${batch.campaignYear}`}
      />

      <div className="mb-8 grid grid-cols-2 gap-4 rounded-lg border bg-white p-6 shadow-sm md:grid-cols-4">
        <Stat label="Statut" value={<StatusBadge status={batch.status} />} />
        <Stat label="Poids total" value={`${batch.totalQuantityKg} kg`} />
        <Stat label="Campagne" value={batch.campaignYear} />
        <Stat label="Créé le" value={new Date(batch.createdAt).toLocaleDateString('fr-MA')} />
      </div>

      <h2 className="mb-4 text-lg font-semibold">Étapes de traitement ({steps.length})</h2>

      {steps.length === 0 ? (
        <p className="text-gray-500">Aucune étape enregistrée.</p>
      ) : (
        <ol className="relative border-l border-amber-200 pl-6">
          {steps.map((s, i) => (
            <li key={s.id} className="mb-6">
              <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-amber-700 text-xs font-bold text-white">
                {i + 1}
              </span>
              <p className="font-medium">{s.stepType}</p>
              <p className="text-xs text-gray-500">
                {new Date(s.doneAt).toLocaleDateString('fr-MA')}
              </p>
              {s.notes && <p className="mt-1 text-sm text-gray-600">{s.notes}</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
```

**Verification:** File saves, no TS errors.

---

### Task 11 — Create `inspector/products/[id]/page.tsx`

**File:** `apps/portal/src/app/[locale]/(inspector)/inspector/products/[id]/page.tsx` _(new)_

```tsx
import { apiFetch } from '@/lib/api-server';
import { PageHeader } from '@/components/admin/page-header';
import { StatusBadge } from '@/components/admin/status-badge';

type Product = {
  id: string;
  name: string;
  productTypeCode: string;
  description: string | null;
  status: string;
  cooperativeId: string;
  createdAt: string;
};

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <div className="mt-1 text-sm font-semibold text-gray-800">{value}</div>
    </div>
  );
}

export default async function InspectorProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let product: Product | null = null;
  try {
    product = await apiFetch<Product>(`/api/v1/products/${id}`);
  } catch {
    return <p className="text-red-600">Produit introuvable.</p>;
  }

  return (
    <div>
      <PageHeader title={product.name} subtitle={`Code type : ${product.productTypeCode}`} />

      <div className="mb-8 grid grid-cols-2 gap-4 rounded-lg border bg-white p-6 shadow-sm md:grid-cols-4">
        <Stat label="Statut" value={<StatusBadge status={product.status} />} />
        <Stat label="Type produit" value={product.productTypeCode} />
        <Stat label="Coopérative" value={product.cooperativeId.slice(0, 8) + '…'} />
        <Stat
          label="Enregistré le"
          value={new Date(product.createdAt).toLocaleDateString('fr-MA')}
        />
      </div>

      {product.description && (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
            Description
          </h2>
          <p className="text-sm text-gray-700">{product.description}</p>
        </div>
      )}
    </div>
  );
}
```

**Verification:** File saves, no TS errors.

---

### Task 12 — Typecheck + lint batch 4

```bash
cd apps/portal && pnpm tsc --noEmit && pnpm eslint src --max-warnings=0
```

Fix any errors before continuing.

---

## Batch 5 — Final Verification (Task 13)

### Task 13 — Full build verification

```bash
cd /c/Users/moham/justforfun/terroir-ma-web && pnpm typecheck && cd apps/portal && pnpm build
```

Expected: 0 type errors, build completes without errors.

Then commit:

```bash
cd /c/Users/moham/justforfun/terroir-ma-web
git add apps/portal/src/app/\[locale\]/\(inspector\)
git commit -m "feat(inspector): add inspector portal — FE-S5"
git push origin main
```

**Verification:** Build green, commit pushed, CI passes.

---

## Summary: Files Created/Modified

| File                                                                                  | Action   |
| ------------------------------------------------------------------------------------- | -------- |
| `apps/portal/src/app/[locale]/(inspector)/inspector/layout.tsx`                       | Modified |
| `apps/portal/src/app/[locale]/(inspector)/inspector/page.tsx`                         | Modified |
| `apps/portal/src/app/[locale]/(inspector)/inspector/inspections/page.tsx`             | Created  |
| `apps/portal/src/app/[locale]/(inspector)/inspector/inspections/actions.ts`           | Created  |
| `apps/portal/src/app/[locale]/(inspector)/inspector/inspections/[id]/page.tsx`        | Created  |
| `apps/portal/src/app/[locale]/(inspector)/inspector/inspections/[id]/report-form.tsx` | Created  |
| `apps/portal/src/app/[locale]/(inspector)/inspector/batches/[id]/page.tsx`            | Created  |
| `apps/portal/src/app/[locale]/(inspector)/inspector/products/[id]/page.tsx`           | Created  |

**Total: 8 files across 5 batches — 13 SP**

## New Routes Added (8)

| Route                                              | Role      | Type                        |
| -------------------------------------------------- | --------- | --------------------------- |
| `/[locale]/inspector`                              | inspector | RSC dashboard               |
| `/[locale]/inspector/inspections`                  | inspector | RSC list                    |
| `/[locale]/inspector/inspections/[id]`             | inspector | RSC detail                  |
| `/[locale]/inspector/inspections/[id]/report-form` | n/a       | client component (no route) |
| `Server Action: fileReport`                        | inspector | SA                          |
| `/[locale]/inspector/batches/[id]`                 | inspector | RSC read-only               |
| `/[locale]/inspector/products/[id]`                | inspector | RSC read-only               |

Portal total after FE-S5: **37 routes**
