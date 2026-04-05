---
name: testing-strategy
description: Three-level testing pyramid for Terroir.ma v1. Unit tests (Jest, 80% coverage), integration tests (Testcontainers with PostgreSQL + Redpanda), E2E tests (docker-compose + Supertest). Moroccan test data factories.
---

# Testing Strategy — Terroir.ma

## Level 1: Unit Tests
**Location:** test/unit/<module>/
**Naming:** *.spec.ts
**Framework:** Jest + ts-jest
**Rule:** Mock ALL externals (database, Kafka, Redis, HTTP)
**Coverage:** Minimum 80% branches/functions/lines/statements

### What to test:
- Service method business logic
- DTO validation rules (valid and invalid inputs)
- Kafka event shape (verify producer emits correct structure)
- Guard logic (mock JWT tokens)
- Morocco validators (phone, CIN, ICE, IF formats)
- Certification number format: TERROIR-{IGP|AOP|LA}-{REGION}-{YEAR}-{SEQ}
- QR HMAC signing and verification
- Lab test parameter validation per product type

### Example unit test:
```typescript
// test/unit/product/lab-test-validation.spec.ts
describe('LabTestValidation', () => {
  it('should reject argan oil with acidity > 0.8%', () => {
    const result = validateLabTest('ARGAN_OIL', { acidity: 1.2 });
    expect(result.passed).toBe(false);
    expect(result.failedParams).toContain('acidity');
  });
});
```

## Level 2: Integration Tests
**Location:** test/integration/<module>/
**Naming:** *.integration.ts
**Framework:** Jest + Testcontainers
**Containers:** PostgreSQL 16 with PostGIS, Redpanda (Kafka)

### Setup pattern:
```typescript
// test/integration/helpers/test-containers.setup.ts
let pgContainer: PostgreSqlContainer;
let redpandaContainer: StartedTestContainer;

beforeAll(async () => {
  pgContainer = await new PostgreSqlContainer('postgis/postgis:16-3.4')
    .withDatabase('terroir_test')
    .start();
  // Run migrations against test DB
  await runMigrations(pgContainer.getConnectionUri());
}, 120_000);

afterAll(async () => {
  await pgContainer.stop();
});
```

### What to test:
- TypeORM queries against real PostgreSQL (with schemas + PostGIS)
- JSONB storage and querying for lab test results
- PostGIS farm coordinate queries
- Kafka produce/consume cycle (KafkaJS → Redpanda)
- Full Kafka event chain: batch.created → lab.test.submitted → lab.test.completed

## Level 3: E2E Tests
**Location:** test/e2e/
**Naming:** *.e2e.ts
**Framework:** Jest + Supertest
**Environment:** docker-compose.test.yml (full infrastructure)

### Key flows to test:
1. Full certification chain: harvest → lab → inspect → certify → QR → scan
2. Auth per role: each role accesses only their endpoints
3. QR verification: generate → scan → see full chain
4. Certification denial + revocation flows

### Auth helper:
```typescript
// test/e2e/helpers/auth.helper.ts
export async function getTokenForRole(role: string): Promise<string> {
  // Real Keycloak token from test realm
}
```

## Test Data: Factories with Moroccan Data
```typescript
// test/factories/cooperative.factory.ts
import { faker } from '@faker-js/faker/locale/ar';
const MOROCCAN_REGIONS = ['Souss-Massa', 'Fès-Meknès', 'Marrakech-Safi'];

export function buildCooperative(overrides = {}) {
  return {
    name: `Coopérative ${faker.company.name()}`,
    ice: faker.string.numeric(15),
    phone: `+2126${faker.string.numeric(8)}`,
    region: faker.helpers.arrayElement(MOROCCAN_REGIONS),
    ...overrides,
  };
}
```

## Test Isolation Rules
- Unit tests: no network, no disk, no real modules
- Integration tests: truncate tables between tests, never drop schemas
- E2E tests: seed fresh data per test suite, clean up after
- NEVER depend on test execution order
