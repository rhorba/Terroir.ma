# E2E Test Guide

This guide explains how to write and run end-to-end (E2E) tests for Terroir.ma. E2E tests start the full NestJS application and exercise real HTTP endpoints using Supertest against a Docker-based infrastructure stack.

---

## Prerequisites

### 1. Docker infrastructure must be running

E2E tests require the full test stack. Start it before running any E2E test:

```bash
docker compose -f docker-compose.test.yml up -d
```

This starts:

- PostgreSQL 16 (test database)
- Redpanda (Kafka-compatible broker)
- Redis (QR cache)
- Keycloak (stubbed — only used by mock auth guard in test mode)
- Mailpit (captures outbound emails without sending them)

Wait for all containers to be healthy before proceeding. You can check with:

```bash
docker compose -f docker-compose.test.yml ps
```

### 2. Environment variables

E2E tests read from environment variables. Either export them in your shell or create a `.env.test` file:

| Variable | Example | Description |
|----------|---------|-------------|
| `TEST_DATABASE_URL` | `postgresql://postgres:postgres@localhost:5433/terroir_test` | Test PostgreSQL connection string |
| `TEST_KAFKA_BROKERS` | `localhost:9093` | Redpanda broker address (test port) |
| `TEST_KEYCLOAK_URL` | `http://localhost:8444` | Keycloak base URL (test instance) |

---

## Running E2E Tests

```bash
npm run test:e2e
```

The test runner bootstraps a NestJS application module per test file and tears it down after. Each suite is isolated — no shared application state between files.

---

## Auth Bypass for Tests

Real Keycloak JWT validation is skipped in E2E tests. A test-only `AuthGuard` replaces the production guard. It reads a **mock JWT** from the `Authorization` header and trusts it without making any Keycloak introspection call.

### How it works

The test `AuthGuard` (registered only when `NODE_ENV=test`) decodes the bearer token's payload with `Buffer.from(token.split('.')[1], 'base64')` — no signature verification. This allows tests to construct any role combination without a real Keycloak server.

### buildMockJwt() helper

Use the helper in `test/helpers/app.helper.ts` to generate a mock JWT for any user/role combination:

```ts
import { buildMockJwt, bearerHeader } from '../../helpers/app.helper';

// Build a JWT for a certification-body user
const token = buildMockJwt({
  sub: '00000000-0000-0000-0000-000000000099',
  email: 'certbody@test.ma',
  realm_access: { roles: ['certification-body'] },
});

// Use in Supertest requests
const response = await request(app.getHttpServer())
  .post('/certifications')
  .set(bearerHeader(token))
  .send(dto)
  .expect(201);
```

`bearerHeader(token)` returns `{ Authorization: 'Bearer <token>' }` as a plain object suitable for `.set()`.

---

## Public Endpoints (No Auth Needed)

The QR verification endpoint is always public and requires no mock JWT:

```ts
// No .set(bearerHeader(token)) needed
const response = await request(app.getHttpServer())
  .get(`/verify/${uuid}?sig=${hmac}`)
  .expect(200);
```

---

## Cleanup Between Test Suites

Each test suite must truncate tables in `afterAll` to prevent data from leaking into subsequent suites:

```ts
import { truncateTables } from '../../helpers/database.helper';

afterAll(async () => {
  await truncateTables(dataSource, [
    'cooperative',
    'product',
    'certification',
    'notification',
  ]);

  await app.close();
});
```

---

## Supertest Patterns

### POST — create a resource

```ts
const response = await request(app.getHttpServer())
  .post('/cooperatives')
  .set(bearerHeader(superAdminToken))
  .send({
    name: 'Coopérative Atlas',
    region: 'Souss-Massa',
    registrationNumber: 'RC-2024-001',
  })
  .expect(201);

expect(response.body.id).toBeDefined();
```

### GET — fetch a resource

```ts
const response = await request(app.getHttpServer())
  .get(`/cooperatives/${cooperativeId}`)
  .set(bearerHeader(cooperativeAdminToken))
  .expect(200);

expect(response.body.name).toBe('Coopérative Atlas');
```

### 401 / 403 enforcement

```ts
// No token → 401
await request(app.getHttpServer())
  .get('/certifications')
  .expect(401);

// Wrong role → 403
const consumerToken = buildMockJwt({ realm_access: { roles: ['consumer'] } });
await request(app.getHttpServer())
  .post('/certifications')
  .set(bearerHeader(consumerToken))
  .send(dto)
  .expect(403);
```

### Full lifecycle example — certification state machine

```ts
it('should move a certification from pending to granted', async () => {
  // 1. Request certification
  const { body: cert } = await request(app.getHttpServer())
    .post('/certifications')
    .set(bearerHeader(cooperativeAdminToken))
    .send({ productBatchId: batchId })
    .expect(201);

  expect(cert.status).toBe('pending');

  // 2. Certification body starts review
  await request(app.getHttpServer())
    .patch(`/certifications/${cert.id}/review`)
    .set(bearerHeader(certBodyToken))
    .expect(200);

  // 3. Schedule inspection
  await request(app.getHttpServer())
    .patch(`/certifications/${cert.id}/schedule-inspection`)
    .set(bearerHeader(certBodyToken))
    .send({ inspectionDate: '2026-04-15' })
    .expect(200);

  // 4. File inspection report
  await request(app.getHttpServer())
    .patch(`/certifications/${cert.id}/file-report`)
    .set(bearerHeader(inspectorToken))
    .send({ outcome: 'pass' })
    .expect(200);

  // 5. Grant certification
  const { body: granted } = await request(app.getHttpServer())
    .patch(`/certifications/${cert.id}/grant`)
    .set(bearerHeader(certBodyToken))
    .expect(200);

  expect(granted.status).toBe('granted');
  expect(granted.certificateNumber).toMatch(/^TMA-\d{4}-/);
});
```

---

## Debugging Failing E2E Tests

### Check infrastructure logs

```bash
docker compose -f docker-compose.test.yml logs
```

Filter by service:

```bash
docker compose -f docker-compose.test.yml logs postgres
docker compose -f docker-compose.test.yml logs redpanda
```

### Common failure causes

| Symptom | Likely cause |
|---------|-------------|
| `ECONNREFUSED` on database | `docker-compose.test.yml` not running or wrong port in `TEST_DATABASE_URL` |
| `401 Unauthorized` when 200 expected | Mock `AuthGuard` not registered — check `NODE_ENV=test` is set |
| `403 Forbidden` when 200 expected | Wrong roles in `buildMockJwt()` call |
| Kafka consumer never receives message | Consumer timeout too short, or wrong topic name |
| Test passes locally but fails in CI | Environment variable not set in GitHub Actions secret store |

### Bring down the test stack

```bash
docker compose -f docker-compose.test.yml down -v
```

The `-v` flag removes volumes so you start from a clean database on the next `up`.
