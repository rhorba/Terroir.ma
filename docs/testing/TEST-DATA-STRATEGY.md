# Test Data Strategy

## Three Sources of Test Data

### 1. Factories (dynamic, randomized)
**Location**: `test/factories/*.factory.ts`
**Use for**: Unit and integration tests where any valid value works.

```typescript
// Example usage
const coop = buildCooperative();                          // random valid cooperative
const coop = buildCooperative({ overrides: { regionCode: 'SFI' } }); // with override
const cert = buildGrantedCertification();                 // already granted
```

Available factories:
| File | Exports |
|------|---------|
| `cooperative.factory.ts` | `buildCooperative`, `buildVerifiedCooperative` |
| `product.factory.ts` | `buildProduct`, `buildProductBatch` |
| `harvest.factory.ts` | `buildHarvest`, `buildHarvestWithBatch` |
| `lab-test.factory.ts` | `buildLabTestEvent`, `buildPassingLabTestEvent`, `buildFailingLabTestEvent` |
| `certification.factory.ts` | `buildCertificationRequest`, `buildGrantedCertification` |
| `qr-code.factory.ts` | `buildQrCode`, `buildVerifiedQrPayload` |
| `inspection.factory.ts` | `buildScheduleInspectionDto`, `buildFileInspectionReportDto` |
| `notification.factory.ts` | `buildSendNotificationOptions`, `buildNotificationTemplate` |
| `user.factory.ts` | `buildJwtPayload`, `buildCooperativeAdminJwt`, `buildCertificationBodyJwt`, `buildInspectorJwt` |

### 2. Fixtures (stable, fixed UUIDs)
**Location**: `test/fixtures/`
**Use for**: Integration and E2E tests where foreign keys must be consistent across tables.

```typescript
import { COOPERATIVE_FIXTURES } from '../fixtures/cooperative.fixture';
// COOPERATIVE_FIXTURES[0].id === '11111111-1111-1111-1111-111111111111' — always
```

Available fixtures:
| File | Contents |
|------|----------|
| `cooperative.fixture.ts` | 3 cooperatives with stable UUIDs |
| `cooperatives.fixture.json` | Same 3 cooperatives as JSON (for DB seed scripts) |
| `certification-types.fixture.ts` | AOP, IGP, LA reference data |
| `notification-templates.fixture.ts` | 4 notification templates for testing |
| `product-types.fixture.json` | Product type reference data |
| `lab-results.fixture.json` | Sample lab test results (passing and failing) |

### 3. Inline (constants only)
**Use for**: Known-bad inputs and boundary values.

```typescript
// Good: testing a specific invalid value
it('should reject ICE with 14 digits', () => {
  expect(isValidICE('12345678901234')).toBe(false); // 14 digits — inline OK
});

// Bad: constructing a full entity inline
// Use a factory instead
```

---

## Database Seeding for Integration Tests

Pattern for seeding fixtures before integration tests:

```typescript
import { seedRows } from '../helpers/database.helper';
import { COOPERATIVE_FIXTURES } from '../fixtures/cooperative.fixture';

beforeAll(async () => {
  await seedRows(dataSource, 'cooperative', 'cooperative', COOPERATIVE_FIXTURES);
});
```

For cleanup between tests:
```typescript
afterEach(async () => {
  await truncateTables(dataSource, ['cooperative', 'certification']);
});
```

---

## Factory Design Principles

1. **Sensible defaults**: every factory produces valid data without overrides
2. **Minimal overrides**: only override what the test specifically needs
3. **No side effects**: factories build objects — they do NOT call services or save to DB
4. **Typed overrides**: use `Partial<EntityType>` for type safety

```typescript
// Template for a factory function
export function buildFoo(overrides: Partial<FooDto> = {}): FooDto {
  return {
    id: faker.string.uuid(),
    name: faker.company.name(),
    ...overrides,           // overrides last — callers can override any field
  };
}
```

---

## Test Data Anti-Patterns

| Anti-pattern | Problem | Fix |
|---|---|---|
| `id: '1234'` hardcoded in test | Breaks if ID format changes | Use `faker.string.uuid()` |
| Shared mutable object across tests | Test pollution | Create fresh instance in each test |
| `Date.now()` in assertions | Flaky — depends on execution time | Use `expect.any(Date)` or fixed ISO string |
| Seeding data that isn't cleaned up | Leaks into other tests | `afterEach` truncate |
| Expecting exact error messages | Brittle | Match error code, not full message string |
