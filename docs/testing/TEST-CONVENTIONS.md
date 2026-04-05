# Test Conventions

## File Naming

| Level | Pattern | Example |
|-------|---------|---------|
| Unit | `test/unit/**/*.spec.ts` | `certification.service.spec.ts` |
| Integration | `test/integration/**/*.integration.ts` | `certification-chain.integration.ts` |
| E2E | `test/e2e/**/*.e2e.ts` | `certification-flow.e2e.ts` |

## describe / it Structure

```typescript
describe('ClassName', () => {
  describe('methodName()', () => {
    it('should [expected behavior] when [condition]', () => { ... });
    it('should throw [ErrorType] when [invalid condition]', () => { ... });
  });
});
```

- `describe` → class or module name
- nested `describe` → method name with `()`
- `it` → behavior in plain English, starting with `should`
- Never use `test()` — always `it()`

## Arrange / Act / Assert

Every test follows AAA with blank lines separating each phase:

```typescript
it('should mark notification as failed when SMTP throws', async () => {
  // Arrange
  templateRepo.findOne.mockResolvedValue(mockTemplate);
  emailService.send.mockRejectedValue(new Error('SMTP timeout'));

  // Act
  await service.send(opts);

  // Assert
  expect(notificationRepo.update).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ status: 'failed' }),
  );
});
```

## Mocking Rules

- **Unit tests**: mock all external dependencies (repos, services, Kafka producers)
- **Integration tests**: no mocks — use real Testcontainers instances
- **E2E tests**: no mocks except AuthGuard (replaced with TestAuthGuard that reads mock JWT)
- Never mock the system under test
- Use `jest.fn()` for methods, `jest.spyOn()` only when you need the original to also run

## Mock Factory Pattern

```typescript
// Always define mock factories as functions, not objects
const mockNotificationRepo = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn().mockImplementation((dto) => dto),
  update: jest.fn(),
});

// In beforeEach:
{ provide: getRepositoryToken(Notification), useFactory: mockNotificationRepo }
```

## Assertion Rules

- Prefer specific matchers: `toEqual`, `toMatchObject`, `toHaveBeenCalledWith` over `toBeTruthy`
- For partial object matching: `expect.objectContaining({ status: 'granted' })`
- For arrays: `expect.arrayContaining([...])`
- Always assert the **behavior**, not the implementation:
  - ✓ `expect(emailService.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'x@y.com' }))`
  - ✗ `expect(emailService.send).toHaveBeenCalledTimes(1)` (unless count IS the behavior)

## Test Isolation

- `beforeEach`: reset all mocks — `jest.clearAllMocks()` or `jest.resetAllMocks()`
- `afterEach` (integration): truncate tables via `truncateTables()`
- `afterAll` (integration/e2e): destroy dataSource, stop containers, close app
- Never share mutable state between `it` blocks

## Error Testing

```typescript
// For thrown errors:
await expect(service.methodThatThrows()).rejects.toThrow(NotFoundException);
await expect(service.methodThatThrows()).rejects.toMatchObject({
  message: 'Certification not found',
});

// For NestJS HTTP exceptions:
await request(app.getHttpServer())
  .post('/certifications/request')
  .expect(400)
  .expect((res) => expect(res.body.error.code).toBe('VALIDATION_ERROR'));
```

## Coverage Requirements

- Minimum 80% for branches, functions, lines, statements (enforced in `jest.config.ts`)
- Exclusions: `src/main.ts`, `*.spec.ts`, `*.module.ts` (wiring only)
- Run coverage: `npm run test:cov` → opens `coverage/lcov-report/index.html`

## Test Data

- **Dynamic data**: use factories (`test/factories/`) with `@faker-js/faker`
- **Stable reference data**: use JSON fixtures (`test/fixtures/`) with fixed UUIDs
- **Never hardcode UUIDs** in test logic (use factory output or fixture constants)
- **Never use `Date.now()` or `new Date()`** directly in tests — use `faker.date.*` or fixed ISO strings
