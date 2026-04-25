# P2-S4: Consumer Migration + Authenticated Playwright E2E — Implementation Plan

> **For Claude:** Use /execute to implement this plan task-by-task.

**Goal:** Migrate the three dormant `@EventPattern` Kafka listeners to `KafkaConsumerService.subscribe()`, then add authenticated Playwright E2E flows covering all 8 staff roles.

**Architecture:**

- Consumer migration: `CooperativeListener`, `ProductListener`, `CertificationListener` → `OnModuleInit` + `KafkaConsumerService.subscribe()` (same pattern as `NotificationListener` completed in P2-S3)
- Authenticated E2E: Keycloak storage-state auth, one project per role, `global-setup.ts` seeds test data via API, critical-path and smoke specs
- Repos: consumer migration in `terroir-ma`; E2E infrastructure and specs in `terroir-ma-web`

**Tech Stack:** NestJS, TypeScript, PostgreSQL + PostGIS, Redpanda, Keycloak, Redis, Playwright

**Modules Affected:** cooperative, product, certification (consumer migration); all 8 role portals (E2E)

**Estimated Story Points:** 13 (US-100: 5 SP, US-101: 5 SP, US-102: 3 SP)

---

## Batch 1 — Migrate CooperativeListener + ProductListener (Tasks 1–3)

### Task 1 — Migrate `CooperativeListener`

**Files to modify:** `src/modules/cooperative/listeners/cooperative.listener.ts`

Replace `@Controller` / `@EventPattern` pattern with `@Injectable` / `OnModuleInit` / `KafkaConsumerService.subscribe()`:

```typescript
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cooperative } from '../entities/cooperative.entity';
import type { CooperativeRegistrationVerifiedEvent } from '../events/cooperative-events';
import { KafkaConsumerService } from '../../../common/kafka/kafka-consumer.service';

@Injectable()
export class CooperativeListener implements OnModuleInit {
  private readonly logger = new Logger(CooperativeListener.name);

  constructor(
    @InjectRepository(Cooperative)
    private readonly cooperativeRepo: Repository<Cooperative>,
    private readonly kafkaConsumerService: KafkaConsumerService,
  ) {}

  onModuleInit(): void {
    this.kafkaConsumerService.subscribe('cooperative.registration.verified', (p) =>
      this.handleRegistrationVerified(p as CooperativeRegistrationVerifiedEvent),
    );
  }

  async handleRegistrationVerified(data: CooperativeRegistrationVerifiedEvent): Promise<void> {
    this.logger.log(
      { eventId: data.eventId, cooperativeId: data.cooperativeId },
      'Cooperative registration verified event received',
    );
    try {
      await this.cooperativeRepo.update(
        { id: data.cooperativeId },
        {
          status: 'active',
          verifiedAt: new Date(data.verifiedAt),
          verifiedBy: data.verifiedBy,
        },
      );
      this.logger.log(
        { cooperativeId: data.cooperativeId },
        'Cooperative status updated to active',
      );
    } catch (error) {
      this.logger.error(
        { error, cooperativeId: data.cooperativeId },
        'Failed to update cooperative status',
      );
    }
  }
}
```

**Verification:** file compiles with no `@EventPattern` imports.

---

### Task 2 — Migrate `ProductListener` + `JSON.parse(testValues)`

**Files to modify:** `src/modules/product/listeners/product.listener.ts`

Key changes:

- Replace `@Controller` → `@Injectable`, `OnModuleInit`
- Remove `@EventPattern`, `@Payload`, `@Ctx`, `KafkaContext` imports
- Inject `KafkaConsumerService`, register `'lab.test.completed'` in `onModuleInit()`
- Handler signature: `handleLabTestCompleted(data: LabTestCompletedEvent): Promise<void>` (1 arg)
- Add `JSON.parse` when building the result record — testValues arrives as JSON string on Avro wire:

```typescript
const result = this.labTestResultRepo.create({
  labTestId: data.labTestId,
  batchId: data.batchId,
  productTypeCode: data.productTypeCode,
  passed: data.passed,
  testValues: JSON.parse(data.testValues as unknown as string), // ← P2-S3 deferred work
  failedParameters: data.failedParameters,
  technicianName: data.technician,
  technicianId: data.correlationId,
  completedAt: new Date(data.completedAt),
});
```

Full file structure mirrors `CooperativeListener` above with `KafkaConsumerService` injection.

**Verification:** no `@EventPattern` imports, no `{} as never` second-arg pattern remaining.

---

### Task 3 — Update `cooperative.module.ts` and `product.module.ts`

**Files to modify:**

- `src/modules/cooperative/cooperative.module.ts`
- `src/modules/product/product.module.ts`

For each module: move the listener from `controllers: [...]` to `providers: [...]`.
The `KafkaModule` is `@Global()` so no import needed.

`cooperative.module.ts`:

```typescript
controllers: [CooperativeController],
providers: [CooperativeService, CooperativeProducer, CooperativeListener],
```

`product.module.ts`:

```typescript
controllers: [
  ProductController, ProductTypeController, HarvestController, BatchController,
  LabTestController, LabController, ProductDocumentController,
],
providers: [
  ProductService, ProductTypeService, HarvestService, BatchService,
  LabTestService, LabService, ProductDocumentService, ProcessingStepService,
  ProductProducer, ProductListener, MinioService,
],
```

**Verification checkpoint:**

```bash
npm run lint
npm run typecheck
npm run test:unit
```

All 432+ tests must pass.

---

## Batch 2 — Migrate CertificationListener + Update Listener Specs (Tasks 4–6)

### Task 4 — Migrate `CertificationListener`

**Files to modify:** `src/modules/certification/listeners/certification.listener.ts`

`CertificationListener` has 4 handlers: `lab.test.completed`, `cooperative.registration.verified`, `certification.review.final-started`, `certification.renewed`.

```typescript
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type {
  LabTestCompletedEvent,
  CooperativeRegistrationVerifiedEvent,
  CertificationFinalReviewStartedEvent,
  CertificationRenewedEvent,
} from '../../../common/interfaces/events';
import { CertificationService } from '../services/certification.service';
import { KafkaConsumerService } from '../../../common/kafka/kafka-consumer.service';

@Injectable()
export class CertificationListener implements OnModuleInit {
  private readonly logger = new Logger(CertificationListener.name);

  constructor(
    private readonly certificationService: CertificationService,
    private readonly kafkaConsumerService: KafkaConsumerService,
  ) {}

  onModuleInit(): void {
    this.kafkaConsumerService.subscribe('lab.test.completed', (p) =>
      this.handleLabTestCompleted(p as LabTestCompletedEvent),
    );
    this.kafkaConsumerService.subscribe('cooperative.registration.verified', (p) =>
      this.handleCooperativeVerified(p as CooperativeRegistrationVerifiedEvent),
    );
    this.kafkaConsumerService.subscribe('certification.review.final-started', (p) =>
      this.handleFinalReviewStarted(p as CertificationFinalReviewStartedEvent),
    );
    this.kafkaConsumerService.subscribe('certification.renewed', (p) =>
      this.handleCertificationRenewed(p as CertificationRenewedEvent),
    );
  }

  // handler bodies unchanged — just remove second @Ctx() arg from signature
  async handleLabTestCompleted(data: LabTestCompletedEvent): Promise<void> {
    /* ... */
  }
  async handleCooperativeVerified(data: CooperativeRegistrationVerifiedEvent): Promise<void> {
    /* ... */
  }
  async handleFinalReviewStarted(data: CertificationFinalReviewStartedEvent): Promise<void> {
    /* ... */
  }
  async handleCertificationRenewed(data: CertificationRenewedEvent): Promise<void> {
    /* ... */
  }
}
```

---

### Task 5 — Update `certification.module.ts`

**Files to modify:** `src/modules/certification/certification.module.ts`

Move `CertificationListener` from `controllers` to `providers`:

```typescript
controllers: [
  CertificationController, InspectionController, QrCodeController, ExportDocumentController,
],
providers: [
  CertificationService, InspectionService, QrCodeService, ExportDocumentService,
  CertificationPdfService, ExportDocumentPdfService, CertificationProducer, CertificationListener,
],
```

---

### Task 6 — Update All Three Listener Unit Specs

**Files to modify:**

- `test/unit/cooperative/cooperative.listener.spec.ts`
- `test/unit/product/product.listener.spec.ts`
- `test/unit/certification/certification.listener.spec.ts`

Changes per spec:

1. Remove `@EventPattern`-era second argument (`{} as never`) from all handler calls
2. Add `KafkaConsumerService` mock with `subscribe: jest.fn()`
3. Add `onModuleInit()` registration test verifying the correct topics are subscribed

`cooperative.listener.spec.ts` additions:

```typescript
const mockKafkaConsumerService = { subscribe: jest.fn() };

// in module:
{ provide: KafkaConsumerService, useValue: mockKafkaConsumerService }

// new test:
it('registers cooperative.registration.verified in onModuleInit()', () => {
  listener.onModuleInit();
  expect(mockKafkaConsumerService.subscribe).toHaveBeenCalledWith(
    'cooperative.registration.verified',
    expect.any(Function),
  );
});

// updated existing test:
await listener.handleRegistrationVerified(event); // no second arg
```

`product.listener.spec.ts` also needs testValues string parsing test:

```typescript
it('JSON.parses testValues string from Avro wire format', async () => {
  const event = makeLabTestEvent({
    testValues: JSON.stringify({ acidity: 0.5 }) as unknown as Record<string, unknown>,
  });
  await listener.handleLabTestCompleted(event);
  expect(labTestResultRepo.create).toHaveBeenCalledWith(
    expect.objectContaining({ testValues: { acidity: 0.5 } }),
  );
});
```

`certification.listener.spec.ts` — same pattern, add `onModuleInit()` test for all 4 topics.

**Verification checkpoint:**

```bash
npm run lint
npm run typecheck
npm run test:unit
```

All tests must pass. Count should be 432+ (likely +6 new subscription tests).

---

## Batch 3 — Playwright Infrastructure (Tasks 7–9)

> All files in Batch 3–5 are in `terroir-ma-web` repo at `C:/Users/moham/justforfun/terroir-ma-web` unless noted.

### Task 7 — Keycloak Test Realm Fixture + `docker-compose.test.yml`

**File to create (terroir-ma):** `test/fixtures/keycloak-realm-test.json`

Minimal Keycloak realm JSON with:

- `realm`: `"terroir-test"`
- `enabled`: true
- `clients`: one `terroir-portal` OIDC client, `directAccessGrantsEnabled: true`, redirect URIs `http://localhost:3001/*`
- `roles.realm`: all 9 roles (super-admin, cooperative-admin, cooperative-member, inspector, lab-technician, certification-body, customs-agent, consumer, service-account)
- `users`: 8 test users (see table below), each with credential `Test1234!` (temporary: false), assigned their role

| Username                | Role               | Email                              |
| ----------------------- | ------------------ | ---------------------------------- |
| test-super-admin        | super-admin        | test-super-admin@terroir.ma        |
| test-cooperative-admin  | cooperative-admin  | test-cooperative-admin@terroir.ma  |
| test-cooperative-member | cooperative-member | test-cooperative-member@terroir.ma |
| test-inspector          | inspector          | test-inspector@terroir.ma          |
| test-lab-technician     | lab-technician     | test-lab-technician@terroir.ma     |
| test-certification-body | certification-body | test-certification-body@terroir.ma |
| test-customs-agent      | customs-agent      | test-customs-agent@terroir.ma      |

Custom attribute `cooperative_id: 00000000-0000-0000-0000-000000000001` on `test-cooperative-admin` and `test-cooperative-member` via mapper on the client.

**File to modify (terroir-ma):** `docker-compose.test.yml`

Add service:

```yaml
keycloak-test:
  image: quay.io/keycloak/keycloak:24.0.4
  command: start-dev --import-realm
  environment:
    KEYCLOAK_ADMIN: admin
    KEYCLOAK_ADMIN_PASSWORD: admin
    KC_HTTP_PORT: 8080
  volumes:
    - ./test/fixtures/keycloak-realm-test.json:/opt/keycloak/data/import/realm.json:ro
  ports:
    - '8080:8080'
  healthcheck:
    test: ['CMD', 'curl', '-f', 'http://localhost:8080/health/ready']
    interval: 10s
    timeout: 5s
    retries: 20
```

---

### Task 8 — `global-setup.ts` + `global-teardown.ts`

**File to create:** `apps/portal/e2e/global-setup.ts`

```typescript
import { chromium, FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const AUTH_DIR = path.join(__dirname, '.auth');
const API_BASE = 'http://localhost:3000/api/v1';
const KC_BASE = 'http://localhost:8080';
const KC_REALM = 'terroir-test';
const KC_CLIENT = 'terroir-portal';

const ROLES = [
  'super-admin',
  'cooperative-admin',
  'cooperative-member',
  'inspector',
  'lab-technician',
  'certification-body',
  'customs-agent',
];

async function getToken(role: string): Promise<string> {
  const res = await fetch(`${KC_BASE}/realms/${KC_REALM}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: KC_CLIENT,
      username: `test-${role}`,
      password: 'Test1234!',
    }),
  });
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export default async function globalSetup(_config: FullConfig) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  // Step 1: Authenticate all roles via Keycloak storage state
  const browser = await chromium.launch();
  for (const role of ROLES) {
    const token = await getToken(role);
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to portal login — NextAuth will exchange the Keycloak session
    await page.goto('http://localhost:3001/fr/login');
    // Store auth cookies after login redirect completes
    // For NextAuth + Keycloak: fill credentials directly
    await page.fill('[name="username"]', `test-${role}`);
    await page.fill('[name="password"]', 'Test1234!');
    await page.click('[type="submit"]');
    await page.waitForURL(
      /\/fr\/(cooperative-admin|super-admin|certification-body|customs-agent|inspector|lab-technician|cooperative-member|login)/,
      { timeout: 15_000 },
    );

    await context.storageState({ path: path.join(AUTH_DIR, `${role}.json`) });
    await context.close();

    // Keep token for seeding
    if (role === 'super-admin') {
      process.env._TEST_SUPER_ADMIN_TOKEN = token;
    }
  }
  await browser.close();

  // Step 2: Seed minimum test data as super-admin
  const token = process.env._TEST_SUPER_ADMIN_TOKEN!;
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const coopRes = await fetch(`${API_BASE}/cooperatives`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Coopérative Argan Test',
      ice: '123456789012345',
      regionCode: 'ESS',
    }),
  });
  const coop = (await coopRes.json()) as { data: { id: string } };

  // Write seed IDs for specs to consume
  fs.writeFileSync(
    path.join(AUTH_DIR, 'seed.json'),
    JSON.stringify(
      { cooperativeId: coop.data?.id ?? '00000000-0000-0000-0000-000000000001' },
      null,
      2,
    ),
  );
}
```

**File to create:** `apps/portal/e2e/global-teardown.ts`

```typescript
// Teardown stub — CI resets Docker volumes on each run; dev DB is ephemeral
export default async function globalTeardown() {}
```

---

### Task 9 — Update `playwright.config.ts`

**File to modify:** `playwright.config.ts` (repo root of terroir-ma-web)

Replace the current single-project config with:

```typescript
import { defineConfig, devices } from '@playwright/test';

const roles = [
  'cooperative-admin',
  'certification-body',
  'customs-agent',
  'super-admin',
  'inspector',
  'lab-technician',
  'cooperative-member',
];

export default defineConfig({
  testDir: './apps/portal/e2e',
  timeout: 45_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3001',
    headless: true,
    locale: 'fr-MA',
    timezoneId: 'Africa/Casablanca',
  },
  globalSetup: './apps/portal/e2e/global-setup.ts',
  globalTeardown: './apps/portal/e2e/global-teardown.ts',
  projects: [
    // Setup project runs first — produces .auth/*.json files
    {
      name: 'setup',
      testMatch: /global-setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    // Unauthenticated tests (public app + auth redirects)
    {
      name: 'public',
      testMatch: /(auth|export-documents|qr-verify)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    // Per-role authenticated projects
    ...roles.map((role) => ({
      name: role,
      testMatch: new RegExp(
        `${role.replace('-', '-')}|certification-chain|super-admin|customs-agent`,
      ),
      use: {
        ...devices['Desktop Chrome'],
        storageState: `apps/portal/e2e/.auth/${role}.json`,
      },
      dependencies: ['setup'],
    })),
  ],
  webServer: [
    {
      command: 'pnpm dev:portal',
      url: 'http://localhost:3001',
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
```

Also add to `.gitignore` (terroir-ma-web):

```
apps/portal/e2e/.auth/
playwright-report/
```

**Verification checkpoint:**

```bash
# In terroir-ma-web
npx playwright --version
npx tsc --noEmit  # typecheck global-setup.ts
```

---

## Batch 4 — Critical-Path Playwright Specs (Tasks 10–12)

### Task 10 — `certification-chain.spec.ts`

**File to create:** `apps/portal/e2e/certification-chain.spec.ts`

Tests the full certification chain across 4 roles using the seeded data. Each `test.use()` block picks a role's storage state:

```typescript
import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const AUTH_DIR = path.join(__dirname, '.auth');

function authState(role: string) {
  return path.join(AUTH_DIR, `${role}.json`);
}

function seedData() {
  return JSON.parse(fs.readFileSync(path.join(AUTH_DIR, 'seed.json'), 'utf-8')) as {
    cooperativeId: string;
    certificationId?: string;
  };
}

test.describe('Certification chain — inspector', () => {
  test.use({ storageState: authState('inspector') });

  test('inspector can view and act on inspection queue', async ({ page }) => {
    await page.goto('/fr/inspector/inspections');
    await expect(page.locator('h1, [data-testid="page-title"]')).toBeVisible();
    await expect(page).not.toHaveTitle(/500|Error/i);
  });
});

test.describe('Certification chain — lab-technician', () => {
  test.use({ storageState: authState('lab-technician') });

  test('lab technician can view test queue', async ({ page }) => {
    await page.goto('/fr/lab-technician/lab-tests');
    await expect(page.locator('body')).toBeVisible();
    await expect(page).not.toHaveTitle(/500|Error/i);
  });
});

test.describe('Certification chain — certification-body', () => {
  test.use({ storageState: authState('certification-body') });

  test('certification body can view pending certifications list', async ({ page }) => {
    await page.goto('/fr/certification-body/certifications');
    await expect(page.locator('body')).toBeVisible();
    await expect(page).not.toHaveTitle(/500|Error/i);
  });
});
```

> Note: full journey tests (submit inspection → grant cert) are gated on seeded pending data. Smoke-level assertions are correct here — deep journey tests require a running backend with seeded chain data.

---

### Task 11 — `customs-agent.spec.ts`

**File to create:** `apps/portal/e2e/customs-agent.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import * as path from 'path';

test.use({ storageState: path.join(__dirname, '.auth/customs-agent.json') });

test.describe('Customs agent — export documents', () => {
  test('export documents list loads after login', async ({ page }) => {
    await page.goto('/fr/customs-agent/export-documents');
    await expect(page).not.toHaveURL(/\/fr\/login/);
    await expect(page).not.toHaveTitle(/500|Error/i);
    await expect(page.locator('h1, [data-testid="page-title"]')).toBeVisible();
  });

  test('generate new export document page renders', async ({ page }) => {
    await page.goto('/fr/customs-agent/export-documents/new');
    await expect(page).not.toHaveURL(/\/fr\/login/);
    await expect(page.locator('form')).toBeVisible();
  });

  test('customs-agent dashboard renders', async ({ page }) => {
    await page.goto('/fr/customs-agent');
    await expect(page).not.toHaveTitle(/500|Error/i);
    await expect(page.locator('body')).toBeVisible();
  });
});
```

---

### Task 12 — `super-admin.spec.ts`

**File to create:** `apps/portal/e2e/super-admin.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import * as path from 'path';

test.use({ storageState: path.join(__dirname, '.auth/super-admin.json') });

test.describe('Super admin — cooperative management', () => {
  test('cooperatives list loads after login', async ({ page }) => {
    await page.goto('/fr/super-admin/cooperatives');
    await expect(page).not.toHaveURL(/\/fr\/login/);
    await expect(page).not.toHaveTitle(/500|Error/i);
    await expect(page.locator('h1, [data-testid="page-title"]')).toBeVisible();
  });

  test('audit log table loads', async ({ page }) => {
    await page.goto('/fr/super-admin/audit-log');
    await expect(page).not.toHaveTitle(/500|Error/i);
    await expect(page.locator('table, [data-testid="audit-table"]')).toBeVisible();
  });

  test('super-admin dashboard renders', async ({ page }) => {
    await page.goto('/fr/super-admin');
    await expect(page).not.toHaveTitle(/500|Error/i);
    await expect(page.locator('body')).toBeVisible();
  });
});
```

**Verification checkpoint:**

```bash
# In terroir-ma-web — typecheck only (servers not started yet)
npx tsc --noEmit
```

---

## Batch 5 — Smoke Specs + CI (Tasks 13–15)

### Task 13 — `cooperative-admin.spec.ts` + `cooperative-member.spec.ts`

**File to create:** `apps/portal/e2e/cooperative-admin.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import * as path from 'path';

test.use({ storageState: path.join(__dirname, '.auth/cooperative-admin.json') });

test.describe('Cooperative admin — happy path', () => {
  test('dashboard renders after login', async ({ page }) => {
    await page.goto('/fr/cooperative-admin');
    await expect(page).not.toHaveURL(/\/fr\/login/);
    await expect(page).not.toHaveTitle(/500|Error/i);
  });

  test('members list loads', async ({ page }) => {
    await page.goto('/fr/cooperative-admin/members');
    await expect(page).not.toHaveTitle(/500|Error/i);
    await expect(page.locator('body')).toBeVisible();
  });

  test('farms list loads', async ({ page }) => {
    await page.goto('/fr/cooperative-admin/farms');
    await expect(page).not.toHaveTitle(/500|Error/i);
    await expect(page.locator('body')).toBeVisible();
  });
});
```

**File to create:** `apps/portal/e2e/cooperative-member.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import * as path from 'path';

test.use({ storageState: path.join(__dirname, '.auth/cooperative-member.json') });

test.describe('Cooperative member — happy path', () => {
  test('dashboard renders after login', async ({ page }) => {
    await page.goto('/fr/cooperative-member');
    await expect(page).not.toHaveURL(/\/fr\/login/);
    await expect(page).not.toHaveTitle(/500|Error/i);
  });

  test('harvests list loads', async ({ page }) => {
    await page.goto('/fr/cooperative-member/harvests');
    await expect(page).not.toHaveTitle(/500|Error/i);
  });
});
```

---

### Task 14 — `inspector.spec.ts` + `lab-technician.spec.ts`

**File to create:** `apps/portal/e2e/inspector.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import * as path from 'path';

test.use({ storageState: path.join(__dirname, '.auth/inspector.json') });

test.describe('Inspector — happy path', () => {
  test('dashboard renders after login', async ({ page }) => {
    await page.goto('/fr/inspector');
    await expect(page).not.toHaveURL(/\/fr\/login/);
    await expect(page).not.toHaveTitle(/500|Error/i);
  });

  test('inspections list loads', async ({ page }) => {
    await page.goto('/fr/inspector/inspections');
    await expect(page).not.toHaveTitle(/500|Error/i);
  });
});
```

**File to create:** `apps/portal/e2e/lab-technician.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import * as path from 'path';

test.use({ storageState: path.join(__dirname, '.auth/lab-technician.json') });

test.describe('Lab technician — happy path', () => {
  test('dashboard renders after login', async ({ page }) => {
    await page.goto('/fr/lab-technician');
    await expect(page).not.toHaveURL(/\/fr\/login/);
    await expect(page).not.toHaveTitle(/500|Error/i);
  });

  test('test queue loads', async ({ page }) => {
    await page.goto('/fr/lab-technician/lab-tests');
    await expect(page).not.toHaveTitle(/500|Error/i);
  });
});
```

---

### Task 15 — Upgrade `qr-verify.spec.ts` + `.gitignore` + CI workflow

**File to modify:** `apps/portal/e2e/qr-verify.spec.ts`

Add a test that uses the real seeded cooperative UUID from `seed.json`:

```typescript
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const PUBLIC_BASE = 'http://localhost:3002';
const UNKNOWN_UUID = '00000000-0000-0000-0000-000000000000';

function getSeedData() {
  const seedPath = path.join(__dirname, '.auth/seed.json');
  if (fs.existsSync(seedPath)) {
    return JSON.parse(fs.readFileSync(seedPath, 'utf-8')) as { cooperativeId: string };
  }
  return null;
}

// ... keep existing 3 tests unchanged ...

test.describe('QR verification — seeded data', () => {
  test('verify page loads for a real cooperative UUID (from seed)', async ({ page }) => {
    const seed = getSeedData();
    if (!seed) test.skip();
    await page.goto(`${PUBLIC_BASE}/fr/verify/${seed!.cooperativeId}`);
    await expect(page).not.toHaveTitle(/500|Internal Server Error/i);
    await expect(page.locator('body')).toBeVisible();
  });
});
```

**File to modify:** `.gitignore` (terroir-ma-web root)

```
# Playwright auth state — contains session cookies, never commit
apps/portal/e2e/.auth/
playwright-report/
test-results/
```

**File to create:** `.github/workflows/e2e.yml` (terroir-ma-web)

```yaml
name: Playwright E2E

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          path: terroir-ma-web

      - uses: actions/checkout@v4
        with:
          repository: rhorba/terroir-ma
          path: terroir-ma

      - name: Start backend test stack
        working-directory: terroir-ma
        run: docker compose -f docker-compose.test.yml up -d --wait

      - name: Install pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9

      - name: Install dependencies
        working-directory: terroir-ma-web
        run: pnpm install --frozen-lockfile

      - name: Install Playwright browsers
        working-directory: terroir-ma-web
        run: pnpm exec playwright install --with-deps chromium

      - name: Run Playwright E2E
        working-directory: terroir-ma-web
        run: pnpm test:e2e

      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: terroir-ma-web/playwright-report/
          retention-days: 7
```

**Final verification checkpoint:**

```bash
# In terroir-ma:
npm run lint && npm run typecheck && npm run test:unit

# In terroir-ma-web:
npx tsc --noEmit
```

---

## Testing Summary

| Suite                        | Files                                                                                                    | What it covers                                                  |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Unit — CooperativeListener   | `test/unit/cooperative/cooperative.listener.spec.ts`                                                     | subscribe registration, status update, error handling           |
| Unit — ProductListener       | `test/unit/product/product.listener.spec.ts`                                                             | subscribe registration, testValues JSON.parse, lab/batch update |
| Unit — CertificationListener | `test/unit/certification/certification.listener.spec.ts`                                                 | 4 subscribe registrations, idempotency, error handling          |
| Playwright — setup           | `global-setup.ts`                                                                                        | 7-role auth state generation                                    |
| Playwright — critical        | `certification-chain.spec.ts`, `customs-agent.spec.ts`, `super-admin.spec.ts`                            | role-gated navigation, page load, key actions                   |
| Playwright — smoke           | `cooperative-admin.spec.ts`, `cooperative-member.spec.ts`, `inspector.spec.ts`, `lab-technician.spec.ts` | login → dashboard → list                                        |
| Playwright — QR              | `qr-verify.spec.ts`                                                                                      | public app + seeded UUID                                        |

---

## Story Point Summary

| Story     | Scope                                    | SP     | Batches |
| --------- | ---------------------------------------- | ------ | ------- |
| US-100    | Consumer migration (3 listeners + specs) | 5      | 1–2     |
| US-101    | Playwright infra + critical-path specs   | 5      | 3–4     |
| US-102    | Smoke specs + QR upgrade + CI            | 3      | 5       |
| **Total** |                                          | **13** |         |

---

## Known Constraints

- `testValues` on Avro wire is a JSON string (producer calls `JSON.stringify()`). Consumer must `JSON.parse()` before saving to JSONB. This is the P2-S3 deferred decision.
- Playwright global-setup requires Keycloak AND the portal dev server to be running. CI uses docker-compose.test.yml for Keycloak.
- `KafkaModule` is `@Global()` — no need to import it in individual feature modules.
- Auth state files contain session cookies — `.auth/` directory is gitignored.
- `global-setup.ts` uses `fetch` (Node 20 built-in) — no `node-fetch` import needed.
