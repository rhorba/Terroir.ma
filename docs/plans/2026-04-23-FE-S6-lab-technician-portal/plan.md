# FE-S6 — Lab-Technician Portal Implementation Plan

> **For Claude:** Use /execute to implement this plan task-by-task.

**Goal:** Build all lab-technician pages under `(lab-technician)/lab-technician/` — dashboard, test queue list, test detail + result submission form, PDF report upload, and submit-new-test form.

**Architecture:** Next.js RSC pages + client forms + Server Actions. All data via `apiFetch` (server) or raw `fetch` (multipart PDF). No new backend work required — all endpoints already exist.

**Tech Stack:** Next.js 15, TypeScript 5 strict, Tailwind CSS v3, `apiFetch`, Server Actions, `useTransition`

**Repo:** `terroir-ma-web` at `C:/Users/moham/justforfun/terroir-ma-web`

**Modules Affected:** `apps/portal/src/app/[locale]/(lab-technician)/`

**Estimated Story Points:** 13

---

## Backend APIs used

| Method | Endpoint                        | Auth              | Purpose                                                       |
| ------ | ------------------------------- | ----------------- | ------------------------------------------------------------- |
| GET    | `/api/v1/lab-tests`             | lab-technician    | List tests (status, batchId, page, limit)                     |
| GET    | `/api/v1/lab-tests/:id`         | lab-technician    | Single test detail                                            |
| GET    | `/api/v1/lab-tests/:id/result`  | lab-technician    | Existing result (nullable)                                    |
| POST   | `/api/v1/lab-tests`             | lab-technician    | Submit new test (batchId, laboratoryId?, expectedResultDate?) |
| POST   | `/api/v1/lab-tests/:id/results` | lab-technician    | Record result (testValues, technicianName?, laboratoryName?)  |
| POST   | `/api/v1/lab-tests/:id/report`  | lab-technician    | Upload PDF (multipart)                                        |
| GET    | `/api/v1/product-types`         | any-authenticated | List all product types (has `labTestParameters`)              |

Response envelope: `{ success, data, meta }` for lists, direct entity for single items.

---

## Key Data Types

```ts
type LabTestStatus = 'submitted' | 'in_progress' | 'completed' | 'cancelled';

type LabTest = {
  id: string;
  batchId: string;
  cooperativeId: string;
  productTypeCode: string;
  laboratoryId: string | null;
  status: LabTestStatus;
  submittedAt: string;
  expectedResultDate: string | null;
  submittedBy: string;
  reportFileName: string | null;
};

type LabTestResult = {
  id: string;
  labTestId: string;
  batchId: string;
  productTypeCode: string;
  passed: boolean;
  testValues: Record<string, number | string>;
  failedParameters: string[];
  technicianName: string;
  laboratoryName: string | null;
  completedAt: string;
};

type LabTestParameter = {
  name: string;
  unit: string;
  minValue?: number;
  maxValue?: number;
  type?: string;
  values?: string[]; // for enum params → renders <select>
};

type ProductType = {
  id: string;
  code: string;
  nameFr: string;
  labTestParameters: LabTestParameter[];
};

type PagedLabTests = {
  success: boolean;
  data: LabTest[];
  meta: { page: number; limit: number; total: number };
};
```

---

## Routes Added (3 new, 2 updated)

| Route                        | File                  | Type          |
| ---------------------------- | --------------------- | ------------- |
| `/lab-technician`            | `page.tsx`            | RSC (updated) |
| `/lab-technician/queue`      | `queue/page.tsx`      | RSC (new)     |
| `/lab-technician/queue/[id]` | `queue/[id]/page.tsx` | RSC (new)     |
| `/lab-technician/submit`     | `submit/page.tsx`     | Client (new)  |

**Total portal routes after FE-S6:** 35 (32 + 3)

---

## Batch 1 — Layout + Dashboard (Tasks 1–3)

### Task 1 — Update `layout.tsx`

**File:** `apps/portal/src/app/[locale]/(lab-technician)/lab-technician/layout.tsx`

Replace the current NAV (only queue + submit) with 3 links including dashboard. Keep blue sidebar color.

```tsx
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

const NAV = [
  { href: '/fr/lab-technician', label: 'Tableau de bord' },
  { href: '/fr/lab-technician/queue', label: "File d'attente" },
  { href: '/fr/lab-technician/submit', label: 'Soumettre un test' },
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

**Verification:** File saves, TypeScript sees no errors on import.

---

### Task 2 — Replace `page.tsx` (Dashboard)

**File:** `apps/portal/src/app/[locale]/(lab-technician)/lab-technician/page.tsx`

RSC dashboard. Fetch all tests (limit=100) then compute per-status counts. Same pattern as inspector dashboard.

```tsx
import { apiFetch } from '@/lib/api-server';

type PagedLabTests = {
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

export default async function LabTechnicianDashboard() {
  let result: PagedLabTests = { success: true, data: [], meta: { total: 0 } };
  try {
    result = await apiFetch<PagedLabTests>('/api/v1/lab-tests?page=1&limit=100');
  } catch {
    // backend unavailable in dev
  }

  const all = result.data;
  const submitted = all.filter((t) => t.status === 'submitted').length;
  const inProgress = all.filter((t) => t.status === 'in_progress').length;
  const completed = all.filter((t) => t.status === 'completed').length;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-800">Tableau de bord — Laborantin</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total" value={result.meta.total} color="bg-white" />
        <StatCard label="Soumis" value={submitted} color="bg-yellow-50" />
        <StatCard label="En cours" value={inProgress} color="bg-blue-50" />
        <StatCard label="Complétés" value={completed} color="bg-green-50" />
      </div>
    </div>
  );
}
```

**Verification:** Page renders stat cards (all 0 when backend unavailable — no crash).

---

### Task 3 — Verification Checkpoint 1

**Working directory:** `C:/Users/moham/justforfun/terroir-ma-web`

```bash
cd apps/portal && npx tsc --noEmit 2>&1 | head -20
```

Fix any type errors before proceeding.

---

## Batch 2 — Test Queue List (Tasks 4–5)

### Task 4 — `queue/page.tsx` (Test Queue List)

**File:** `apps/portal/src/app/[locale]/(lab-technician)/lab-technician/queue/page.tsx`

RSC. Reads `?status=` and `?page=` from `searchParams`. Renders paginated DataTable with status filter tabs. Status tab links are plain `<Link>` tags that set `?status=`.

```tsx
import { apiFetch } from '@/lib/api-server';
import { PageHeader } from '@/components/admin/page-header';
import { DataTable } from '@/components/admin/data-table';
import { StatusBadge } from '@/components/admin/status-badge';
import Link from 'next/link';

type LabTest = {
  id: string;
  batchId: string;
  productTypeCode: string;
  status: string;
  submittedAt: string;
  expectedResultDate: string | null;
  reportFileName: string | null;
};

type PagedLabTests = {
  success: boolean;
  data: LabTest[];
  meta: { page: number; limit: number; total: number };
};

const STATUSES = [
  { value: '', label: 'Tous' },
  { value: 'submitted', label: 'Soumis' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'completed', label: 'Complétés' },
  { value: 'cancelled', label: 'Annulés' },
];

export default async function LabTestQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));
  const status = params.status ?? '';

  const qs = new URLSearchParams({ page: String(page), limit: '20' });
  if (status) qs.set('status', status);

  let result: PagedLabTests = { success: true, data: [], meta: { page: 1, limit: 20, total: 0 } };
  try {
    result = await apiFetch<PagedLabTests>(`/api/v1/lab-tests?${qs}`);
  } catch {
    // backend unavailable in dev
  }

  return (
    <div>
      <PageHeader title="File d'attente" subtitle={`${result.meta.total} test(s)`} />

      <div className="mb-4 flex gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s.value}
            href={`?status=${s.value}&page=1`}
            className={`rounded-full px-3 py-1 text-sm border ${
              status === s.value
                ? 'bg-blue-700 text-white border-blue-700'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      <DataTable
        head={[
          'Lot (batchId)',
          'Type produit',
          'Statut',
          'Soumis le',
          'Résultat attendu',
          'Rapport',
          '',
        ]}
        isEmpty={result.data.length === 0}
        empty="Aucun test dans la file."
      >
        {result.data.map((t) => (
          <tr key={t.id} className="hover:bg-gray-50">
            <td className="px-4 py-3 font-mono text-xs">{t.batchId.slice(0, 8)}…</td>
            <td className="px-4 py-3 text-sm">{t.productTypeCode}</td>
            <td className="px-4 py-3">
              <StatusBadge status={t.status} />
            </td>
            <td className="px-4 py-3 text-sm">
              {new Date(t.submittedAt).toLocaleDateString('fr-MA')}
            </td>
            <td className="px-4 py-3 text-sm">{t.expectedResultDate ?? '—'}</td>
            <td className="px-4 py-3 text-sm">
              {t.reportFileName ? (
                <span className="text-green-700">✓ {t.reportFileName}</span>
              ) : (
                <span className="text-gray-400">—</span>
              )}
            </td>
            <td className="px-4 py-3">
              <Link
                href={`/fr/lab-technician/queue/${t.id}`}
                className="text-blue-700 hover:underline text-sm"
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
            <Link
              href={`?status=${status}&page=${page - 1}`}
              className="rounded border px-3 py-1 hover:bg-gray-50"
            >
              Précédent
            </Link>
          )}
          {page * 20 < result.meta.total && (
            <Link
              href={`?status=${status}&page=${page + 1}`}
              className="rounded border px-3 py-1 hover:bg-gray-50"
            >
              Suivant
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Verification:** Page compiles. Status tab URL params work. Empty state renders.

---

### Task 5 — Verification Checkpoint 2

```bash
cd C:/Users/moham/justforfun/terroir-ma-web/apps/portal && npx tsc --noEmit 2>&1 | head -20
```

Fix type errors before proceeding.

---

## Batch 3 — Test Detail + Result Form (Tasks 6–9)

### Task 6 — `queue/[id]/page.tsx` (Test Detail)

**File:** `apps/portal/src/app/[locale]/(lab-technician)/lab-technician/queue/[id]/page.tsx`

RSC. Uses `Promise.all` to fetch:

1. `GET /api/v1/lab-tests/:id` → LabTest
2. `GET /api/v1/lab-tests/:id/result` → LabTestResult | null
3. `GET /api/v1/product-types?limit=100` → list → find by productTypeCode

Displays: stat cards (status, batchId, productType, expectedDate), parameters table (required params), existing result block (green card if result exists), conditional ResultForm (only if status is `submitted` or `in_progress`), conditional UploadForm (always shown if no reportFileName).

```tsx
import { apiFetch } from '@/lib/api-server';
import { PageHeader } from '@/components/admin/page-header';
import { StatusBadge } from '@/components/admin/status-badge';
import { ResultForm } from './result-form';
import { UploadForm } from './upload-form';

type LabTest = {
  id: string;
  batchId: string;
  productTypeCode: string;
  laboratoryId: string | null;
  status: string;
  submittedAt: string;
  expectedResultDate: string | null;
  reportFileName: string | null;
};

type LabTestResult = {
  id: string;
  passed: boolean;
  testValues: Record<string, number | string>;
  failedParameters: string[];
  technicianName: string;
  laboratoryName: string | null;
  completedAt: string;
};

type LabTestParameter = {
  name: string;
  unit: string;
  minValue?: number;
  maxValue?: number;
  type?: string;
  values?: string[];
};

type ProductTypesResponse = {
  data: { id: string; code: string; nameFr: string; labTestParameters: LabTestParameter[] }[];
};

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <div className="mt-1 text-sm font-semibold text-gray-800">{value}</div>
    </div>
  );
}

export default async function LabTestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let labTest: LabTest | null = null;
  let result: LabTestResult | null = null;
  let parameters: LabTestParameter[] = [];

  try {
    [labTest, result] = await Promise.all([
      apiFetch<LabTest>(`/api/v1/lab-tests/${id}`),
      apiFetch<LabTestResult | null>(`/api/v1/lab-tests/${id}/result`).catch(() => null),
    ]);

    if (labTest) {
      const ptRes = await apiFetch<ProductTypesResponse>('/api/v1/product-types?limit=100');
      const productType = ptRes.data.find((pt) => pt.code === labTest!.productTypeCode);
      parameters = productType?.labTestParameters ?? [];
    }
  } catch {
    return <p className="text-red-600">Test introuvable ou backend indisponible.</p>;
  }

  if (!labTest) return <p className="text-red-600">Test introuvable.</p>;

  const canSubmitResult = labTest.status === 'submitted' || labTest.status === 'in_progress';

  return (
    <div>
      <PageHeader
        title={`Test — ${id.slice(0, 8)}…`}
        subtitle={`Lot : ${labTest.batchId.slice(0, 8)}… · Type : ${labTest.productTypeCode}`}
      />

      {/* Stat cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 rounded-lg border bg-white p-6 shadow-sm md:grid-cols-4">
        <Stat label="Statut" value={<StatusBadge status={labTest.status} />} />
        <Stat label="Soumis le" value={new Date(labTest.submittedAt).toLocaleDateString('fr-MA')} />
        <Stat label="Résultat attendu" value={labTest.expectedResultDate ?? '—'} />
        <Stat label="Rapport PDF" value={labTest.reportFileName ?? '—'} />
      </div>

      {/* Required parameters table */}
      {parameters.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">Paramètres requis ({parameters.length})</h2>
          <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Paramètre</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Unité</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Min</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Max</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">
                    Valeurs acceptées
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {parameters.map((p) => (
                  <tr key={p.name} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-gray-500">{p.unit}</td>
                    <td className="px-4 py-3">{p.minValue ?? '—'}</td>
                    <td className="px-4 py-3">{p.maxValue ?? '—'}</td>
                    <td className="px-4 py-3">{p.values?.join(', ') ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Existing result */}
      {result && (
        <div className="mb-8 rounded-lg border bg-green-50 p-6">
          <h2 className="mb-3 text-lg font-semibold">Résultat enregistré</h2>
          <div className="mb-3 flex items-center gap-3">
            <span className={`font-bold ${result.passed ? 'text-green-700' : 'text-red-700'}`}>
              {result.passed ? '✅ Conforme' : '❌ Non conforme'}
            </span>
            <span className="text-sm text-gray-500">
              par {result.technicianName} —{' '}
              {new Date(result.completedAt).toLocaleDateString('fr-MA')}
            </span>
          </div>
          {result.failedParameters.length > 0 && (
            <p className="text-sm text-red-700">
              <span className="font-semibold">Paramètres échoués : </span>
              {result.failedParameters.join(', ')}
            </p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
            {Object.entries(result.testValues).map(([k, v]) => (
              <div key={k} className="rounded bg-white px-3 py-2 text-sm">
                <span className="font-medium">{k}:</span>{' '}
                <span className="text-gray-700">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Result form (only if no result yet and status allows) */}
      {canSubmitResult && !result && <ResultForm labTestId={id} parameters={parameters} />}

      {/* PDF upload */}
      {!labTest.reportFileName && <UploadForm labTestId={id} />}
    </div>
  );
}
```

---

### Task 7 — `queue/[id]/result-form.tsx` (Client Result Form)

**File:** `apps/portal/src/app/[locale]/(lab-technician)/lab-technician/queue/[id]/result-form.tsx`

Client component. Renders dynamic fields from `parameters` prop:

- If `values` is set → `<select>` with those options
- Otherwise → `<input type="number">` with min/max attributes

Calls `recordResult` server action via `useTransition`.

```tsx
'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { recordResult } from './actions';

type LabTestParameter = {
  name: string;
  unit: string;
  minValue?: number;
  maxValue?: number;
  values?: string[];
};

export function ResultForm({
  labTestId,
  parameters,
}: {
  labTestId: string;
  parameters: LabTestParameter[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    const testValues: Record<string, number | string> = {};
    for (const p of parameters) {
      const raw = fd.get(p.name) as string;
      testValues[p.name] = p.values ? raw : Number(raw);
    }

    startTransition(async () => {
      await recordResult(labTestId, {
        testValues,
        technicianName: (fd.get('technicianName') as string) || undefined,
        laboratoryName: (fd.get('laboratoryName') as string) || undefined,
      });
      router.push('/fr/lab-technician/queue');
    });
  }

  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">Saisir les résultats</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {parameters.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {parameters.map((p) => (
              <div key={p.name}>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {p.name} <span className="text-gray-400">({p.unit})</span>
                  {(p.minValue !== undefined || p.maxValue !== undefined) && (
                    <span className="ml-1 text-xs text-gray-400">
                      [{p.minValue ?? '—'} – {p.maxValue ?? '—'}]
                    </span>
                  )}
                </label>
                {p.values ? (
                  <select
                    name={p.name}
                    required
                    className="w-full rounded border px-3 py-2 text-sm"
                  >
                    <option value="">Sélectionner…</option>
                    {p.values.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="number"
                    name={p.name}
                    required
                    step="any"
                    min={p.minValue}
                    max={p.maxValue}
                    className="w-full rounded border px-3 py-2 text-sm"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {parameters.length === 0 && (
          <p className="text-sm text-amber-700 bg-amber-50 rounded p-3">
            Aucun paramètre défini pour ce type de produit. Soumission libre.
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Nom du technicien
            </label>
            <input
              type="text"
              name="technicianName"
              placeholder="Prénom Nom"
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Nom du laboratoire
            </label>
            <input
              type="text"
              name="laboratoryName"
              placeholder="Laboratoire ONSSA Agadir"
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {isPending ? 'Envoi…' : 'Enregistrer les résultats'}
        </button>
      </form>
    </div>
  );
}
```

---

### Task 8 — `queue/[id]/actions.ts` (Server Actions)

**File:** `apps/portal/src/app/[locale]/(lab-technician)/lab-technician/queue/[id]/actions.ts`

```ts
'use server';
import { apiFetch } from '@/lib/api-server';
import { revalidatePath } from 'next/cache';

type RecordResultPayload = {
  testValues: Record<string, number | string>;
  technicianName?: string;
  laboratoryName?: string;
};

export async function recordResult(labTestId: string, payload: RecordResultPayload): Promise<void> {
  await apiFetch(`/api/v1/lab-tests/${labTestId}/results`, {
    method: 'POST',
    body: JSON.stringify({ labTestId, ...payload }),
  });
  revalidatePath('/fr/lab-technician/queue');
}
```

---

### Task 9 — Verification Checkpoint 3

```bash
cd C:/Users/moham/justforfun/terroir-ma-web/apps/portal && npx tsc --noEmit 2>&1 | head -30
```

Fix type errors before proceeding.

---

## Batch 4 — PDF Upload + Submit New Test (Tasks 10–12)

### Task 10 — `queue/[id]/upload-form.tsx` (PDF Upload)

**File:** `apps/portal/src/app/[locale]/(lab-technician)/lab-technician/queue/[id]/upload-form.tsx`

Client component. Uses `useTransition` + native `fetch` (not `apiFetch`) with `FormData` for multipart.
Gets Bearer token via `/api/auth/session` is NOT available — instead, call a server action that proxies the multipart upload using `getAccessToken()`.

The server action `uploadReport` is added to `actions.ts`:

```ts
// Add to actions.ts:
import { getAccessToken } from '@/lib/auth-utils';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export async function uploadReport(labTestId: string, formData: FormData): Promise<void> {
  const token = await getAccessToken();
  const file = formData.get('file') as File;
  if (!file || file.size === 0) throw new Error('Fichier requis');

  const body = new FormData();
  body.append('file', file);

  const res = await fetch(`${BASE}/api/v1/lab-tests/${labTestId}/report`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  if (!res.ok) throw new Error(`Upload échoué: ${res.status}`);
  revalidatePath(`/fr/lab-technician/queue/${labTestId}`);
}
```

Client component `upload-form.tsx`:

```tsx
'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { uploadReport } from './actions';

export function UploadForm({ labTestId }: { labTestId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    startTransition(async () => {
      await uploadReport(labTestId, fd);
      router.refresh();
    });
  }

  return (
    <div className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">Joindre le rapport PDF</h2>
      <form onSubmit={handleSubmit} className="flex items-end gap-4">
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Rapport PDF (max 20 Mo)
          </label>
          <input
            type="file"
            name="file"
            accept="application/pdf"
            required
            className="w-full rounded border px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-gray-700 px-4 py-2 text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {isPending ? 'Envoi…' : 'Téléverser'}
        </button>
      </form>
    </div>
  );
}
```

---

### Task 11 — `submit/page.tsx` + `submit/actions.ts` (Submit New Test)

**File 1:** `apps/portal/src/app/[locale]/(lab-technician)/lab-technician/submit/page.tsx`

Client component form. Submits batchId (required UUID), laboratoryId (optional UUID), expectedResultDate (optional date). Calls `submitTest` server action.

```tsx
'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitTest } from './actions';

export default function SubmitTestPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    startTransition(async () => {
      await submitTest({
        batchId: fd.get('batchId') as string,
        laboratoryId: (fd.get('laboratoryId') as string) || undefined,
        expectedResultDate: (fd.get('expectedResultDate') as string) || undefined,
      });
      router.push('/fr/lab-technician/queue');
    });
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-800">Soumettre un nouveau test</h1>
      <div className="max-w-lg rounded-lg border bg-white p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Identifiant du lot (UUID) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="batchId"
              required
              pattern="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="w-full rounded border px-3 py-2 font-mono text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Identifiant du laboratoire (UUID, optionnel)
            </label>
            <input
              type="text"
              name="laboratoryId"
              pattern="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="w-full rounded border px-3 py-2 font-mono text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Date de résultat attendue (optionnel)
            </label>
            <input
              type="date"
              name="expectedResultDate"
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {isPending ? 'Soumission…' : 'Soumettre le test'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

**File 2:** `apps/portal/src/app/[locale]/(lab-technician)/lab-technician/submit/actions.ts`

```ts
'use server';
import { apiFetch } from '@/lib/api-server';
import { revalidatePath } from 'next/cache';

type SubmitTestPayload = {
  batchId: string;
  laboratoryId?: string;
  expectedResultDate?: string;
};

export async function submitTest(payload: SubmitTestPayload): Promise<void> {
  await apiFetch('/api/v1/lab-tests', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  revalidatePath('/fr/lab-technician/queue');
}
```

---

### Task 12 — Verification Checkpoint 4

```bash
cd C:/Users/moham/justforfun/terroir-ma-web/apps/portal && npx tsc --noEmit 2>&1 | head -30
```

Fix type errors before proceeding.

---

## Batch 5 — Build + Session (Task 13)

### Task 13 — `next build` + Session Save

**Working directory:** `C:/Users/moham/justforfun/terroir-ma-web`

```bash
cd apps/portal && npm run build 2>&1 | tail -20
```

Expected: exit 0, 35 routes listed, 0 type errors.

If build passes:

1. Commit in `terroir-ma-web`: `git add -A && git commit -m "feat(lab-technician): FE-S6 complete — queue, detail, result form, PDF upload, submit"`
2. Push: `git push origin main`
3. Update `.sessions/current-state.json` in `terroir-ma`:
   - `active_feature`: `"frontend-webapp-FE-S7"`
   - `current_sprint.status`: `"COMPLETED"`
   - `current_sprint.note`: FE-S6 complete — 13 tasks, 9 files created/modified, 3 new routes (35 total)
   - `frontend_context.apps[0].routes_count`: 35
   - `backlog_status.frontend_sprints_done`: 6
   - `backlog_status.frontend_sp_done`: 78
   - `velocity_history.FE-S6`: `{ planned: 13, completed: 13, pct: 100 }`
   - `next_actions`: FE-S7 (certification-body portal)

---

## File Summary

| File                                                         | Action  | Task |
| ------------------------------------------------------------ | ------- | ---- |
| `(lab-technician)/lab-technician/layout.tsx`                 | Update  | 1    |
| `(lab-technician)/lab-technician/page.tsx`                   | Replace | 2    |
| `(lab-technician)/lab-technician/queue/page.tsx`             | Create  | 4    |
| `(lab-technician)/lab-technician/queue/[id]/page.tsx`        | Create  | 6    |
| `(lab-technician)/lab-technician/queue/[id]/result-form.tsx` | Create  | 7    |
| `(lab-technician)/lab-technician/queue/[id]/actions.ts`      | Create  | 8    |
| `(lab-technician)/lab-technician/queue/[id]/upload-form.tsx` | Create  | 10   |
| `(lab-technician)/lab-technician/submit/page.tsx`            | Create  | 11   |
| `(lab-technician)/lab-technician/submit/actions.ts`          | Create  | 11   |

**9 files total — 7 creates, 2 updates**

---

## Story Point Summary

| Batch                               | Tasks  | SP     |
| ----------------------------------- | ------ | ------ |
| Batch 1 — Layout + Dashboard        | 3      | 3      |
| Batch 2 — Queue List                | 2      | 2      |
| Batch 3 — Test Detail + Result Form | 4      | 4      |
| Batch 4 — PDF Upload + Submit       | 3      | 3      |
| Batch 5 — Build + Session           | 1      | 1      |
| **Total**                           | **13** | **13** |

---

## Stories Covered

- US-021: Submit test results for a batch ✅ (ResultForm + recordResult SA)
- US-022: See required test parameters for product type ✅ (parameters table + dynamic form)
- US-026: Upload PDF lab report ✅ (UploadForm + uploadReport SA)
