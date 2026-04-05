# ADR-010: Testcontainers for Integration Tests

Date: 2026-03-30

## Status

Accepted

## Context

The platform uses PostgreSQL features that cannot be adequately mocked at the service layer:

- **PostGIS:** Spatial queries for region boundary lookups.
- **JSONB:** Structured metadata stored and queried as JSONB in product and certification records.
- **Separate schemas:** Schema-level isolation (ADR-004) must be verified in integration tests.
- **TypeORM migrations:** Migration files must be verified against a real database engine before deployment.

Similarly, Kafka (Redpanda) consumer/producer behavior — including idempotency checks, DLQ routing, and consumer group offset management — cannot be meaningfully tested with in-process mocks.

Options considered:

1. **Shared CI database:** Requires managing shared state between test runs, causes flakiness from concurrent test suites, and is not reproducible locally.
2. **Docker Compose in CI:** Requires Docker Compose to be running before tests start, adds CI setup complexity, and makes local test runs depend on manually starting services.
3. **Testcontainers:** Programmatically starts and stops containers within the test process. Each test suite is fully self-contained. Works identically locally and in CI (GitHub Actions with Docker available).

Option 3 was chosen for isolation and reproducibility.

## Decision

Use **Testcontainers** (`@testcontainers/postgresql`, `@testcontainers/kafka`) for all integration tests that require real infrastructure.

**Container lifecycle:**

- Containers are started in `beforeAll` and stopped in `afterAll` for each test suite (Jest describe block).
- Containers are **not** shared across test suite files. Each suite gets fresh containers with a clean state.
- `synchronize: true` is used for the TypeORM data source within Testcontainers tests only (containers are ephemeral; synchronize is safe and avoids migration boilerplate in tests).

**PostgreSQL container:** Uses `postgis/postgis:16-3.4` image to match the production PostGIS version. The container is started with the platform's 4 schemas pre-created by TypeORM synchronize.

**Kafka (Redpanda) container:** Uses the official `redpandadata/redpanda` image. Consumer groups and topics are created programmatically by the test setup.

**Jest configuration (`jest.config.ts`):**

```typescript
testTimeout: 60000  // 60 seconds to accommodate ~30s container startup
```

Developers are encouraged to run integration tests with `--runInBand` locally to avoid port conflicts from parallel container startup.

**CI configuration (GitHub Actions):**

```yaml
- name: Run integration tests
  run: npx jest --testPathPattern=integration
  env:
    TESTCONTAINERS_RYUK_DISABLED: 'false'  # Ryuk cleans up orphaned containers
```

GitHub Actions runners have Docker available by default on `ubuntu-latest`. No Docker-in-Docker (DinD) configuration is required.

**Test file naming convention:** Integration test files are named `*.integration.spec.ts` and are excluded from the default unit test run (`jest --testPathPattern=spec.ts` runs only unit tests).

## Consequences

**Positive:**
- Integration tests run against real PostgreSQL and Redpanda, providing high confidence that queries, migrations, and event flows work correctly in production-equivalent conditions.
- Each suite is fully isolated — no shared state, no test ordering dependencies, no CI database cleanup required.
- Reproducible: tests pass or fail identically on any machine with Docker installed.
- Ryuk (Testcontainers' garbage collector) cleans up orphaned containers from crashed test runs.

**Negative / Risks:**
- **Startup latency:** Container startup adds approximately 25–35 seconds to the first test in each suite. Total integration test suite wall time is significantly longer than unit tests. Mitigation: run integration tests as a separate CI job, not blocking unit test feedback.
- **Resource usage:** Each concurrent integration test suite consumes approximately 512MB RAM (PostgreSQL ~300MB, Redpanda ~200MB). On machines with limited RAM, parallelism must be capped via Jest `--maxWorkers`.
- **Docker required:** Developers without Docker installed cannot run integration tests locally. This is acceptable given the team's standard tooling.
- Testcontainers image pull on first run requires internet access. Mitigation: CI caches Docker images between runs using GitHub Actions cache.
