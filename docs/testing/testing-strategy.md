# Testing Strategy — Terroir.ma

This document defines the 3-level test pyramid used across the Terroir.ma NestJS project. Every contributor must follow this strategy to maintain quality, confidence, and a fast feedback loop.

---

## Overview

```
        /\
       /  \
      / E2E \        ← Level 3 — fewest, slowest, most realistic
     /________\
    /          \
   / Integration \   ← Level 2 — moderate count, real infrastructure
  /______________\
 /                \
/    Unit Tests    \  ← Level 1 — most numerous, fastest, fully isolated
/____________________\
```

---

## Level 1 — Unit Tests

**Location:** `test/unit/`
**File pattern:** `test/unit/**/*.spec.ts`

### Tooling

| Tool | Version | Purpose |
|------|---------|---------|
| Jest | 29 | Test runner and assertion library |
| ts-jest | latest | TypeScript support for Jest |
| jest.mock() / manual mocks | — | Isolate all external dependencies |

### Coverage Thresholds

All four coverage dimensions must meet 80% or the CI pipeline fails:

```jsonc
// jest.config.ts (unit project)
coverageThreshold: {
  global: {
    branches:   80,
    functions:  80,
    lines:      80,
    statements: 80,
  },
}
```

### Isolation Rules

- No real database connections — mock TypeORM repositories with `jest.fn()` or `@golevelup/ts-jest`
- No real Kafka producers/consumers — mock `ClientKafka` and `KafkaContext`
- No real HTTP calls — mock `HttpService` / `AxiosInstance`
- No file-system side effects beyond the test process

### What to Unit Test

| Area | Examples |
|------|---------|
| Service business logic | `CertificationService.requestCertification()`, state machine transitions, eligibility checks |
| Validators | Custom class-validator decorators, DTO validation pipes |
| Certification number generation | Format, uniqueness guarantees, prefix rules |
| HMAC signing | `QrService.sign()`, `QrService.verify()`, tampered-payload rejection |
| Template rendering | Handlebars/Mustache helpers, locale interpolation, missing-variable handling |

### Running Unit Tests

```bash
# Run once
npm run test:unit

# Watch mode (development)
npm run test:unit -- --watch

# With coverage report
npm run test:cov
```

---

## Level 2 — Integration Tests

**Location:** `test/integration/`
**File pattern:** `test/integration/**/*.integration.ts`
**Timeout:** 60 000 ms per test (`testTimeout: 60000`)

### Tooling

| Package | Purpose |
|---------|---------|
| `@testcontainers/postgresql` | Spins up a real PostgreSQL 16 container |
| `@testcontainers/kafka` | Spins up a real Redpanda (Kafka-compatible) container |
| `typeorm` | Used directly (no NestJS DI) for raw DataSource operations |

### Infrastructure

Integration tests start **real** containerised services — no in-memory fakes:

- **PostgreSQL 16** — validates TypeORM entity mappings, custom SQL functions, PostGIS queries, and cross-schema joins across all four schemas (`cooperative`, `product`, `certification`, `notification`)
- **Redpanda** — validates Kafka producer/consumer pairs, topic creation, consumer group offsets, and DLQ routing

### What to Integration Test

| Area | What to verify |
|------|---------------|
| TypeORM queries | CRUD across all 4 schemas, constraints, indices, PostGIS functions |
| Kafka producer/consumer pairs | Message serialisation, topic routing, consumer group offset commits |
| Notification template resolution | DB-driven template lookup, locale fallback, variable substitution |

### Running Integration Tests

```bash
# Run integration tests only
npm run test:integration

# Run unit + integration together
npx jest --projects unit integration
```

> Docker Desktop must be running before executing integration tests.

---

## Level 3 — E2E Tests

**Location:** `test/e2e/`
**File pattern:** `test/e2e/**/*.e2e.ts`
**Timeout:** 120 000 ms per test (`testTimeout: 120000`)

### Tooling

| Tool | Purpose |
|------|---------|
| `supertest` | HTTP assertions against the running NestJS app |
| Full NestJS app bootstrap | `Test.createTestingModule()` with real modules |
| `docker-compose.test.yml` | Provides all infrastructure (postgres, redpanda, keycloak, redis) |

### What to E2E Test

| Area | What to verify |
|------|---------------|
| Full request/response cycles | HTTP status codes, response bodies, headers, pagination |
| Auth guard enforcement | 401 on missing token, 403 on insufficient role, 200 on correct role |
| QR verification flow | HMAC validation, Redis cache hit/miss, 403 on tampered signature |
| Certification state machine via API | Full lifecycle: request → review → inspection → grant/deny/revoke |

### Running E2E Tests

```bash
# Bring up test infrastructure first
docker compose -f docker-compose.test.yml up -d

# Run E2E suite
npm run test:e2e
```

---

## Test Data

### Factories — `test/factories/`

Use `@faker-js/faker` to generate dynamic, randomised data for each test run. Factories prevent brittle tests tied to specific values.

```ts
// test/factories/cooperative.factory.ts
import { faker } from '@faker-js/faker';

export const makeCooperative = (overrides = {}) => ({
  name: faker.company.name(),
  region: faker.location.city(),
  registrationNumber: faker.string.alphanumeric(10).toUpperCase(),
  ...overrides,
});
```

Use factories for: unit tests, integration tests where data is not referenced by other tests.

### Fixtures — `test/fixtures/`

Fixed, deterministic data with **hardcoded UUIDs** for integration and E2E tests. Use fixtures when one test's inserted row must be referenced by another assertion.

```ts
// test/fixtures/cooperative.fixture.ts
export const COOPERATIVE_FIXTURE = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Coopérative Atlas',
  region: 'Souss-Massa',
  registrationNumber: 'RC-2024-001',
};
```

Use fixtures for: stable reference data, foreign-key relationships across tables, QR verification UUIDs.

---

## Global Rules

1. **No external network access.** Tests must not call real APIs, send real emails, or connect to any host outside the Docker network. Use mocks (unit), containers (integration), or `docker-compose.test.yml` (e2e).
2. **No shared mutable state between tests.** Each test must set up its own state and clean up after itself. Use `afterEach` truncation in integration/E2E.
3. **Factories for dynamic data; fixtures for stable reference data.** Never hard-code magic strings that should be random; never use `faker` for UUIDs that must remain consistent.

---

## Coverage Report

```bash
npm run test:cov
```

Opens at: `coverage/lcov-report/index.html`

The report covers unit tests only. Integration and E2E tests are excluded from the coverage threshold calculation.

---

## CI Pipeline Schedule

| Level | When it runs |
|-------|-------------|
| Unit tests | Every pull request — must pass before review |
| Integration tests | On merge to `main` |
| E2E tests | Nightly scheduled job |
