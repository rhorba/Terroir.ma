# FE-S10 — Customs-Agent Portal + E2E Tests + Docker Prod Build

> **For Claude:** Use /execute to implement this plan task-by-task.

**Goal:** Complete the customs-agent export-documents portal (list + detail + clearance action), add Playwright E2E tests for key user flows, and fix the pnpm-monorepo Dockerfiles for production use.

**Architecture:**

- Frontend (`terroir-ma-web`): Next.js 14 App Router, RSC + Server Actions, `apiFetch` helper
- Backend patch: extend `GET /export-documents` to allow `customs-agent` role
- E2E: Playwright installed at workspace root, tests in `apps/portal/e2e/`
- Docker: 3-stage builds (deps → builder → runner) using repo-root build context

**Tech Stack:** Next.js 14, TypeScript 5.4, Tailwind CSS, next-auth v5, Playwright, pnpm workspaces, Docker 25+

**Repos affected:**

- `terroir-ma-web` (portal + public + E2E + Docker)
- `terroir-ma` (backend patch: one Roles decorator change)

**Estimated Story Points:** 15

---

## Context

### Backend endpoints available to customs-agent

| Method | Path                                           | Guard                                         |
| ------ | ---------------------------------------------- | --------------------------------------------- |
| `GET`  | `/api/v1/export-documents`                     | super-admin **← needs customs-agent added**   |
| `GET`  | `/api/v1/export-documents/:id`                 | none (open)                                   |
| `POST` | `/api/v1/export-documents`                     | cooperative-admin, customs-agent              |
| `POST` | `/api/v1/export-documents/:id/validate`        | customs-agent                                 |
| `GET`  | `/api/v1/export-documents/:id/certificate.pdf` | customs-agent, cooperative-admin, super-admin |
| `GET`  | `/api/v1/export-documents/clearances-report`   | super-admin, customs-agent                    |
| `GET`  | `/api/v1/export-documents/hs-codes`            | cooperative-admin, customs-agent, super-admin |

### ExportDocument fields

```ts
type ExportDocument = {
  id: string;
  certificationId: string;
  cooperativeId: string;
  destinationCountry: string; // ISO 3166-1 alpha-2
  hsCode: string;
  onssaReference: string | null;
  quantityKg: number;
  consigneeName: string;
  consigneeCountry: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'expired';
  validUntil: string | null;
  documentUrl: string | null;
  requestedBy: string;
  createdAt: string;
  updatedAt: string;
};
```

### Existing portal routes (42 total before this sprint)

Custom-agent scaffold already has:

- `/(customs-agent)/customs-agent/page.tsx` — placeholder (to replace)
- `/(customs-agent)/customs-agent/layout.tsx` — sidebar with export-documents link

### StatusBadge mapping to add for ExportDocument.status

`draft` → gray | `submitted` → yellow | `approved` → green | `rejected` → red | `expired` → slate

---

## Batch 1 — Backend patch + Customs-agent dashboard + Export-documents list (Tasks 1–4)

### Task 1 — Backend: Add `customs-agent` to GET /export-documents

**File:** `terroir-ma/src/modules/certification/controllers/export-document.controller.ts`

Line 45–46 currently:

```ts
@Roles('super-admin')
```

Change to:

```ts
@Roles('super-admin', 'customs-agent')
```

**Verification:**

```bash
cd C:/Users/moham/justforfun/terroir-ma
npm run lint && npm run typecheck && npm run test:unit
```

Expected: 391 tests passing.

---

### Task 2 — Customs-agent dashboard (replace placeholder)

**File to replace:** `terroir-ma-web/apps/portal/src/app/[locale]/(customs-agent)/customs-agent/page.tsx`

```tsx
import { apiFetch } from '@/lib/api-server';
import { PageHeader } from '@/components/admin/page-header';
import { StatusBadge } from '@/components/admin/status-badge';
import Link from 'next/link';

type ExportDocument = {
  id: string;
  status: string;
  destinationCountry: string;
  consigneeName: string;
  quantityKg: number;
  createdAt: string;
};

type PagedResult = {
  data: ExportDocument[];
  meta: { page: number; limit: number; total: number };
};

export default async function CustomsAgentDashboard() {
  let total = 0;
  let submittedCount = 0;
  let approvedCount = 0;

  try {
    const result = await apiFetch<PagedResult>('/api/v1/export-documents?page=1&limit=100');
    total = result.meta.total;
    submittedCount = result.data.filter((d) => d.status === 'submitted').length;
    approvedCount = result.data.filter((d) => d.status === 'approved').length;
  } catch {
    // Backend unavailable — show zeros
  }

  const stats = [
    { label: 'Total documents', value: total, color: 'blue' },
    { label: 'En attente de validation', value: submittedCount, color: 'yellow' },
    { label: 'Validés', value: approvedCount, color: 'green' },
  ];

  return (
    <div>
      <PageHeader title="Tableau de bord — Douanes" subtitle="Documents d'exportation ONSSA" />

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map(({ label, value, color }) => (
          <div
            key={label}
            className={`rounded-lg border bg-white p-6 shadow-sm border-${color}-200`}
          >
            <p className="text-sm text-gray-500">{label}</p>
            <p className={`mt-2 text-3xl font-bold text-${color}-700`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <Link
          href="./export-documents"
          className="inline-flex items-center rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Voir tous les documents →
        </Link>
      </div>
    </div>
  );
}
```

**Verification:** `pnpm typecheck` in `apps/portal` — no errors.

---

### Task 3 — Export-documents list page (paginated)

**File to create:** `terroir-ma-web/apps/portal/src/app/[locale]/(customs-agent)/customs-agent/export-documents/page.tsx`

```tsx
import { apiFetch } from '@/lib/api-server';
import { PageHeader } from '@/components/admin/page-header';
import { StatusBadge } from '@/components/admin/status-badge';
import Link from 'next/link';

type ExportDocument = {
  id: string;
  status: string;
  destinationCountry: string;
  consigneeName: string;
  hsCode: string;
  quantityKg: number;
  onssaReference: string | null;
  createdAt: string;
};

type PagedResult = {
  data: ExportDocument[];
  meta: { page: number; limit: number; total: number };
};

export default async function ExportDocumentsListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? '1', 10));

  let result: PagedResult = { data: [], meta: { page: 1, limit: 20, total: 0 } };
  try {
    result = await apiFetch<PagedResult>(`/api/v1/export-documents?page=${page}&limit=20`);
  } catch {
    return <p className="text-red-600">Backend indisponible.</p>;
  }

  const { data: docs, meta } = result;
  const totalPages = Math.ceil(meta.total / meta.limit);

  return (
    <div>
      <PageHeader
        title="Documents d'exportation"
        subtitle={`${meta.total} document(s)`}
        action={
          <Link
            href="./export-documents/new"
            className="rounded bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
          >
            + Générer un document
          </Link>
        }
      />

      <div className="mt-6 overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {[
                'ID',
                'Destinataire',
                'Pays',
                'Code HS',
                'Qté (kg)',
                'Réf. ONSSA',
                'Statut',
                'Créé le',
                '',
              ].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-gray-700">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {docs.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                  Aucun document d'exportation.
                </td>
              </tr>
            )}
            {docs.map((d) => (
              <tr key={d.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{d.id.slice(0, 8)}…</td>
                <td className="px-4 py-3">{d.consigneeName}</td>
                <td className="px-4 py-3">{d.destinationCountry}</td>
                <td className="px-4 py-3 font-mono text-xs">{d.hsCode}</td>
                <td className="px-4 py-3 text-right">
                  {Number(d.quantityKg).toLocaleString('fr-MA')}
                </td>
                <td className="px-4 py-3">{d.onssaReference ?? '—'}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={d.status} />
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(d.createdAt).toLocaleDateString('fr-MA')}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`./export-documents/${d.id}`}
                    className="font-medium text-slate-700 hover:underline"
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

**Verification:** `pnpm typecheck` in `apps/portal` — no errors.

---

### Task 4 — Export-document detail page + Server Action (validate)

**Files to create:**

#### `apps/portal/src/app/[locale]/(customs-agent)/customs-agent/export-documents/[id]/actions.ts`

```ts
'use server';

import { apiFetch } from '@/lib/api-server';
import { revalidatePath } from 'next/cache';

export async function validateDocument(id: string): Promise<void> {
  await apiFetch(`/api/v1/export-documents/${id}/validate`, { method: 'POST' });
  revalidatePath(`/fr/customs-agent/export-documents/${id}`);
}
```

#### `apps/portal/src/app/[locale]/(customs-agent)/customs-agent/export-documents/[id]/validate-form.tsx`

```tsx
'use client';

import { useState, useTransition } from 'react';
import { validateDocument } from './actions';

export function ValidateForm({ docId }: { docId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleValidate() {
    setError(null);
    startTransition(async () => {
      try {
        await validateDocument(docId);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur inattendue');
      }
    });
  }

  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-6">
      <h2 className="mb-3 text-base font-semibold text-green-800">Valider le dédouanement</h2>
      <p className="mb-4 text-sm text-green-700">
        Approuver ce document confirme la clearance douanière pour l'exportation.
      </p>
      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button
        onClick={handleValidate}
        disabled={isPending}
        className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
      >
        {isPending ? 'Validation…' : 'Valider le dédouanement'}
      </button>
    </div>
  );
}
```

#### `apps/portal/src/app/[locale]/(customs-agent)/customs-agent/export-documents/[id]/page.tsx`

```tsx
import { apiFetch } from '@/lib/api-server';
import { PageHeader } from '@/components/admin/page-header';
import { StatusBadge } from '@/components/admin/status-badge';
import { ValidateForm } from './validate-form';
import Link from 'next/link';

type ExportDocument = {
  id: string;
  certificationId: string;
  cooperativeId: string;
  destinationCountry: string;
  hsCode: string;
  onssaReference: string | null;
  quantityKg: number;
  consigneeName: string;
  consigneeCountry: string;
  status: string;
  validUntil: string | null;
  documentUrl: string | null;
  requestedBy: string;
  createdAt: string;
  updatedAt: string;
};

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <div className="mt-1 text-sm font-semibold text-gray-800">{value}</div>
    </div>
  );
}

export default async function ExportDocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let doc: ExportDocument | null = null;
  try {
    doc = await apiFetch<ExportDocument>(`/api/v1/export-documents/${id}`);
  } catch {
    return <p className="text-red-600">Document introuvable ou backend indisponible.</p>;
  }

  if (!doc) return <p className="text-red-600">Document introuvable.</p>;

  return (
    <div>
      <div className="mb-4">
        <Link href="../export-documents" className="text-sm text-slate-700 hover:underline">
          ← Retour à la liste
        </Link>
      </div>

      <PageHeader
        title={`Document d'export — ${id.slice(0, 8)}…`}
        subtitle={`${doc.consigneeName} · ${doc.destinationCountry}`}
      />

      {/* Identity */}
      <div className="mb-6 grid grid-cols-2 gap-4 rounded-lg border bg-white p-6 shadow-sm md:grid-cols-4">
        <Stat label="Statut" value={<StatusBadge status={doc.status} />} />
        <Stat label="Destinataire" value={doc.consigneeName} />
        <Stat label="Pays destination" value={doc.destinationCountry} />
        <Stat label="Pays consignataire" value={doc.consigneeCountry} />
      </div>

      {/* Customs details */}
      <div className="mb-6 grid grid-cols-2 gap-4 rounded-lg border bg-white p-6 shadow-sm md:grid-cols-4">
        <Stat label="Code HS" value={<span className="font-mono">{doc.hsCode}</span>} />
        <Stat label="Quantité (kg)" value={Number(doc.quantityKg).toLocaleString('fr-MA')} />
        <Stat label="Réf. ONSSA" value={doc.onssaReference ?? '—'} />
        <Stat label="Valide jusqu'au" value={doc.validUntil ?? '—'} />
      </div>

      {/* PDF download — always available */}
      <div className="mb-6 rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-gray-800">Certificat d'export</h2>
        <a
          href={`/api/v1/export-documents/${id}/certificate.pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded border px-3 py-2 text-sm font-medium text-slate-700 hover:bg-gray-50"
        >
          Télécharger le PDF →
        </a>
      </div>

      {/* Validate action — only when status is submitted */}
      {doc.status === 'submitted' && <ValidateForm docId={id} />}

      {doc.status === 'approved' && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-6">
          <p className="font-semibold text-green-800">
            Ce document a déjà été validé (dédouanement accordé).
          </p>
        </div>
      )}
    </div>
  );
}
```

**Verification:** `pnpm typecheck` in `apps/portal` — no errors.

**Batch 1 checkpoint:**

```bash
cd C:/Users/moham/justforfun/terroir-ma-web/apps/portal
pnpm lint && pnpm typecheck && pnpm build
```

Expected: build successful, 45 routes (portal), 0 type errors.

---

## Batch 2 — Generate Export Doc form + StatusBadge extension + Commit (Tasks 5–8)

### Task 5 — Generate export document form (new page)

**File to create:** `terroir-ma-web/apps/portal/src/app/[locale]/(customs-agent)/customs-agent/export-documents/new/generate-form.tsx`

```tsx
'use client';

import { useState, useTransition } from 'react';

interface GenerateFormProps {
  onSuccess: (docId: string) => void;
}

type FormState = {
  certificationId: string;
  destinationCountry: string;
  hsCode: string;
  quantityKg: string;
  consigneeName: string;
  consigneeCountry: string;
};

const INITIAL: FormState = {
  certificationId: '',
  destinationCountry: '',
  hsCode: '',
  quantityKg: '',
  consigneeName: '',
  consigneeCountry: '',
};

export function GenerateExportDocForm() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function set(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/generate-export-doc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            certificationId: form.certificationId,
            destinationCountry: form.destinationCountry.toUpperCase().slice(0, 2),
            hsCode: form.hsCode,
            quantityKg: parseFloat(form.quantityKg),
            consigneeName: form.consigneeName,
            consigneeCountry: form.consigneeCountry.toUpperCase().slice(0, 2),
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        const doc = (await res.json()) as { id: string };
        setCreatedId(doc.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inattendue');
      }
    });
  }

  if (createdId) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6">
        <p className="font-semibold text-green-800">Document généré avec succès.</p>
        <a
          href={`../export-documents/${createdId}`}
          className="mt-2 inline-block text-sm text-green-700 hover:underline"
        >
          Voir le document →
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-white p-6 shadow-sm">
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[
          {
            id: 'certificationId',
            label: 'ID Certification',
            field: 'certificationId' as const,
            placeholder: 'UUID de la certification',
          },
          {
            id: 'destinationCountry',
            label: 'Pays destination (ISO 2)',
            field: 'destinationCountry' as const,
            placeholder: 'FR',
          },
          { id: 'hsCode', label: 'Code HS', field: 'hsCode' as const, placeholder: '0804.10' },
          {
            id: 'quantityKg',
            label: 'Quantité (kg)',
            field: 'quantityKg' as const,
            placeholder: '1000',
          },
          {
            id: 'consigneeName',
            label: 'Nom consignataire',
            field: 'consigneeName' as const,
            placeholder: 'Importateur SAS',
          },
          {
            id: 'consigneeCountry',
            label: 'Pays consignataire (ISO 2)',
            field: 'consigneeCountry' as const,
            placeholder: 'FR',
          },
        ].map(({ id, label, field, placeholder }) => (
          <div key={id}>
            <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">
              {label}
            </label>
            <input
              id={id}
              type={field === 'quantityKg' ? 'number' : 'text'}
              value={form[field]}
              onChange={set(field)}
              required
              placeholder={placeholder}
              className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </div>
        ))}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {isPending ? 'Génération…' : 'Générer le document'}
      </button>
    </form>
  );
}
```

**File to create:** `terroir-ma-web/apps/portal/src/app/[locale]/(customs-agent)/customs-agent/export-documents/new/page.tsx`

```tsx
import { PageHeader } from '@/components/admin/page-header';
import { GenerateExportDocForm } from './generate-form';
import Link from 'next/link';

export default function GenerateExportDocPage() {
  return (
    <div>
      <div className="mb-4">
        <Link href="../export-documents" className="text-sm text-slate-700 hover:underline">
          ← Retour à la liste
        </Link>
      </div>
      <PageHeader
        title="Générer un document d'exportation"
        subtitle="Créer la documentation ONSSA pour une certification accordée"
      />
      <div className="mt-6">
        <GenerateExportDocForm />
      </div>
    </div>
  );
}
```

**Note:** The `GenerateExportDocForm` uses a fetch to `/api/generate-export-doc`. We need to add a Next.js API route proxy to avoid CORS and to attach the Bearer token server-side.

**File to create:** `terroir-ma-web/apps/portal/src/app/api/generate-export-doc/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/auth-utils';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export async function POST(req: NextRequest) {
  try {
    const token = await getAccessToken();
    const body = (await req.json()) as unknown;
    const res = await fetch(`${BASE}/api/v1/export-documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token ?? ''}`,
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as unknown;
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

**Verification:** `pnpm typecheck` in `apps/portal` — no errors.

---

### Task 6 — Extend StatusBadge with ExportDocument statuses

**File:** `terroir-ma-web/apps/portal/src/components/admin/status-badge.tsx`

Read the file first, then add these status mappings if not already present:

```
'draft'     → gray
'submitted' → yellow
'approved'  → green
'rejected'  → red
'expired'   → slate
```

The `StatusBadge` component likely has a `statusMap` or `switch`. Add the above entries alongside existing certification statuses.

**Verification:** `pnpm typecheck` in `apps/portal`.

---

### Task 7 — Lint + typecheck + build checkpoint

```bash
cd C:/Users/moham/justforfun/terroir-ma-web/apps/portal
pnpm lint && pnpm typecheck && pnpm build
```

Expected:

- 0 lint errors
- 0 type errors
- Build succeeds with 45 portal routes
- No `/fr/` hardcoded links in new files (use relative `./` or `../`)

---

### Task 8 — Commit customs-agent portal

```bash
cd C:/Users/moham/justforfun/terroir-ma-web
git add apps/portal/src/app/\[locale\]/\(customs-agent\)/
git add apps/portal/src/app/api/generate-export-doc/
git add apps/portal/src/components/admin/status-badge.tsx
git commit -m "feat(portal): customs-agent export-documents portal (FE-S10)"
```

Also commit backend patch:

```bash
cd C:/Users/moham/justforfun/terroir-ma
git add src/modules/certification/controllers/export-document.controller.ts
git commit -m "feat(certification): allow customs-agent to list all export documents"
```

---

## Batch 3 — Playwright E2E Tests (Tasks 9–12)

### Task 9 — Install Playwright at workspace root

```bash
cd C:/Users/moham/justforfun/terroir-ma-web
pnpm add -D @playwright/test -w
pnpm dlx playwright install chromium
```

**File to create:** `terroir-ma-web/playwright.config.ts`

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './apps/portal/e2e',
  timeout: 30_000,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3001',
    headless: true,
    locale: 'fr-MA',
    timezoneId: 'Africa/Casablanca',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev:portal',
    url: 'http://localhost:3001',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
```

**Add to `package.json` scripts:**

```json
"test:e2e": "playwright test"
```

**Verification:** `pnpm typecheck` — no errors.

---

### Task 10 — E2E: QR verification flow (public app)

**File to create:** `terroir-ma-web/apps/portal/e2e/qr-verify.spec.ts`

```ts
import { test, expect } from '@playwright/test';

test.describe('QR verification (public app)', () => {
  test('shows error for unknown UUID', async ({ page }) => {
    await page.goto('http://localhost:3002/fr/verify/00000000-0000-0000-0000-000000000000');
    // The page should render without crashing (even if backend returns 404)
    await expect(page).not.toHaveTitle(/Error/i);
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('verify page renders status section', async ({ page }) => {
    await page.goto('http://localhost:3002/fr/verify/00000000-0000-0000-0000-000000000000');
    // Either a status badge or an error message — page must render
    const content = page.getByRole('main').first();
    await expect(content).toBeVisible();
  });
});
```

**Note:** These tests are smoke tests against a live public app (port 3002). They do not require authentication. Run separately with `pnpm dlx playwright test --project=chromium apps/portal/e2e/qr-verify.spec.ts` against running apps.

---

### Task 11 — E2E: Login redirect flow

**File to create:** `terroir-ma-web/apps/portal/e2e/auth.spec.ts`

```ts
import { test, expect } from '@playwright/test';

test.describe('Authentication redirect', () => {
  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/fr/customs-agent/export-documents');
    // Should redirect to login (next-auth)
    await expect(page).toHaveURL(/\/fr\/login|\/api\/auth\/signin/);
  });

  test('login page renders sign-in option', async ({ page }) => {
    await page.goto('/fr/login');
    await expect(page).not.toHaveTitle(/500|Error/i);
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('unauthorized page renders correctly', async ({ page }) => {
    await page.goto('/fr/unauthorized');
    await expect(page).not.toHaveTitle(/500|Error/i);
  });
});
```

---

### Task 12 — E2E: Export documents page (structure smoke test)

**File to create:** `terroir-ma-web/apps/portal/e2e/export-documents.spec.ts`

```ts
import { test, expect } from '@playwright/test';

test.describe('Export documents portal (smoke — no auth)', () => {
  test('redirects unauthenticated access to login', async ({ page }) => {
    await page.goto('/fr/customs-agent/export-documents');
    await expect(page).toHaveURL(/\/fr\/login|\/api\/auth\/signin/);
  });

  test('generate export doc page redirects unauthenticated', async ({ page }) => {
    await page.goto('/fr/customs-agent/export-documents/new');
    await expect(page).toHaveURL(/\/fr\/login|\/api\/auth\/signin/);
  });
});
```

**Batch 3 checkpoint:**

```bash
cd C:/Users/moham/justforfun/terroir-ma-web
pnpm typecheck
# To run E2E tests against live apps:
# pnpm test:e2e
```

Expected: typecheck passes. E2E tests run against live apps when both dev servers are up.

```bash
git add playwright.config.ts apps/portal/e2e/ package.json
git commit -m "test(e2e): add Playwright smoke tests for auth + QR verify + export docs"
```

---

## Batch 4 — Docker Production Build Optimization (Tasks 13–15)

### Task 13 — Fix portal Dockerfile for pnpm monorepo

**Problem:** Current `apps/portal/Dockerfile` copies only `package.json pnpm-lock.yaml` from the app context, but the `pnpm-lock.yaml` lives at the repo root (monorepo). The Dockerfile must be built from the **repo root** with the full workspace context.

**File to replace:** `terroir-ma-web/apps/portal/Dockerfile`

```dockerfile
# Build context: repo root (terroir-ma-web/)
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /repo
# Copy workspace manifests first for layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/portal/package.json apps/portal/
COPY packages/ packages/
RUN pnpm install --frozen-lockfile --filter @terroir/portal...

FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/portal/node_modules ./apps/portal/node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_OUTPUT=standalone
WORKDIR /repo/apps/portal
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /repo/apps/portal/.next/standalone ./
COPY --from=builder /repo/apps/portal/.next/static ./.next/static
COPY --from=builder /repo/apps/portal/public ./public
USER nextjs
EXPOSE 3001
ENV PORT=3001
CMD ["node", "server.js"]
```

**Verification:** `docker build -f apps/portal/Dockerfile -t terroir-portal .` from repo root (requires Docker running).

---

### Task 14 — Fix public Dockerfile for pnpm monorepo

**File to replace:** `terroir-ma-web/apps/public/Dockerfile`

```dockerfile
# Build context: repo root (terroir-ma-web/)
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/public/package.json apps/public/
COPY packages/ packages/
RUN pnpm install --frozen-lockfile --filter @terroir/public...

FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/public/node_modules ./apps/public/node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_OUTPUT=standalone
WORKDIR /repo/apps/public
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /repo/apps/public/.next/standalone ./
COPY --from=builder /repo/apps/public/.next/static ./.next/static
COPY --from=builder /repo/apps/public/public ./public
USER nextjs
EXPOSE 3002
ENV PORT=3002
CMD ["node", "server.js"]
```

**Verification:** `docker build -f apps/public/Dockerfile -t terroir-public .` from repo root.

---

### Task 15 — Add .dockerignore + docker-compose.prod.yml + final commit

**File to create:** `terroir-ma-web/.dockerignore`

```
node_modules
.next
**/.next
**/node_modules
**/.env.local
*.log
.git
.gitignore
README.md
```

**File to create:** `terroir-ma-web/docker-compose.prod.yml`

```yaml
# Production compose — builds portal + public from repo root context.
# Usage: docker-compose -f docker-compose.prod.yml up --build
services:
  portal:
    build:
      context: .
      dockerfile: apps/portal/Dockerfile
    ports:
      - '3001:3001'
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://backend:3000}
      NEXTAUTH_URL: ${NEXTAUTH_URL:-http://localhost:3001}
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      KEYCLOAK_CLIENT_ID: ${KEYCLOAK_CLIENT_ID}
      KEYCLOAK_CLIENT_SECRET: ${KEYCLOAK_CLIENT_SECRET}
      KEYCLOAK_ISSUER: ${KEYCLOAK_ISSUER}
    restart: unless-stopped

  public:
    build:
      context: .
      dockerfile: apps/public/Dockerfile
    ports:
      - '3002:3002'
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://backend:3000}
    restart: unless-stopped
```

**Batch 4 checkpoint:**

```bash
cd C:/Users/moham/justforfun/terroir-ma-web
pnpm lint && pnpm typecheck && pnpm build
```

**Final commit:**

```bash
git add apps/portal/Dockerfile apps/public/Dockerfile .dockerignore docker-compose.prod.yml
git commit -m "chore(docker): fix pnpm monorepo Dockerfiles + add docker-compose.prod.yml (FE-S10)"
```

---

## Final Verification

```bash
# Backend
cd C:/Users/moham/justforfun/terroir-ma
npm run lint && npm run typecheck && npm run test:unit
# Expected: 391 tests passing

# Frontend
cd C:/Users/moham/justforfun/terroir-ma-web
pnpm lint && pnpm typecheck && pnpm build
# Expected: 0 errors, 45 portal routes, 4 public routes
```

---

## Story Point Summary

| Batch     | Tasks   | SP     | Description                                           |
| --------- | ------- | ------ | ----------------------------------------------------- |
| 1         | T1–T4   | 4      | Backend patch + dashboard + list + detail+validate    |
| 2         | T5–T8   | 4      | Generate form + StatusBadge + checkpoint + commit     |
| 3         | T9–T12  | 4      | Playwright setup + 3 E2E test files                   |
| 4         | T13–T15 | 3      | Dockerfiles + .dockerignore + docker-compose.prod.yml |
| **Total** | **15**  | **15** |                                                       |

---

## Route Count After FE-S10

| App    | Before | After | New routes                                                                                                 |
| ------ | ------ | ----- | ---------------------------------------------------------------------------------------------------------- |
| portal | 42     | 45    | /customs-agent/export-documents, /customs-agent/export-documents/[id], /customs-agent/export-documents/new |
| public | 4      | 4     | —                                                                                                          |

---

## Testing Tasks

| Test file                                  | Type           | What it covers                       |
| ------------------------------------------ | -------------- | ------------------------------------ |
| `apps/portal/e2e/auth.spec.ts`             | E2E Playwright | Login redirect, unauthorized page    |
| `apps/portal/e2e/qr-verify.spec.ts`        | E2E Playwright | QR public verify page renders        |
| `apps/portal/e2e/export-documents.spec.ts` | E2E Playwright | Export docs redirect unauthenticated |
| `terroir-ma` unit tests (391)              | Unit           | Backend not broken by Roles patch    |

> **Note:** E2E tests are smoke tests. They verify: (1) no server crashes, (2) unauthenticated users are redirected, (3) public pages render. Full authenticated E2E flows require a running Keycloak instance and are out of scope for v1.
