# FE-S3 — Super-Admin Portal Implementation Plan

> **For Claude:** Use /execute to implement this plan task-by-task.

**Goal:** Build all four super-admin sections under `(super-admin)/super-admin/` — cooperative verification, lab accreditation, SDOQ spec management, and system settings + audit log.

**Architecture:**

- RSC (React Server Components) for all data-fetch pages — call backend via authed `fetch()`
- Server Actions for all mutations — `revalidatePath()` after every write
- No client state for listing pages; Server Actions handle optimistic-style reloads
- `getAccessToken()` from `src/lib/auth-utils.ts` for Bearer token on every server-side call
- API base: `process.env.NEXT_PUBLIC_API_URL` (set in `.env.local`)
- Backend gap: `GET /api/v1/cooperatives` does NOT exist yet — Task 1 adds it to `terroir-ma`

**Repos touched:**

- `terroir-ma` (NestJS backend) — Tasks 1 only
- `terroir-ma-web` (Next.js monorepo) — Tasks 2–13

**Modules Affected:** cooperative (NestJS), product (product-types), certification (labs live in product module), common/admin (settings, audit log)

**Estimated Story Points:** 13

---

## Batch 1 — Backend Patch + Shared FE Infrastructure (Tasks 1–3)

### Task 1 — Backend: Add `GET /api/v1/cooperatives` with status filter

**Repo:** `terroir-ma`

**Files to modify:**

- `src/modules/cooperative/services/cooperative.service.ts`
- `src/modules/cooperative/controllers/cooperative.controller.ts`

**Code:**

In `cooperative.service.ts`, add after the `register` method:

```typescript
/**
 * List all cooperatives, optionally filtered by status (super-admin).
 */
async findAll(
  status?: CooperativeStatus,
  page = 1,
  limit = 20,
): Promise<{ data: Cooperative[]; total: number; page: number; limit: number }> {
  const where = status ? { status } : {};
  const [data, total] = await this.cooperativeRepo.findAndCount({
    where,
    order: { createdAt: 'DESC' },
    skip: (page - 1) * limit,
    take: limit,
  });
  return { data, total, page, limit };
}
```

In `cooperative.controller.ts`, add before the `@Get(':id')` route:

```typescript
@Get()
@Roles('super-admin')
@ApiOperation({ summary: 'US-004/US-006: List all cooperatives with optional status filter (super-admin)' })
@ApiQuery({ name: 'status', required: false, enum: ['pending', 'active', 'suspended', 'revoked'] })
@ApiQuery({ name: 'page', required: false, type: Number })
@ApiQuery({ name: 'limit', required: false, type: Number })
async findAll(
  @Query('status') status?: CooperativeStatus,
  @Query('page') page = 1,
  @Query('limit') limit = 20,
): Promise<{ data: Cooperative[]; total: number; page: number; limit: number }> {
  return this.cooperativeService.findAll(status, +page, +limit);
}
```

**Verification:**

```bash
cd terroir-ma
npm run lint
npm run typecheck
# confirm no errors — no test needed (endpoint is additive, existing tests unaffected)
```

---

### Task 2 — API Client: Add cooperative list type + service function

**Repo:** `terroir-ma-web`

**Files to modify:**

- `packages/api-client/src/generated/types.gen.ts`
- `packages/api-client/src/generated/services.gen.ts`

Add to `types.gen.ts` (after `CooperativeControllerUpdateMemberResponse`):

```typescript
export type CooperativeStatus = 'pending' | 'active' | 'suspended' | 'revoked';

export type CooperativeControllerFindAllData = {
  status?: CooperativeStatus;
  page?: number;
  limit?: number;
};

export type CooperativeControllerFindAllResponse = unknown;
```

Add to `services.gen.ts` (before `cooperativeControllerRegister`):

```typescript
/** List all cooperatives with optional status filter (super-admin, US-004/006) */
export const cooperativeControllerFindAll = (
  data: CooperativeControllerFindAllData = {},
): CancelablePromise<CooperativeControllerFindAllResponse> => {
  return __request(OpenAPI, {
    method: 'GET',
    url: '/api/v1/cooperatives',
    query: {
      status: data.status,
      page: data.page,
      limit: data.limit,
    },
  });
};
```

Also update the import line in `services.gen.ts` to include `CooperativeControllerFindAllData, CooperativeControllerFindAllResponse` in the import list.

**Verification:**

```bash
cd terroir-ma-web
pnpm --filter @terroir/api-client tsc --noEmit
```

---

### Task 3 — Portal: Server-fetch helper + shared admin UI components

**Repo:** `terroir-ma-web`

**Files to create:**

- `apps/portal/src/lib/api-server.ts`
- `apps/portal/src/components/admin/status-badge.tsx`
- `apps/portal/src/components/admin/action-button.tsx`
- `apps/portal/src/components/admin/confirm-modal.tsx`
- `apps/portal/src/components/admin/page-header.tsx`
- `apps/portal/src/components/admin/data-table.tsx`

**`api-server.ts`** — authed fetch wrapper for RSC and Server Actions:

```typescript
import { getAccessToken } from '@/lib/auth-utils';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}
```

**`status-badge.tsx`** — colored pill for entity statuses:

```tsx
const COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  suspended: 'bg-red-100 text-red-800',
  revoked: 'bg-gray-200 text-gray-700',
  accredited: 'bg-blue-100 text-blue-800',
  passed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${COLORS[status] ?? 'bg-gray-100 text-gray-700'}`}
    >
      {status}
    </span>
  );
}
```

**`action-button.tsx`** — submit button that shows pending state:

```tsx
'use client';
import { useFormStatus } from 'react-dom';

export function ActionButton({
  label,
  pendingLabel = 'En cours...',
  variant = 'primary',
  disabled,
}: {
  label: string;
  pendingLabel?: string;
  variant?: 'primary' | 'danger' | 'secondary';
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  const cls = {
    primary: 'bg-green-600 hover:bg-green-700 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800',
  }[variant];
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={`rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${cls}`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
```

**`confirm-modal.tsx`** — client-side confirm dialog triggered by a form:

```tsx
'use client';
import { useState } from 'react';

export function ConfirmModal({
  trigger,
  title,
  children,
  action,
}: {
  trigger: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  action: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <span onClick={() => setOpen(true)} className="cursor-pointer">
        {trigger}
      </span>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">{title}</h3>
            {children}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              >
                Annuler
              </button>
              {action}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

**`page-header.tsx`** — section title + optional action button area:

```tsx
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
```

**`data-table.tsx`** — generic table wrapper (thead + tbody passed as children):

```tsx
export function DataTable({
  head,
  children,
  empty = 'Aucun élément.',
  isEmpty,
}: {
  head: string[];
  children: React.ReactNode;
  empty?: string;
  isEmpty?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {isEmpty ? (
            <tr>
              <td colSpan={head.length} className="px-4 py-8 text-center text-gray-400">
                {empty}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}
```

**Verification:**

```bash
pnpm --filter @terroir/portal typecheck   # 0 errors
pnpm --filter @terroir/portal lint        # 0 warnings
```

---

## Batch 2 — Cooperatives Section (Tasks 4–6)

### Task 4 — Cooperatives list page (RSC, tabbed by status)

**Files to create:**

- `apps/portal/src/app/[locale]/(super-admin)/super-admin/cooperatives/page.tsx`

This is a Server Component. Status filter comes from `searchParams`.

```tsx
import { apiFetch } from '@/lib/api-server';
import { PageHeader } from '@/components/admin/page-header';
import { StatusBadge } from '@/components/admin/status-badge';
import { DataTable } from '@/components/admin/data-table';
import Link from 'next/link';

type Cooperative = {
  id: string;
  name: string;
  ice: string;
  regionCode: string;
  city: string;
  status: string;
  createdAt: string;
};

type PagedResult = {
  data: Cooperative[];
  total: number;
  page: number;
  limit: number;
};

const TABS = [
  { label: 'En attente', value: 'pending' },
  { label: 'Actives', value: 'active' },
  { label: 'Suspendues', value: 'suspended' },
  { label: 'Toutes', value: '' },
];

export default async function CooperativesPage({
  searchParams,
}: {
  searchParams: { status?: string; page?: string };
}) {
  const status = searchParams.status ?? 'pending';
  const page = Number(searchParams.page ?? 1);
  const query = new URLSearchParams({ page: String(page), limit: '20' });
  if (status) query.set('status', status);

  const result = await apiFetch<PagedResult>(`/api/v1/cooperatives?${query}`);

  return (
    <div>
      <PageHeader title="Coopératives" subtitle={`${result.total} coopératives au total`} />

      {/* Status tabs */}
      <div className="mb-4 flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={`?status=${t.value}`}
            className={`px-4 py-2 text-sm font-medium ${
              status === t.value
                ? 'border-b-2 border-green-600 text-green-700'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <DataTable
        head={['Nom', 'ICE', 'Région', 'Ville', 'Statut', 'Créée le', 'Actions']}
        isEmpty={result.data.length === 0}
        empty="Aucune coopérative dans cette catégorie."
      >
        {result.data.map((coop) => (
          <tr key={coop.id} className="hover:bg-gray-50">
            <td className="px-4 py-3 font-medium">{coop.name}</td>
            <td className="px-4 py-3 font-mono text-xs">{coop.ice}</td>
            <td className="px-4 py-3">{coop.regionCode}</td>
            <td className="px-4 py-3">{coop.city}</td>
            <td className="px-4 py-3">
              <StatusBadge status={coop.status} />
            </td>
            <td className="px-4 py-3 text-gray-500">
              {new Date(coop.createdAt).toLocaleDateString('fr-MA')}
            </td>
            <td className="px-4 py-3">
              <Link
                href={`cooperatives/${coop.id}`}
                className="text-green-700 hover:underline text-sm"
              >
                Voir
              </Link>
            </td>
          </tr>
        ))}
      </DataTable>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
        <span>{result.total} résultats</span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link
              href={`?status=${status}&page=${page - 1}`}
              className="rounded border px-3 py-1 hover:bg-gray-50"
            >
              Précédent
            </Link>
          )}
          {page * 20 < result.total && (
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

**Also create detail page placeholder:**

- `apps/portal/src/app/[locale]/(super-admin)/super-admin/cooperatives/[id]/page.tsx`

```tsx
import { apiFetch } from '@/lib/api-server';
import { PageHeader } from '@/components/admin/page-header';
import { StatusBadge } from '@/components/admin/status-badge';
import { VerifyCooperativeForm } from './verify-form';
import { RejectCooperativeForm } from './reject-form';

type Cooperative = {
  id: string;
  name: string;
  nameAr?: string;
  ice: string;
  ifNumber?: string;
  rcNumber?: string;
  email: string;
  phone: string;
  regionCode: string;
  city: string;
  presidentName: string;
  presidentCin: string;
  status: string;
  createdAt: string;
};

export default async function CooperativeDetailPage({ params }: { params: { id: string } }) {
  const coop = await apiFetch<{ success: boolean; data: Cooperative }>(
    `/api/v1/cooperatives/${params.id}`,
  );
  const c = coop.data;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={c.name}
        subtitle={c.nameAr}
        action={
          c.status === 'pending' ? (
            <div className="flex gap-2">
              <VerifyCooperativeForm id={c.id} />
              <RejectCooperativeForm id={c.id} />
            </div>
          ) : undefined
        }
      />
      <div className="mb-6">
        <StatusBadge status={c.status} />
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        {[
          ['ICE', c.ice],
          ['IF', c.ifNumber],
          ['RC', c.rcNumber],
          ['Email', c.email],
          ['Téléphone', c.phone],
          ['Région', c.regionCode],
          ['Ville', c.city],
          ['Président', c.presidentName],
          ['CIN Président', c.presidentCin],
        ].map(([label, value]) =>
          value ? (
            <div key={label}>
              <dt className="font-medium text-gray-500">{label}</dt>
              <dd className="mt-0.5 text-gray-900">{value}</dd>
            </div>
          ) : null,
        )}
      </dl>
    </div>
  );
}
```

**Verification:**

```bash
pnpm --filter @terroir/portal typecheck
pnpm --filter @terroir/portal lint
```

---

### Task 5 — Cooperative verify Server Action + VerifyCooperativeForm

**Files to create:**

- `apps/portal/src/app/[locale]/(super-admin)/super-admin/cooperatives/[id]/verify-form.tsx`
- `apps/portal/src/app/[locale]/(super-admin)/super-admin/cooperatives/actions.ts`

**`actions.ts`:**

```typescript
'use server';
import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api-server';
import { v4 as uuidv4 } from 'uuid';

export async function verifyCooperative(id: string): Promise<void> {
  await apiFetch(`/api/v1/cooperatives/${id}/verify`, {
    method: 'PATCH',
    headers: { 'x-correlation-id': uuidv4() },
    body: JSON.stringify({}),
  });
  revalidatePath('/[locale]/(super-admin)/super-admin/cooperatives', 'page');
}

export async function rejectCooperative(id: string, reason: string): Promise<void> {
  await apiFetch(`/api/v1/cooperatives/${id}/deactivate`, {
    method: 'PUT',
    body: JSON.stringify({ reason }),
  });
  revalidatePath('/[locale]/(super-admin)/super-admin/cooperatives', 'page');
}
```

**`verify-form.tsx`:**

```tsx
'use client';
import { useTransition } from 'react';
import { verifyCooperative } from './actions';
import { useRouter } from 'next/navigation';

export function VerifyCooperativeForm({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleVerify() {
    if (!confirm('Confirmer la vérification de cette coopérative ?')) return;
    startTransition(async () => {
      await verifyCooperative(id);
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleVerify}
      disabled={isPending}
      className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
    >
      {isPending ? 'Vérification...' : 'Vérifier'}
    </button>
  );
}
```

**Verification:**

```bash
pnpm --filter @terroir/portal typecheck
pnpm --filter @terroir/portal lint
```

---

### Task 6 — Cooperative reject Server Action + RejectCooperativeForm

**Files to create:**

- `apps/portal/src/app/[locale]/(super-admin)/super-admin/cooperatives/[id]/reject-form.tsx`

Note: `rejectCooperative` action is already in `actions.ts` from Task 5.

**`reject-form.tsx`:**

```tsx
'use client';
import { useTransition, useState } from 'react';
import { rejectCooperative } from './actions';
import { useRouter } from 'next/navigation';

export function RejectCooperativeForm({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleReject() {
    if (!reason.trim()) return;
    startTransition(async () => {
      await rejectCooperative(id, reason.trim());
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
      >
        Rejeter
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">Rejeter la coopérative</h3>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motif de rejet</label>
            <textarea
              className="w-full rounded border border-gray-300 p-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-400"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Précisez la raison du rejet..."
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              >
                Annuler
              </button>
              <button
                onClick={handleReject}
                disabled={isPending || !reason.trim()}
                className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isPending ? 'Rejet...' : 'Confirmer le rejet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

**Verification:**

```bash
pnpm --filter @terroir/portal typecheck
pnpm --filter @terroir/portal lint
pnpm --filter @terroir/portal build  # checkpoint build
```

---

## Batch 3 — Labs Section (Tasks 7–9)

### Task 7 — Labs list page (RSC with accreditation status)

**Files to create:**

- `apps/portal/src/app/[locale]/(super-admin)/super-admin/labs/page.tsx`

```tsx
import { apiFetch } from '@/lib/api-server';
import { PageHeader } from '@/components/admin/page-header';
import { StatusBadge } from '@/components/admin/status-badge';
import { DataTable } from '@/components/admin/data-table';
import Link from 'next/link';

type Lab = {
  id: string;
  name: string;
  onssaAccreditationNumber?: string;
  isAccredited: boolean;
  createdAt: string;
};

export default async function LabsPage() {
  const result = await apiFetch<{ success: boolean; data: Lab[] }>('/api/v1/labs');
  const labs = result.data ?? [];

  return (
    <div>
      <PageHeader
        title="Laboratoires"
        subtitle={`${labs.length} laboratoires enregistrés`}
        action={
          <Link
            href="labs/new"
            className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
          >
            + Nouveau laboratoire
          </Link>
        }
      />
      <DataTable
        head={['Nom', 'N° Accréditation ONSSA', 'Statut', 'Enregistré le', 'Actions']}
        isEmpty={labs.length === 0}
        empty="Aucun laboratoire enregistré."
      >
        {labs.map((lab) => (
          <tr key={lab.id} className="hover:bg-gray-50">
            <td className="px-4 py-3 font-medium">{lab.name}</td>
            <td className="px-4 py-3 font-mono text-xs">{lab.onssaAccreditationNumber ?? '—'}</td>
            <td className="px-4 py-3">
              <StatusBadge status={lab.isAccredited ? 'accredited' : 'pending'} />
            </td>
            <td className="px-4 py-3 text-gray-500">
              {new Date(lab.createdAt).toLocaleDateString('fr-MA')}
            </td>
            <td className="px-4 py-3">
              <Link href={`labs/${lab.id}`} className="text-green-700 hover:underline text-sm">
                Gérer
              </Link>
            </td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}
```

**Verification:**

```bash
pnpm --filter @terroir/portal typecheck
pnpm --filter @terroir/portal lint
```

---

### Task 8 — Lab accredit/revoke Server Actions + lab detail page

**Files to create:**

- `apps/portal/src/app/[locale]/(super-admin)/super-admin/labs/actions.ts`
- `apps/portal/src/app/[locale]/(super-admin)/super-admin/labs/[id]/page.tsx`

**`actions.ts`:**

```typescript
'use server';
import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api-server';

export async function accreditLab(id: string): Promise<void> {
  await apiFetch(`/api/v1/labs/${id}/accredit`, { method: 'POST', body: '{}' });
  revalidatePath('/[locale]/(super-admin)/super-admin/labs', 'page');
}

export async function revokeLab(id: string): Promise<void> {
  await apiFetch(`/api/v1/labs/${id}/revoke`, { method: 'POST', body: '{}' });
  revalidatePath('/[locale]/(super-admin)/super-admin/labs', 'page');
}

export async function createLab(name: string, onssaAccreditationNumber?: string): Promise<void> {
  await apiFetch('/api/v1/labs', {
    method: 'POST',
    body: JSON.stringify({ name, onssaAccreditationNumber: onssaAccreditationNumber || undefined }),
  });
  revalidatePath('/[locale]/(super-admin)/super-admin/labs', 'page');
}
```

**`labs/[id]/page.tsx`:**

```tsx
import { apiFetch } from '@/lib/api-server';
import { PageHeader } from '@/components/admin/page-header';
import { StatusBadge } from '@/components/admin/status-badge';
import { LabActions } from './lab-actions';

type Lab = {
  id: string;
  name: string;
  onssaAccreditationNumber?: string;
  isAccredited: boolean;
  createdAt: string;
};

export default async function LabDetailPage({ params }: { params: { id: string } }) {
  const res = await apiFetch<{ success: boolean; data: Lab }>(`/api/v1/labs/${params.id}`);
  const lab = res.data;

  return (
    <div className="max-w-xl">
      <PageHeader
        title={lab.name}
        action={<LabActions id={lab.id} isAccredited={lab.isAccredited} />}
      />
      <StatusBadge status={lab.isAccredited ? 'accredited' : 'pending'} />
      <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="font-medium text-gray-500">N° ONSSA</dt>
          <dd>{lab.onssaAccreditationNumber ?? '—'}</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500">Enregistré le</dt>
          <dd>{new Date(lab.createdAt).toLocaleDateString('fr-MA')}</dd>
        </div>
      </dl>
    </div>
  );
}
```

**Also create `apps/portal/src/app/[locale]/(super-admin)/super-admin/labs/[id]/lab-actions.tsx`:**

```tsx
'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { accreditLab, revokeLab } from '../actions';

export function LabActions({ id, isAccredited }: { id: string; isAccredited: boolean }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handle = (fn: () => Promise<void>) => {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  };

  if (isAccredited) {
    return (
      <button
        onClick={() => handle(() => revokeLab(id))}
        disabled={isPending}
        className="rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {isPending ? '...' : "Révoquer l'accréditation"}
      </button>
    );
  }
  return (
    <button
      onClick={() => handle(() => accreditLab(id))}
      disabled={isPending}
      className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
    >
      {isPending ? '...' : 'Accréditer'}
    </button>
  );
}
```

**Verification:**

```bash
pnpm --filter @terroir/portal typecheck
pnpm --filter @terroir/portal lint
```

---

### Task 9 — Create Lab form (new lab page)

**Files to create:**

- `apps/portal/src/app/[locale]/(super-admin)/super-admin/labs/new/page.tsx`

```tsx
'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createLab } from '../actions';
import { PageHeader } from '@/components/admin/page-header';

export default function NewLabPage() {
  const [name, setName] = useState('');
  const [onssa, setOnssa] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Le nom est requis.');
      return;
    }
    setError('');
    startTransition(async () => {
      try {
        await createLab(name.trim(), onssa.trim() || undefined);
        router.push('../labs');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      }
    });
  }

  return (
    <div className="max-w-lg">
      <PageHeader title="Nouveau laboratoire" />
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
          <input
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom du laboratoire"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            N° Accréditation ONSSA
          </label>
          <input
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
            value={onssa}
            onChange={(e) => setOnssa(e.target.value)}
            placeholder="Optionnel"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {isPending ? 'Enregistrement...' : 'Enregistrer'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
}
```

**Verification:**

```bash
pnpm --filter @terroir/portal typecheck
pnpm --filter @terroir/portal lint
pnpm --filter @terroir/portal build   # checkpoint build — should compile all 16 routes
```

---

## Batch 4 — SDOQ Specifications Section (Tasks 10–11)

### Task 10 — SDOQ Specs list + create form

**Files to create:**

- `apps/portal/src/app/[locale]/(super-admin)/super-admin/specifications/page.tsx`
- `apps/portal/src/app/[locale]/(super-admin)/super-admin/specifications/actions.ts`
- `apps/portal/src/app/[locale]/(super-admin)/super-admin/specifications/new/page.tsx`

**`actions.ts`:**

```typescript
'use server';
import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api-server';

export async function createProductType(formData: FormData): Promise<void> {
  const body = {
    code: formData.get('code') as string,
    nameFr: formData.get('nameFr') as string,
    nameAr: formData.get('nameAr') as string,
    nameZgh: (formData.get('nameZgh') as string) || undefined,
    certificationType: formData.get('certificationType') as 'IGP' | 'AOP' | 'LA',
    regionCode: formData.get('regionCode') as string,
    labTestParameters: [],
    hsCode: (formData.get('hsCode') as string) || undefined,
    onssaCategory: (formData.get('onssaCategory') as string) || undefined,
  };
  await apiFetch('/api/v1/product-types', { method: 'POST', body: JSON.stringify(body) });
  revalidatePath('/[locale]/(super-admin)/super-admin/specifications', 'page');
}

export async function updateProductType(id: string, formData: FormData): Promise<void> {
  const body = {
    nameFr: formData.get('nameFr') as string,
    nameAr: formData.get('nameAr') as string,
    nameZgh: (formData.get('nameZgh') as string) || undefined,
    hsCode: (formData.get('hsCode') as string) || undefined,
    validityDays: formData.get('validityDays') ? Number(formData.get('validityDays')) : undefined,
  };
  await apiFetch(`/api/v1/product-types/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  revalidatePath('/[locale]/(super-admin)/super-admin/specifications', 'page');
}

export async function deactivateProductType(id: string): Promise<void> {
  await apiFetch(`/api/v1/product-types/${id}/deactivate`, { method: 'DELETE' });
  revalidatePath('/[locale]/(super-admin)/super-admin/specifications', 'page');
}
```

**`specifications/page.tsx`:**

```tsx
import { apiFetch } from '@/lib/api-server';
import { PageHeader } from '@/components/admin/page-header';
import { StatusBadge } from '@/components/admin/status-badge';
import { DataTable } from '@/components/admin/data-table';
import Link from 'next/link';

type ProductType = {
  id: string;
  code: string;
  nameFr: string;
  nameAr: string;
  certificationType: string;
  regionCode: string;
  isActive: boolean;
  validityDays?: number;
  hsCode?: string;
};

type PagedResult = { data: ProductType[]; total: number };

export default async function SpecificationsPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const page = Number(searchParams.page ?? 1);
  const result = await apiFetch<PagedResult>(`/api/v1/product-types?page=${page}&limit=20`);
  const specs = result.data ?? [];

  return (
    <div>
      <PageHeader
        title="Spécifications SDOQ"
        subtitle={`${result.total} types de produits`}
        action={
          <Link
            href="specifications/new"
            className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
          >
            + Nouvelle spécification
          </Link>
        }
      />
      <DataTable
        head={[
          'Code',
          'Nom (FR)',
          'Type',
          'Région',
          'HS Code',
          'Validité (j)',
          'Statut',
          'Actions',
        ]}
        isEmpty={specs.length === 0}
        empty="Aucune spécification enregistrée."
      >
        {specs.map((s) => (
          <tr key={s.id} className="hover:bg-gray-50">
            <td className="px-4 py-3 font-mono text-xs">{s.code}</td>
            <td className="px-4 py-3 font-medium">{s.nameFr}</td>
            <td className="px-4 py-3">
              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-800">
                {s.certificationType}
              </span>
            </td>
            <td className="px-4 py-3">{s.regionCode}</td>
            <td className="px-4 py-3 font-mono text-xs">{s.hsCode ?? '—'}</td>
            <td className="px-4 py-3">{s.validityDays ?? '—'}</td>
            <td className="px-4 py-3">
              <StatusBadge status={s.isActive ? 'active' : 'suspended'} />
            </td>
            <td className="px-4 py-3">
              <Link
                href={`specifications/${s.id}`}
                className="text-green-700 hover:underline text-sm"
              >
                Modifier
              </Link>
            </td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}
```

**`specifications/new/page.tsx`:**

```tsx
import { createProductType } from '../actions';
import { PageHeader } from '@/components/admin/page-header';

export default function NewSpecPage() {
  return (
    <div className="max-w-xl">
      <PageHeader title="Nouvelle spécification SDOQ" />
      <form action={createProductType} className="flex flex-col gap-4">
        {[
          {
            name: 'code',
            label: 'Code unique *',
            placeholder: 'Ex: ARGAN-IGP-SOUSS',
            required: true,
          },
          { name: 'nameFr', label: 'Nom FR *', placeholder: 'Nom en français', required: true },
          { name: 'nameAr', label: 'Nom AR *', placeholder: 'الاسم بالعربية', required: true },
          { name: 'nameZgh', label: 'Nom Amazigh', placeholder: 'ⴰⵙⵎⴰⵡⴰⵍ', required: false },
          {
            name: 'regionCode',
            label: 'Code région *',
            placeholder: 'Ex: SOUSS-MASSA',
            required: true,
          },
          { name: 'hsCode', label: 'Code HS', placeholder: 'Ex: 1515.30', required: false },
          {
            name: 'onssaCategory',
            label: 'Catégorie ONSSA',
            placeholder: 'Optionnel',
            required: false,
          },
        ].map(({ name, label, placeholder, required }) => (
          <div key={name}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <input
              name={name}
              required={required}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
              placeholder={placeholder}
            />
          </div>
        ))}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type SDOQ *</label>
          <select
            name="certificationType"
            required
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
          >
            <option value="IGP">IGP — Indication Géographique Protégée</option>
            <option value="AOP">AOP — Appellation d'Origine Protégée</option>
            <option value="LA">Label Agricole</option>
          </select>
        </div>
        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  );
}
```

**Verification:**

```bash
pnpm --filter @terroir/portal typecheck
pnpm --filter @terroir/portal lint
```

---

### Task 11 — SDOQ Spec edit + deactivate page

**Files to create:**

- `apps/portal/src/app/[locale]/(super-admin)/super-admin/specifications/[id]/page.tsx`
- `apps/portal/src/app/[locale]/(super-admin)/super-admin/specifications/[id]/spec-actions.tsx`

**`specifications/[id]/page.tsx`:**

```tsx
import { apiFetch } from '@/lib/api-server';
import { PageHeader } from '@/components/admin/page-header';
import { StatusBadge } from '@/components/admin/status-badge';
import { updateProductType, deactivateProductType } from '../actions';
import { SpecActions } from './spec-actions';

type ProductType = {
  id: string;
  code: string;
  nameFr: string;
  nameAr: string;
  nameZgh?: string;
  certificationType: string;
  regionCode: string;
  isActive: boolean;
  validityDays?: number;
  hsCode?: string;
  onssaCategory?: string;
};

export default async function SpecDetailPage({ params }: { params: { id: string } }) {
  const res = await apiFetch<{ success: boolean; data: ProductType }>(
    `/api/v1/product-types/${params.id}`,
  );
  const s = res.data;

  const updateAction = updateProductType.bind(null, s.id);

  return (
    <div className="max-w-xl">
      <PageHeader
        title={s.nameFr}
        subtitle={`Code: ${s.code} · ${s.certificationType}`}
        action={s.isActive ? <SpecActions id={s.id} /> : undefined}
      />
      <div className="mb-6">
        <StatusBadge status={s.isActive ? 'active' : 'suspended'} />
      </div>

      <form action={updateAction} className="flex flex-col gap-4">
        {[
          { name: 'nameFr', label: 'Nom FR', defaultValue: s.nameFr },
          { name: 'nameAr', label: 'Nom AR', defaultValue: s.nameAr },
          { name: 'nameZgh', label: 'Nom Amazigh', defaultValue: s.nameZgh ?? '' },
          { name: 'hsCode', label: 'Code HS', defaultValue: s.hsCode ?? '' },
          {
            name: 'validityDays',
            label: 'Validité (jours)',
            defaultValue: String(s.validityDays ?? ''),
          },
        ].map(({ name, label, defaultValue }) => (
          <div key={name}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <input
              name={name}
              defaultValue={defaultValue}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>
        ))}
        <div>
          <button
            type="submit"
            className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            Enregistrer les modifications
          </button>
        </div>
      </form>
    </div>
  );
}
```

**`specifications/[id]/spec-actions.tsx`:**

```tsx
'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deactivateProductType } from '../actions';

export function SpecActions({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDeactivate() {
    if (!confirm('Désactiver cette spécification ?')) return;
    startTransition(async () => {
      await deactivateProductType(id);
      router.push('../specifications');
    });
  }

  return (
    <button
      onClick={handleDeactivate}
      disabled={isPending}
      className="rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      {isPending ? '...' : 'Désactiver'}
    </button>
  );
}
```

**Verification:**

```bash
pnpm --filter @terroir/portal typecheck
pnpm --filter @terroir/portal lint
pnpm --filter @terroir/portal build   # checkpoint — should show ~20 routes
```

---

## Batch 5 — Settings, Audit Log, i18n + Home Dashboard (Tasks 12–13)

### Task 12 — Settings page (3 forms via Server Actions)

**Files to create:**

- `apps/portal/src/app/[locale]/(super-admin)/super-admin/settings/page.tsx`
- `apps/portal/src/app/[locale]/(super-admin)/super-admin/settings/actions.ts`

**`settings/actions.ts`:**

```typescript
'use server';
import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api-server';

export async function updateCampaignSettings(formData: FormData): Promise<void> {
  await apiFetch('/api/v1/admin/settings/campaign', {
    method: 'PATCH',
    body: JSON.stringify({
      currentCampaignYear: formData.get('currentCampaignYear'),
      campaignStartMonth: Number(formData.get('campaignStartMonth')),
      campaignEndMonth: Number(formData.get('campaignEndMonth')),
    }),
  });
  revalidatePath('/[locale]/(super-admin)/super-admin/settings', 'page');
}

export async function updateCertificationSettings(formData: FormData): Promise<void> {
  await apiFetch('/api/v1/admin/settings/certification', {
    method: 'PATCH',
    body: JSON.stringify({
      defaultValidityDays: Number(formData.get('defaultValidityDays')),
      maxRenewalGraceDays: Number(formData.get('maxRenewalGraceDays')),
    }),
  });
  revalidatePath('/[locale]/(super-admin)/super-admin/settings', 'page');
}

export async function updatePlatformSettings(formData: FormData): Promise<void> {
  await apiFetch('/api/v1/admin/settings/platform', {
    method: 'PATCH',
    body: JSON.stringify({
      maintenanceMode: formData.get('maintenanceMode') === 'true',
      supportEmail: formData.get('supportEmail'),
    }),
  });
  revalidatePath('/[locale]/(super-admin)/super-admin/settings', 'page');
}
```

**`settings/page.tsx`:**

```tsx
import { apiFetch } from '@/lib/api-server';
import { PageHeader } from '@/components/admin/page-header';
import {
  updateCampaignSettings,
  updateCertificationSettings,
  updatePlatformSettings,
} from './actions';

type CampaignSettings = {
  currentCampaignYear: string;
  campaignStartMonth: number;
  campaignEndMonth: number;
};
type CertSettings = { defaultValidityDays: number; maxRenewalGraceDays: number };
type PlatformSettings = { maintenanceMode: boolean; supportEmail: string };

const inputCls =
  'w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-500';
const saveCls = 'rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700';
const sectionCls = 'rounded-lg border border-gray-200 bg-white p-5 shadow-sm';

export default async function SettingsPage() {
  const [campaign, cert, platform] = await Promise.all([
    apiFetch<{ success: boolean; data: CampaignSettings }>('/api/v1/admin/settings/campaign'),
    apiFetch<{ success: boolean; data: CertSettings }>('/api/v1/admin/settings/certification'),
    apiFetch<{ success: boolean; data: PlatformSettings }>('/api/v1/admin/settings/platform'),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Paramètres système" />

      {/* Campaign settings */}
      <section className={sectionCls}>
        <h2 className="mb-4 text-base font-semibold">Campagne agricole</h2>
        <form action={updateCampaignSettings} className="flex flex-col gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Année de campagne
            </label>
            <input
              name="currentCampaignYear"
              defaultValue={campaign.data.currentCampaignYear}
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mois début</label>
              <input
                type="number"
                name="campaignStartMonth"
                min={1}
                max={12}
                defaultValue={campaign.data.campaignStartMonth}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mois fin</label>
              <input
                type="number"
                name="campaignEndMonth"
                min={1}
                max={12}
                defaultValue={campaign.data.campaignEndMonth}
                className={inputCls}
              />
            </div>
          </div>
          <button type="submit" className={saveCls}>
            Enregistrer
          </button>
        </form>
      </section>

      {/* Certification settings */}
      <section className={sectionCls}>
        <h2 className="mb-4 text-base font-semibold">Certification</h2>
        <form action={updateCertificationSettings} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Validité par défaut (jours)
              </label>
              <input
                type="number"
                name="defaultValidityDays"
                defaultValue={cert.data.defaultValidityDays}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Délai de grâce renouvellement (jours)
              </label>
              <input
                type="number"
                name="maxRenewalGraceDays"
                defaultValue={cert.data.maxRenewalGraceDays}
                className={inputCls}
              />
            </div>
          </div>
          <button type="submit" className={saveCls}>
            Enregistrer
          </button>
        </form>
      </section>

      {/* Platform settings */}
      <section className={sectionCls}>
        <h2 className="mb-4 text-base font-semibold">Plateforme</h2>
        <form action={updatePlatformSettings} className="flex flex-col gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email support</label>
            <input
              type="email"
              name="supportEmail"
              defaultValue={platform.data.supportEmail}
              className={inputCls}
            />
          </div>
          <div className="flex items-center gap-2">
            <input type="hidden" name="maintenanceMode" value="false" />
            <input
              type="checkbox"
              name="maintenanceMode"
              value="true"
              id="maintenance"
              defaultChecked={platform.data.maintenanceMode}
              className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            <label htmlFor="maintenance" className="text-sm font-medium text-gray-700">
              Mode maintenance
            </label>
          </div>
          <button type="submit" className={saveCls}>
            Enregistrer
          </button>
        </form>
      </section>
    </div>
  );
}
```

**Verification:**

```bash
pnpm --filter @terroir/portal typecheck
pnpm --filter @terroir/portal lint
```

---

### Task 13 — Audit log + i18n keys + super-admin home + final build

**Files to create/modify:**

**1. `apps/portal/src/app/[locale]/(super-admin)/super-admin/settings/audit-log/page.tsx`:**

```tsx
import { apiFetch } from '@/lib/api-server';
import { PageHeader } from '@/components/admin/page-header';
import { DataTable } from '@/components/admin/data-table';
import Link from 'next/link';

type AuditEntry = {
  id: string;
  action: string;
  userId: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  details?: Record<string, unknown>;
};

type PagedAudit = { data: AuditEntry[]; total: number; page: number; limit: number };

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: { page?: string; from?: string; to?: string };
}) {
  const page = Number(searchParams.page ?? 1);
  const query = new URLSearchParams({ page: String(page), limit: '30' });
  if (searchParams.from) query.set('from', searchParams.from);
  if (searchParams.to) query.set('to', searchParams.to);

  const result = await apiFetch<{ success: boolean; data: PagedAudit }>(
    `/api/v1/admin/audit-logs?${query}`,
  );
  const logs = result.data?.data ?? [];
  const total = result.data?.total ?? 0;

  return (
    <div>
      <PageHeader title="Journal d'audit" subtitle={`${total} entrées`} />

      {/* Date filter */}
      <form method="GET" className="mb-4 flex gap-3 text-sm">
        <div className="flex items-center gap-1">
          <label className="text-gray-500">Du</label>
          <input
            type="date"
            name="from"
            defaultValue={searchParams.from}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </div>
        <div className="flex items-center gap-1">
          <label className="text-gray-500">Au</label>
          <input
            type="date"
            name="to"
            defaultValue={searchParams.to}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded bg-gray-800 px-3 py-1 text-sm text-white hover:bg-gray-700"
        >
          Filtrer
        </button>
      </form>

      <DataTable
        head={['Action', 'Utilisateur', 'Entité', 'Entité ID', 'Date']}
        isEmpty={logs.length === 0}
        empty="Aucune entrée dans la plage sélectionnée."
      >
        {logs.map((log) => (
          <tr key={log.id} className="hover:bg-gray-50">
            <td className="px-4 py-3 font-mono text-xs">{log.action}</td>
            <td className="px-4 py-3 font-mono text-xs truncate max-w-[120px]">{log.userId}</td>
            <td className="px-4 py-3">{log.entityType}</td>
            <td className="px-4 py-3 font-mono text-xs">{log.entityId?.slice(0, 8)}…</td>
            <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
              {new Date(log.createdAt).toLocaleString('fr-MA')}
            </td>
          </tr>
        ))}
      </DataTable>

      <div className="mt-4 flex gap-2 text-sm">
        {page > 1 && (
          <Link href={`?page=${page - 1}`} className="rounded border px-3 py-1 hover:bg-gray-50">
            Précédent
          </Link>
        )}
        {page * 30 < total && (
          <Link href={`?page=${page + 1}`} className="rounded border px-3 py-1 hover:bg-gray-50">
            Suivant
          </Link>
        )}
      </div>
    </div>
  );
}
```

**2. Add audit log link to settings section nav in `layout.tsx`.**
Modify `apps/portal/src/app/[locale]/(super-admin)/super-admin/layout.tsx`:
Change `{ href: '/fr/super-admin/settings', label: 'Paramètres & Logs' }` to two entries:

```typescript
{ href: '/fr/super-admin/settings', label: 'Paramètres' },
{ href: '/fr/super-admin/settings/audit-log', label: 'Journal d\'audit' },
```

**3. Update super-admin home `page.tsx` with quick-stats cards:**

Replace `apps/portal/src/app/[locale]/(super-admin)/super-admin/page.tsx` with:

```tsx
import { apiFetch } from '@/lib/api-server';

type Dashboard = {
  cooperatives: { total: number; pending: number; active: number };
  certifications: { granted: number; pending: number };
  labTests: { passed: number; failed: number };
};

export default async function SuperAdminHome() {
  let dash: Dashboard | null = null;
  try {
    const res = await apiFetch<{ success: boolean; data: Dashboard }>('/api/v1/admin/dashboard');
    dash = res.data;
  } catch {
    // backend offline — show placeholder
  }

  const cards = dash
    ? [
        {
          label: 'Coopératives en attente',
          value: dash.cooperatives.pending,
          color: 'bg-yellow-50 border-yellow-200',
        },
        {
          label: 'Coopératives actives',
          value: dash.cooperatives.active,
          color: 'bg-green-50 border-green-200',
        },
        {
          label: 'Certifications accordées',
          value: dash.certifications.granted,
          color: 'bg-blue-50 border-blue-200',
        },
        {
          label: 'Tests en attente',
          value: dash.certifications.pending,
          color: 'bg-purple-50 border-purple-200',
        },
      ]
    : [];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Tableau de bord</h1>
      {cards.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className={`rounded-lg border p-4 ${c.color}`}>
              <p className="text-2xl font-bold text-gray-900">{c.value}</p>
              <p className="mt-1 text-sm text-gray-600">{c.label}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-400">
          Données de tableau de bord indisponibles (backend hors ligne).
        </p>
      )}
    </div>
  );
}
```

**4. Add i18n keys to `messages/fr.json`, `ar.json`, `zgh.json`:**

`fr.json` — add:

```json
"superAdmin": {
  "cooperatives": "Coopératives",
  "labs": "Laboratoires",
  "specifications": "Spécifications SDOQ",
  "settings": "Paramètres",
  "auditLog": "Journal d'audit",
  "verify": "Vérifier",
  "reject": "Rejeter",
  "accredit": "Accréditer",
  "revoke": "Révoquer",
  "status": {
    "pending": "En attente",
    "active": "Active",
    "suspended": "Suspendue",
    "accredited": "Accréditée"
  }
}
```

`ar.json` — add equivalent Arabic keys.
`zgh.json` — add equivalent Amazigh keys.

**Final verification:**

```bash
pnpm --filter @terroir/portal typecheck   # 0 errors
pnpm --filter @terroir/portal lint        # 0 warnings
pnpm --filter @terroir/portal build       # green, ~22 routes
```

---

## Story Points

| Task      | Description                                         | SP     |
| --------- | --------------------------------------------------- | ------ |
| 1         | Backend: `GET /api/v1/cooperatives`                 | 1      |
| 2         | API client: cooperative list types + service fn     | 1      |
| 3         | Portal: `api-server.ts` + 5 shared UI components    | 1      |
| 4         | Cooperatives list page (RSC, tabbed) + detail page  | 2      |
| 5         | Verify cooperative Server Action + VerifyForm       | 1      |
| 6         | Reject cooperative Server Action + RejectForm modal | 1      |
| 7         | Labs list page (RSC)                                | 1      |
| 8         | Lab accredit/revoke Server Actions + detail page    | 1      |
| 9         | Create lab form (new lab page)                      | 1      |
| 10        | SDOQ specs list + create form (RSC + SA)            | 1      |
| 11        | SDOQ spec edit + deactivate                         | 1      |
| 12        | Settings page (3 forms, Server Actions)             | 1      |
| 13        | Audit log + i18n + home dashboard + build           | 1      |
| **Total** |                                                     | **13** |

---

## Route Table (expected after FE-S3)

| Route                                       | Type                        |
| ------------------------------------------- | --------------------------- |
| `/[locale]/super-admin`                     | Dynamic (RSC)               |
| `/[locale]/super-admin/cooperatives`        | Dynamic (RSC, searchParams) |
| `/[locale]/super-admin/cooperatives/[id]`   | Dynamic (RSC)               |
| `/[locale]/super-admin/labs`                | Dynamic (RSC)               |
| `/[locale]/super-admin/labs/new`            | Dynamic (Client)            |
| `/[locale]/super-admin/labs/[id]`           | Dynamic (RSC)               |
| `/[locale]/super-admin/specifications`      | Dynamic (RSC)               |
| `/[locale]/super-admin/specifications/new`  | Dynamic (RSC+SA)            |
| `/[locale]/super-admin/specifications/[id]` | Dynamic (RSC+SA)            |
| `/[locale]/super-admin/settings`            | Dynamic (RSC+SA)            |
| `/[locale]/super-admin/settings/audit-log`  | Dynamic (RSC, searchParams) |

---

## Architecture Notes

- **Server Actions vs `useTransition`:** Server Actions bound to `<form action>` for pure-server flows (new spec, settings). `useTransition` + async SA call for client-triggered actions (verify/reject/accredit) that need confirm-first UI.
- **`uuid` dependency:** `actions.ts` for cooperatives uses `uuidv4()` for `x-correlation-id` header. Add `uuid` to portal deps if not present: `pnpm --filter @terroir/portal add uuid && pnpm --filter @terroir/portal add -D @types/uuid`.
- **`cache: 'no-store'`:** All `apiFetch` calls bypass Next.js cache — admin data must always be fresh.
- **No cross-module imports:** Frontend only calls REST endpoints — module boundary remains clean.
