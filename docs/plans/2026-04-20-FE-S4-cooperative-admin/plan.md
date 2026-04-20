# FE-S4 Cooperative-Admin Portal — Implementation Plan

> **For Claude:** Use /execute to implement this plan task-by-task.

**Goal:** Build all cooperative-admin sections — member management, farm mapping, product list, batch list + detail — under the `(cooperative-admin)/cooperative-admin/` route group.

**Architecture:** Next.js RSC for all list/detail pages · Server Actions for all mutations · `apiFetch<T>` transport · `cooperative_id` extracted from Keycloak JWT in NextAuth session

**Tech Stack:** Next.js 14 App Router · next-auth v5 · next-intl · Tailwind v3 · shadcn-compatible components · NestJS backend

**Repos affected:** `terroir-ma-web` (frontend — primary) · `terroir-ma` (backend — 1 gap patch)

**Estimated Story Points:** 13

---

## Pre-flight API Inventory

| Endpoint                                           | Status     | Notes                    |
| -------------------------------------------------- | ---------- | ------------------------ |
| `GET /api/v1/cooperatives/:id/members`             | ✅         | `getMembers` — paginated |
| `POST /api/v1/cooperatives/:id/members`            | ✅         | `addMember`              |
| `PATCH /api/v1/cooperatives/:id/members/:memberId` | ✅         | `updateMember`           |
| `GET /api/v1/cooperatives/:id/farms`               | ❌ **GAP** | Patched in Task 2        |
| `POST /api/v1/cooperatives/:id/farms`              | ✅         | `mapFarm`                |
| `GET /api/v1/products/cooperative/:cooperativeId`  | ✅         | `findByCooperative`      |
| `GET /api/v1/batches/cooperative/:cooperativeId`   | ✅         | `findByCooperative`      |
| `GET /api/v1/batches/:id`                          | ✅         | `findById`               |
| `GET /api/v1/batches/:id/processing-steps`         | ✅         | `listProcessingSteps`    |

**Auth gap:** `cooperative_id` is a Keycloak JWT claim but is NOT extracted into the NextAuth session. Patched in Task 1.

---

## Batch 1 — Foundation (Tasks 1–3)

### Task 1 — Extract cooperative_id into NextAuth session

**Files to modify:**

- `apps/portal/src/auth.ts`
- `apps/portal/src/types/next-auth.d.ts`
- `apps/portal/src/lib/auth-utils.ts`

**auth.ts** — extend `jwt` callback to extract `cooperative_id` from the Keycloak JWT profile:

```ts
jwt({ token, account, profile }) {
  if (account) {
    token.accessToken = account.access_token;
    const prof = profile as {
      realm_access?: { roles?: string[] };
      cooperative_id?: string;
    };
    token.roles = prof?.realm_access?.roles ?? [];
    token.cooperativeId = prof?.cooperative_id ?? null;
  }
  return token;
},
session({ session, token }) {
  session.accessToken = token.accessToken as string;
  (session.user as { roles?: string[] }).roles = token.roles as string[];
  (session.user as { cooperativeId?: string | null }).cooperativeId =
    token.cooperativeId as string | null;
  return session;
},
```

**next-auth.d.ts** — add `cooperativeId` to Session.user and JWT:

```ts
declare module 'next-auth' {
  interface Session {
    accessToken: string;
    user: {
      roles: string[];
      cooperativeId: string | null;
    } & DefaultSession['user'];
  }
}
declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    roles?: string[];
    cooperativeId?: string | null;
  }
}
```

**auth-utils.ts** — add `getCooperativeId()`:

```ts
export async function getCooperativeId(): Promise<string | null> {
  const session = await auth();
  return (session?.user as { cooperativeId?: string | null })?.cooperativeId ?? null;
}
```

**Verification:** `pnpm --filter @terroir/portal typecheck` — 0 errors

---

### Task 2 — Backend patch: GET /cooperatives/:id/farms

**Files to modify (terroir-ma repo):**

- `src/modules/cooperative/services/cooperative.service.ts`
- `src/modules/cooperative/controllers/cooperative.controller.ts`

**cooperative.service.ts** — add `getFarms()`:

```ts
/** List all farms for a cooperative (paginated). */
async getFarms(
  cooperativeId: string,
  page = 1,
  limit = 20,
): Promise<{ data: Farm[]; total: number; page: number; limit: number }> {
  const [data, total] = await this.farmRepo.findAndCount({
    where: { cooperativeId },
    order: { createdAt: 'DESC' },
    skip: (page - 1) * limit,
    take: limit,
  });
  return { data, total, page, limit };
}
```

**cooperative.controller.ts** — add after `POST :id/farms`:

```ts
/** List farms for a cooperative (US-012 support) */
@Get(':id/farms')
@UseGuards(RolesGuard)
@Roles('cooperative-admin', 'super-admin')
@ApiOperation({ summary: 'List all farms for a cooperative' })
@ApiQuery({ name: 'page', required: false, type: Number })
@ApiQuery({ name: 'limit', required: false, type: Number })
async getFarms(
  @Param('id') id: string,
  @Query('page') page = '1',
  @Query('limit') limit = '20',
): Promise<{ data: Farm[]; total: number; page: number; limit: number }> {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, parseInt(limit, 10) || 20);
  return this.cooperativeService.getFarms(id, pageNum, limitNum);
}
```

**Verification (terroir-ma):**

```bash
npm run typecheck   # 0 errors
npm run lint        # 0 warnings
npm run test:unit   # all pass
```

---

### Task 3 — Cooperative-admin layout with sidebar nav

**File to create:** `apps/portal/src/app/[locale]/(cooperative-admin)/cooperative-admin/layout.tsx`

Sidebar nav links (hardcoded `/fr/` prefix — same pattern as super-admin, RTL migration in FE-S9):

- Tableau de bord → `/fr/cooperative-admin`
- Membres → `/fr/cooperative-admin/members`
- Fermes → `/fr/cooperative-admin/farms`
- Produits → `/fr/cooperative-admin/products`
- Lots → `/fr/cooperative-admin/batches`

```tsx
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

const NAV = [
  { href: '/fr/cooperative-admin', label: 'Tableau de bord' },
  { href: '/fr/cooperative-admin/members', label: 'Membres' },
  { href: '/fr/cooperative-admin/farms', label: 'Fermes' },
  { href: '/fr/cooperative-admin/products', label: 'Produits' },
  { href: '/fr/cooperative-admin/batches', label: 'Lots de production' },
];

export default async function CooperativeAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/fr/login');
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 bg-green-800 text-white flex flex-col p-4 gap-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-green-300 mb-3">
          Coopérative
        </p>
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="rounded px-3 py-2 text-sm hover:bg-green-700 transition-colors"
          >
            {n.label}
          </Link>
        ))}
      </aside>
      <main className="flex-1 p-8 bg-gray-50">{children}</main>
    </div>
  );
}
```

**Verification:** `pnpm --filter @terroir/portal typecheck && pnpm --filter @terroir/portal lint`

---

## Batch 2 — Members (Tasks 4–6)

### Task 4 — Members list page

**File to create:** `apps/portal/src/app/[locale]/(cooperative-admin)/cooperative-admin/members/page.tsx`

RSC. Calls `GET /api/v1/cooperatives/:cooperativeId/members?page=N&limit=20`.
Displays: full name, CIN, phone, email, role badge, active status, joined date.
Pagination via `?page=` searchParam.

```tsx
import { apiFetch } from '@/lib/api-server';
import { getCooperativeId } from '@/lib/auth-utils';
import { PageHeader } from '@/components/admin/page-header';
import { DataTable } from '@/components/admin/data-table';
import { StatusBadge } from '@/components/admin/status-badge';
import Link from 'next/link';

type Member = {
  id: string;
  fullName: string;
  cin: string;
  phone: string;
  email: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
};
type PagedMembers = {
  success: boolean;
  data: Member[];
  meta: { page: number; limit: number; total: number };
};

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const cooperativeId = await getCooperativeId();
  if (!cooperativeId) return <p>Coopérative introuvable.</p>;

  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));
  const result = await apiFetch<PagedMembers>(
    `/api/v1/cooperatives/${cooperativeId}/members?page=${page}&limit=20`,
  );

  return (
    <div>
      <PageHeader
        title="Membres"
        subtitle={`${result.meta.total} membres`}
        action={
          <Link
            href="members/new"
            className="rounded bg-green-700 px-4 py-2 text-sm text-white hover:bg-green-800"
          >
            + Ajouter
          </Link>
        }
      />
      <DataTable
        head={['Nom', 'CIN', 'Téléphone', 'Email', 'Rôle', 'Statut', 'Ajouté le']}
        isEmpty={result.data.length === 0}
        empty="Aucun membre enregistré."
      >
        {result.data.map((m) => (
          <tr key={m.id} className="hover:bg-gray-50">
            <td className="px-4 py-3 font-medium">{m.fullName}</td>
            <td className="px-4 py-3 font-mono text-xs">{m.cin}</td>
            <td className="px-4 py-3">{m.phone}</td>
            <td className="px-4 py-3 text-gray-500">{m.email ?? '—'}</td>
            <td className="px-4 py-3 capitalize">{m.role}</td>
            <td className="px-4 py-3">
              <StatusBadge status={m.isActive ? 'active' : 'inactive'} />
            </td>
            <td className="px-4 py-3 text-gray-500">
              {new Date(m.createdAt).toLocaleDateString('fr-MA')}
            </td>
          </tr>
        ))}
      </DataTable>
      <div className="mt-4 flex justify-between text-sm text-gray-500">
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

**Verification:** `pnpm --filter @terroir/portal typecheck`

---

### Task 5 — Add member form page

**File to create:** `apps/portal/src/app/[locale]/(cooperative-admin)/cooperative-admin/members/new/page.tsx`

Client component form. Fields: fullName, fullNameAr (optional), cin, phone, email (optional), role (select: president/secretary/treasurer/member).
On submit calls `addMember` Server Action, redirects to members list on success.

```tsx
'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addMember } from '../actions';

const ROLES = ['member', 'president', 'secretary', 'treasurer'] as const;

export default function AddMemberPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await addMember({
        fullName: fd.get('fullName') as string,
        fullNameAr: (fd.get('fullNameAr') as string) || undefined,
        cin: fd.get('cin') as string,
        phone: fd.get('phone') as string,
        email: (fd.get('email') as string) || undefined,
        role: fd.get('role') as string,
      });
      router.push('/fr/cooperative-admin/members');
    });
  }

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-2xl font-bold">Ajouter un membre</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          name="fullName"
          placeholder="Nom complet (fr)"
          required
          className="rounded border px-3 py-2"
        />
        <input
          name="fullNameAr"
          placeholder="الاسم الكامل (ar) — optionnel"
          className="rounded border px-3 py-2"
          dir="rtl"
        />
        <input
          name="cin"
          placeholder="CIN (ex: AB123456)"
          required
          className="rounded border px-3 py-2 font-mono"
        />
        <input
          name="phone"
          placeholder="+212 6XXXXXXXX"
          required
          className="rounded border px-3 py-2"
        />
        <input
          name="email"
          type="email"
          placeholder="Email (optionnel)"
          className="rounded border px-3 py-2"
        />
        <select name="role" className="rounded border px-3 py-2">
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-green-700 px-4 py-2 text-white hover:bg-green-800 disabled:opacity-50"
        >
          {isPending ? 'Enregistrement…' : 'Ajouter le membre'}
        </button>
      </form>
    </div>
  );
}
```

**Verification:** `pnpm --filter @terroir/portal typecheck`

---

### Task 6 — Members Server Actions

**File to create:** `apps/portal/src/app/[locale]/(cooperative-admin)/cooperative-admin/members/actions.ts`

```ts
'use server';
import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api-server';
import { getCooperativeId } from '@/lib/auth-utils';

type AddMemberInput = {
  fullName: string;
  fullNameAr?: string;
  cin: string;
  phone: string;
  email?: string;
  role: string;
};

export async function addMember(input: AddMemberInput): Promise<void> {
  const cooperativeId = await getCooperativeId();
  if (!cooperativeId) throw new Error('No cooperative in session');
  await apiFetch(`/api/v1/cooperatives/${cooperativeId}/members`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  revalidatePath('/[locale]/(cooperative-admin)/cooperative-admin/members', 'page');
}
```

**Verification:** `pnpm --filter @terroir/portal typecheck && pnpm --filter @terroir/portal lint`

---

## Batch 3 — Farms (Tasks 7–9)

### Task 7 — Farms list page

**File to create:** `apps/portal/src/app/[locale]/(cooperative-admin)/cooperative-admin/farms/page.tsx`

RSC. Calls `GET /api/v1/cooperatives/:cooperativeId/farms?page=N&limit=20`.
Displays: name, region, commune, area (ha), crop types, GPS coordinates badge, date added.

```tsx
import { apiFetch } from '@/lib/api-server';
import { getCooperativeId } from '@/lib/auth-utils';
import { PageHeader } from '@/components/admin/page-header';
import { DataTable } from '@/components/admin/data-table';
import Link from 'next/link';

type Farm = {
  id: string;
  name: string;
  regionCode: string;
  commune: string | null;
  areaHectares: number;
  cropTypes: string[];
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
};
type PagedFarms = { data: Farm[]; total: number; page: number; limit: number };

export default async function FarmsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const cooperativeId = await getCooperativeId();
  if (!cooperativeId) return <p>Coopérative introuvable.</p>;

  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));
  const result = await apiFetch<PagedFarms>(
    `/api/v1/cooperatives/${cooperativeId}/farms?page=${page}&limit=20`,
  );

  return (
    <div>
      <PageHeader
        title="Fermes"
        subtitle={`${result.total} fermes enregistrées`}
        action={
          <Link
            href="farms/new"
            className="rounded bg-green-700 px-4 py-2 text-sm text-white hover:bg-green-800"
          >
            + Ajouter
          </Link>
        }
      />
      <DataTable
        head={['Nom', 'Région', 'Commune', 'Surface (ha)', 'Cultures', 'GPS', 'Ajoutée le']}
        isEmpty={result.data.length === 0}
        empty="Aucune ferme enregistrée."
      >
        {result.data.map((f) => (
          <tr key={f.id} className="hover:bg-gray-50">
            <td className="px-4 py-3 font-medium">{f.name}</td>
            <td className="px-4 py-3">{f.regionCode}</td>
            <td className="px-4 py-3 text-gray-500">{f.commune ?? '—'}</td>
            <td className="px-4 py-3">{Number(f.areaHectares).toFixed(2)} ha</td>
            <td className="px-4 py-3 text-xs">{f.cropTypes.join(', ') || '—'}</td>
            <td className="px-4 py-3 font-mono text-xs">
              {f.latitude != null && f.longitude != null
                ? `${f.latitude.toFixed(4)}, ${f.longitude.toFixed(4)}`
                : '—'}
            </td>
            <td className="px-4 py-3 text-gray-500">
              {new Date(f.createdAt).toLocaleDateString('fr-MA')}
            </td>
          </tr>
        ))}
      </DataTable>
      <div className="mt-4 flex justify-between text-sm text-gray-500">
        <span>{result.total} résultats</span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link href={`?page=${page - 1}`} className="rounded border px-3 py-1 hover:bg-gray-50">
              Précédent
            </Link>
          )}
          {page * 20 < result.total && (
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

**Verification:** `pnpm --filter @terroir/portal typecheck`

---

### Task 8 — Map farm form page

**File to create:** `apps/portal/src/app/[locale]/(cooperative-admin)/cooperative-admin/farms/new/page.tsx`

Client form. Fields: name, regionCode (select from Morocco regions), commune (optional), areaHectares, cropTypes (comma-separated), latitude (optional), longitude (optional).

```tsx
'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { mapFarm } from '../actions';

const REGIONS = [
  'TAN',
  'ORI',
  'FEZ',
  'RAB',
  'CAS',
  'MAR',
  'DRA',
  'SOU',
  'GUE',
  'LAA',
  'DAK',
  'BER',
];

export default function MapFarmPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const lat = fd.get('latitude') as string;
    const lng = fd.get('longitude') as string;
    const crops = (fd.get('cropTypes') as string)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    startTransition(async () => {
      await mapFarm({
        name: fd.get('name') as string,
        regionCode: fd.get('regionCode') as string,
        commune: (fd.get('commune') as string) || undefined,
        areaHectares: parseFloat(fd.get('areaHectares') as string),
        cropTypes: crops,
        latitude: lat ? parseFloat(lat) : undefined,
        longitude: lng ? parseFloat(lng) : undefined,
      });
      router.push('/fr/cooperative-admin/farms');
    });
  }

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-2xl font-bold">Enregistrer une ferme</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          name="name"
          placeholder="Nom de la ferme"
          required
          className="rounded border px-3 py-2"
        />
        <select name="regionCode" required className="rounded border px-3 py-2">
          <option value="">— Sélectionner une région —</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <input
          name="commune"
          placeholder="Commune (optionnel)"
          className="rounded border px-3 py-2"
        />
        <input
          name="areaHectares"
          type="number"
          step="0.01"
          min="0"
          placeholder="Surface (hectares)"
          required
          className="rounded border px-3 py-2"
        />
        <input
          name="cropTypes"
          placeholder="Cultures (séparées par virgule, ex: olive, argan)"
          className="rounded border px-3 py-2"
        />
        <div className="flex gap-2">
          <input
            name="latitude"
            type="number"
            step="0.000001"
            placeholder="Latitude (optionnel)"
            className="flex-1 rounded border px-3 py-2"
          />
          <input
            name="longitude"
            type="number"
            step="0.000001"
            placeholder="Longitude (optionnel)"
            className="flex-1 rounded border px-3 py-2"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-green-700 px-4 py-2 text-white hover:bg-green-800 disabled:opacity-50"
        >
          {isPending ? 'Enregistrement…' : 'Enregistrer la ferme'}
        </button>
      </form>
    </div>
  );
}
```

**Verification:** `pnpm --filter @terroir/portal typecheck`

---

### Task 9 — Farms Server Actions

**File to create:** `apps/portal/src/app/[locale]/(cooperative-admin)/cooperative-admin/farms/actions.ts`

```ts
'use server';
import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api-server';
import { getCooperativeId } from '@/lib/auth-utils';

type MapFarmInput = {
  name: string;
  regionCode: string;
  commune?: string;
  areaHectares: number;
  cropTypes: string[];
  latitude?: number;
  longitude?: number;
};

export async function mapFarm(input: MapFarmInput): Promise<void> {
  const cooperativeId = await getCooperativeId();
  if (!cooperativeId) throw new Error('No cooperative in session');
  await apiFetch(`/api/v1/cooperatives/${cooperativeId}/farms`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  revalidatePath('/[locale]/(cooperative-admin)/cooperative-admin/farms', 'page');
}
```

**Verification:** `pnpm --filter @terroir/portal typecheck && pnpm --filter @terroir/portal lint`

---

## Batch 4 — Products + Batches list (Tasks 10–11)

### Task 10 — Products list page (read-only)

**File to create:** `apps/portal/src/app/[locale]/(cooperative-admin)/cooperative-admin/products/page.tsx`

RSC. Calls `GET /api/v1/products/cooperative/:cooperativeId`.
Displays: name, SDOQ type, region, status badge, registered date.

```tsx
import { apiFetch } from '@/lib/api-server';
import { getCooperativeId } from '@/lib/auth-utils';
import { PageHeader } from '@/components/admin/page-header';
import { DataTable } from '@/components/admin/data-table';
import { StatusBadge } from '@/components/admin/status-badge';

type Product = {
  id: string;
  name: string;
  sdoqType: string;
  regionCode: string;
  status: string;
  createdAt: string;
};

export default async function ProductsPage() {
  const cooperativeId = await getCooperativeId();
  if (!cooperativeId) return <p>Coopérative introuvable.</p>;

  const products = await apiFetch<Product[]>(`/api/v1/products/cooperative/${cooperativeId}`);

  return (
    <div>
      <PageHeader title="Produits" subtitle={`${products.length} produits enregistrés`} />
      <DataTable
        head={['Nom', 'Type SDOQ', 'Région', 'Statut', 'Enregistré le']}
        isEmpty={products.length === 0}
        empty="Aucun produit enregistré pour cette coopérative."
      >
        {products.map((p) => (
          <tr key={p.id} className="hover:bg-gray-50">
            <td className="px-4 py-3 font-medium">{p.name}</td>
            <td className="px-4 py-3">{p.sdoqType}</td>
            <td className="px-4 py-3">{p.regionCode}</td>
            <td className="px-4 py-3">
              <StatusBadge status={p.status} />
            </td>
            <td className="px-4 py-3 text-gray-500">
              {new Date(p.createdAt).toLocaleDateString('fr-MA')}
            </td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}
```

**Verification:** `pnpm --filter @terroir/portal typecheck`

---

### Task 11 — Batches list page

**File to create:** `apps/portal/src/app/[locale]/(cooperative-admin)/cooperative-admin/batches/page.tsx`

RSC. Calls `GET /api/v1/batches/cooperative/:cooperativeId`.
Displays: batch number (or ID), product name, campaign year, harvest date, status badge, link to detail.

```tsx
import { apiFetch } from '@/lib/api-server';
import { getCooperativeId } from '@/lib/auth-utils';
import { PageHeader } from '@/components/admin/page-header';
import { DataTable } from '@/components/admin/data-table';
import { StatusBadge } from '@/components/admin/status-badge';
import Link from 'next/link';

type Batch = {
  id: string;
  batchNumber?: string;
  productId: string;
  campaignYear: string;
  harvestDate: string;
  status: string;
  totalWeightKg: number;
  createdAt: string;
};

export default async function BatchesPage() {
  const cooperativeId = await getCooperativeId();
  if (!cooperativeId) return <p>Coopérative introuvable.</p>;

  const batches = await apiFetch<Batch[]>(`/api/v1/batches/cooperative/${cooperativeId}`);

  return (
    <div>
      <PageHeader title="Lots de production" subtitle={`${batches.length} lots`} />
      <DataTable
        head={['Référence', 'Campagne', 'Date récolte', 'Poids (kg)', 'Statut', 'Actions']}
        isEmpty={batches.length === 0}
        empty="Aucun lot de production enregistré."
      >
        {batches.map((b) => (
          <tr key={b.id} className="hover:bg-gray-50">
            <td className="px-4 py-3 font-mono text-xs">{b.batchNumber ?? b.id.slice(0, 8)}</td>
            <td className="px-4 py-3">{b.campaignYear}</td>
            <td className="px-4 py-3">
              {b.harvestDate ? new Date(b.harvestDate).toLocaleDateString('fr-MA') : '—'}
            </td>
            <td className="px-4 py-3">{b.totalWeightKg} kg</td>
            <td className="px-4 py-3">
              <StatusBadge status={b.status} />
            </td>
            <td className="px-4 py-3">
              <Link href={`batches/${b.id}`} className="text-sm text-green-700 hover:underline">
                Voir détail
              </Link>
            </td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}
```

**Verification:** `pnpm --filter @terroir/portal typecheck && pnpm --filter @terroir/portal lint`

---

## Batch 5 — Batch detail + Home dashboard + i18n (Tasks 12–13)

### Task 12 — Batch detail page

**File to create:** `apps/portal/src/app/[locale]/(cooperative-admin)/cooperative-admin/batches/[id]/page.tsx`

RSC. Calls `GET /api/v1/batches/:id` and `GET /api/v1/batches/:id/processing-steps` in parallel via `Promise.all`.
Displays: batch metadata + ordered processing steps chain.

```tsx
import { apiFetch } from '@/lib/api-server';
import { PageHeader } from '@/components/admin/page-header';
import { StatusBadge } from '@/components/admin/status-badge';

type Batch = {
  id: string;
  batchNumber?: string;
  campaignYear: string;
  harvestDate: string;
  totalWeightKg: number;
  status: string;
  createdAt: string;
};
type ProcessingStep = {
  id: string;
  stepName: string;
  performedAt: string;
  notes: string | null;
  performedBy: string;
};

export default async function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [batch, steps] = await Promise.all([
    apiFetch<Batch>(`/api/v1/batches/${id}`),
    apiFetch<ProcessingStep[]>(`/api/v1/batches/${id}/processing-steps`),
  ]);

  return (
    <div>
      <PageHeader
        title={`Lot ${batch.batchNumber ?? id.slice(0, 8)}`}
        subtitle={`Campagne ${batch.campaignYear}`}
      />

      <div className="mb-8 grid grid-cols-2 gap-4 rounded-lg border bg-white p-6 shadow-sm md:grid-cols-4">
        <Stat label="Statut" value={<StatusBadge status={batch.status} />} />
        <Stat label="Poids total" value={`${batch.totalWeightKg} kg`} />
        <Stat
          label="Date récolte"
          value={batch.harvestDate ? new Date(batch.harvestDate).toLocaleDateString('fr-MA') : '—'}
        />
        <Stat label="Créé le" value={new Date(batch.createdAt).toLocaleDateString('fr-MA')} />
      </div>

      <h2 className="mb-4 text-lg font-semibold">Étapes de traitement ({steps.length})</h2>
      {steps.length === 0 ? (
        <p className="text-gray-500">Aucune étape de traitement enregistrée.</p>
      ) : (
        <ol className="relative border-l border-green-200 pl-6">
          {steps.map((s, i) => (
            <li key={s.id} className="mb-6">
              <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-green-700 text-xs font-bold text-white">
                {i + 1}
              </span>
              <p className="font-medium">{s.stepName}</p>
              <p className="text-xs text-gray-500">
                {new Date(s.performedAt).toLocaleDateString('fr-MA')}
              </p>
              {s.notes && <p className="mt-1 text-sm text-gray-600">{s.notes}</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <div className="mt-1 text-sm font-semibold text-gray-800">{value}</div>
    </div>
  );
}
```

**Verification:** `pnpm --filter @terroir/portal typecheck`

---

### Task 13 — Home dashboard + i18n keys

**File to modify:** `apps/portal/src/app/[locale]/(cooperative-admin)/cooperative-admin/page.tsx`

Replace placeholder with a dashboard that shows 4 summary stats (members, farms, products, batches) fetched in `Promise.all` with graceful fallback:

```tsx
import { apiFetch } from '@/lib/api-server';
import { getCooperativeId } from '@/lib/auth-utils';

async function safeCount(url: string): Promise<number> {
  try {
    const r = await apiFetch<{ total?: number; length?: number } | unknown[]>(url);
    if (Array.isArray(r)) return r.length;
    if (typeof r === 'object' && r !== null) {
      const obj = r as Record<string, unknown>;
      if ('total' in obj) return Number(obj.total);
      if ('meta' in obj && typeof obj.meta === 'object' && obj.meta !== null) {
        return Number((obj.meta as Record<string, unknown>).total ?? 0);
      }
    }
    return 0;
  } catch {
    return 0;
  }
}

export default async function CooperativeAdminHome() {
  const cooperativeId = await getCooperativeId();

  const [membersCount, farmsCount, productsCount, batchesCount] = cooperativeId
    ? await Promise.all([
        safeCount(`/api/v1/cooperatives/${cooperativeId}/members?limit=1`),
        safeCount(`/api/v1/cooperatives/${cooperativeId}/farms?limit=1`),
        apiFetch<unknown[]>(`/api/v1/products/cooperative/${cooperativeId}`)
          .then((d) => (Array.isArray(d) ? d.length : 0))
          .catch(() => 0),
        apiFetch<unknown[]>(`/api/v1/batches/cooperative/${cooperativeId}`)
          .then((d) => (Array.isArray(d) ? d.length : 0))
          .catch(() => 0),
      ])
    : [0, 0, 0, 0];

  const cards = [
    { label: 'Membres', count: membersCount, href: 'cooperative-admin/members' },
    { label: 'Fermes', count: farmsCount, href: 'cooperative-admin/farms' },
    { label: 'Produits', count: productsCount, href: 'cooperative-admin/products' },
    { label: 'Lots', count: batchesCount, href: 'cooperative-admin/batches' },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Tableau de bord — Coopérative</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map((c) => (
          <a
            key={c.label}
            href={`/fr/${c.href}`}
            className="rounded-lg border bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            <p className="text-3xl font-bold text-green-700">{c.count}</p>
            <p className="mt-1 text-sm text-gray-500">{c.label}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
```

**i18n keys** — add `cooperativeAdmin` section to all three locale files:

- `apps/portal/messages/fr.json`
- `apps/portal/messages/ar.json`
- `apps/portal/messages/zgh.json`

```json
"cooperativeAdmin": {
  "dashboard": "Tableau de bord",
  "members": "Membres",
  "farms": "Fermes",
  "products": "Produits",
  "batches": "Lots de production",
  "addMember": "Ajouter un membre",
  "mapFarm": "Enregistrer une ferme",
  "noMembers": "Aucun membre enregistré.",
  "noFarms": "Aucune ferme enregistrée.",
  "noProducts": "Aucun produit enregistré pour cette coopérative.",
  "noBatches": "Aucun lot de production enregistré."
}
```

**Verification (final batch):**

```bash
# terroir-ma-web
pnpm --filter @terroir/portal typecheck   # 0 errors
pnpm --filter @terroir/portal lint        # 0 warnings
pnpm --filter @terroir/portal build       # next build green — verify route count increased
```

---

## Summary

| Batch | Tasks | Scope                                                                         |
| ----- | ----- | ----------------------------------------------------------------------------- |
| 1     | 1–3   | Auth patch (cooperativeId in session) · backend farms list · layout + sidebar |
| 2     | 4–6   | Members list · add member form · addMember SA                                 |
| 3     | 7–9   | Farms list · map farm form · mapFarm SA                                       |
| 4     | 10–11 | Products list · batches list                                                  |
| 5     | 12–13 | Batch detail (processing chain) · home dashboard · i18n keys                  |

**New routes after FE-S4 (11 new → 33 portal total):**

| Route                                      | Type                            |
| ------------------------------------------ | ------------------------------- |
| `/[locale]/cooperative-admin`              | RSC — dashboard stats           |
| `/[locale]/cooperative-admin/members`      | RSC — paginated list            |
| `/[locale]/cooperative-admin/members/new`  | Client — add form               |
| `/[locale]/cooperative-admin/farms`        | RSC — paginated list            |
| `/[locale]/cooperative-admin/farms/new`    | Client — map form               |
| `/[locale]/cooperative-admin/products`     | RSC — read-only list            |
| `/[locale]/cooperative-admin/batches`      | RSC — list with status          |
| `/[locale]/cooperative-admin/batches/[id]` | RSC — detail + processing chain |

**Backend additions:** `getFarms()` service method + `GET /cooperatives/:id/farms` endpoint (no migration needed — no new DB columns).
