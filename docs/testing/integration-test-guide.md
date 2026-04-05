# Integration Test Guide — Testcontainers

This guide explains how to write and run integration tests for Terroir.ma using Testcontainers. Integration tests spin up real PostgreSQL 16 and Redpanda (Kafka) containers and run actual TypeORM queries and Kafka producer/consumer pairs against them.

---

## Prerequisites

Before running integration tests, ensure the following are available on your machine:

| Requirement | Version | Notes |
|-------------|---------|-------|
| Docker Desktop | 25+ | Must be **running** before executing tests |
| Node.js | 20 LTS | Use `nvm use 20` if you have nvm |
| npm | 10+ | Comes with Node 20 |
| Available RAM | 512 MB per suite | Each test suite starts its own containers |

Testcontainers communicates with Docker via the Docker socket. If Docker Desktop is not running, tests will fail immediately with a connection error.

---

## Running Integration Tests

```bash
# Run the integration suite only
npm run test:integration

# Run unit and integration suites together
npx jest --projects unit integration
```

> Integration tests are not included in `npm test` (unit-only) to keep the default developer loop fast. Run them explicitly before opening a pull request for infrastructure-touching code.

---

## Container Lifecycle

Testcontainers follows a `beforeAll` / `afterAll` pattern to minimise container startup overhead:

```
beforeAll()
  └── Start PostgreSQL container
  └── Start Redpanda container (Kafka tests only)
  └── Run schema migrations / synchronize: true
  └── Seed required fixtures

afterEach()
  └── Truncate tables (via database.helper.ts)
  └── Reset Kafka consumer offsets (Kafka tests)

afterAll()
  └── Stop and remove all containers
```

### Why `afterEach` truncation instead of per-test transactions?

TypeORM does not support nested transactions that could be cleanly rolled back between tests. Truncating tables after each test is the simplest and most reliable isolation strategy.

---

## Creating a DataSource for Tests

Create a TypeORM `DataSource` inside `beforeAll`. Use `synchronize: true` (acceptable in tests — never in production) so that TypeORM creates tables automatically from entity definitions without requiring migration files.

```ts
import { DataSource } from 'typeorm';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';

let pg: StartedPostgreSqlContainer;
let dataSource: DataSource;

beforeAll(async () => {
  pg = await new PostgreSqlContainer('postgres:16-alpine').start();

  dataSource = new DataSource({
    type: 'postgres',
    host: pg.getHost(),
    port: pg.getFirstMappedPort(),
    username: pg.getUsername(),
    password: pg.getPassword(),
    database: pg.getDatabase(),
    synchronize: true,   // test-only — never use in production
    logging: false,
    entities: [
      // Cooperative schema
      CooperativeEntity,
      MemberEntity,
      // Product schema
      ProductEntity,
      BatchEntity,
      // Certification schema
      CertificationEntity,
      InspectionEntity,
      // Notification schema
      NotificationEntity,
      NotificationTemplateEntity,
    ],
  });

  await dataSource.initialize();

  // Create schemas if entities use custom schema names
  await dataSource.query(`CREATE SCHEMA IF NOT EXISTS cooperative`);
  await dataSource.query(`CREATE SCHEMA IF NOT EXISTS product`);
  await dataSource.query(`CREATE SCHEMA IF NOT EXISTS certification`);
  await dataSource.query(`CREATE SCHEMA IF NOT EXISTS notification`);
}, 60_000);

afterAll(async () => {
  await dataSource?.destroy();
  await pg?.stop();
});
```

---

## Seeding Fixtures

Use the `seedRows` helper from `test/helpers/database.helper.ts` to insert fixture data before a test or test group:

```ts
import { seedRows } from '../helpers/database.helper';
import { COOPERATIVE_FIXTURE } from '../fixtures/cooperative.fixture';

beforeAll(async () => {
  await seedRows(dataSource, 'cooperative', 'cooperative', [COOPERATIVE_FIXTURE]);
});
```

**Signature:**

```ts
seedRows(
  dataSource: DataSource,
  schema: string,      // e.g. 'cooperative'
  table: string,       // e.g. 'cooperative'
  rows: object[],      // array of plain objects matching the table columns
): Promise<void>
```

`seedRows` uses `INSERT ... ON CONFLICT DO NOTHING` so it is safe to call multiple times with the same fixture data.

---

## Truncating Tables Between Tests

Call `truncateTables` in `afterEach` to reset all relevant tables to an empty state before the next test runs:

```ts
import { truncateTables } from '../helpers/database.helper';

afterEach(async () => {
  await truncateTables(dataSource, [
    'cooperative',
    'product',
    'certification',
    'notification',
  ]);
});
```

**Signature:**

```ts
truncateTables(
  dataSource: DataSource,
  tables: string[],   // table names (schema-qualified if needed)
): Promise<void>
```

Internally this issues `TRUNCATE <table> RESTART IDENTITY CASCADE` for each table in the list.

---

## Kafka Integration Tests

Use `@testcontainers/kafka` (Redpanda image) to test producer/consumer pairs end-to-end:

```ts
import { KafkaContainer, StartedKafkaContainer } from '@testcontainers/kafka';
import { Kafka } from 'kafkajs';

let kafka: StartedKafkaContainer;
let kafkaClient: Kafka;

beforeAll(async () => {
  kafka = await new KafkaContainer('redpandadata/redpanda:v23.3.5').start();

  kafkaClient = new Kafka({
    brokers: [`${kafka.getHost()}:${kafka.getMappedPort(9092)}`],
  });
}, 60_000);

afterAll(async () => {
  await kafka?.stop();
});

it('should produce and consume a certification.requested event', async () => {
  const producer = kafkaClient.producer();
  const consumer = kafkaClient.consumer({ groupId: 'test-group' });

  await producer.connect();
  await consumer.connect();
  await consumer.subscribe({ topic: 'certification.requested', fromBeginning: true });

  const received: unknown[] = [];

  // Run the consumer with a timeout guard
  await Promise.race([
    consumer.run({
      eachMessage: async ({ message }) => {
        received.push(JSON.parse(message.value!.toString()));
      },
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Consumer timeout')), 10_000),
    ),
  ]);

  await producer.send({
    topic: 'certification.requested',
    messages: [{ value: JSON.stringify({ certificationId: 'abc-123' }) }],
  });

  // Allow the consumer loop to process the message
  await new Promise((r) => setTimeout(r, 2_000));

  expect(received).toHaveLength(1);
  expect(received[0]).toMatchObject({ certificationId: 'abc-123' });

  await consumer.disconnect();
  await producer.disconnect();
});
```

**Key points:**

- Always `await consumer.run()` with a `Promise.race` timeout to avoid hanging tests
- Disconnect both producer and consumer in `afterEach` or `afterAll`
- Pin the Redpanda image version (`v23.3.5`) for reproducibility

---

## Full Example Test Structure

```ts
// test/integration/certification/certification-repository.integration.ts

import { DataSource } from 'typeorm';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { truncateTables, seedRows } from '../../helpers/database.helper';
import { CertificationEntity } from '../../../src/certification/entities/certification.entity';
import { COOPERATIVE_FIXTURE } from '../../fixtures/cooperative.fixture';

describe('CertificationRepository (integration)', () => {
  let pg: StartedPostgreSqlContainer;
  let dataSource: DataSource;

  beforeAll(async () => {
    pg = await new PostgreSqlContainer('postgres:16-alpine').start();

    dataSource = new DataSource({
      type: 'postgres',
      host: pg.getHost(),
      port: pg.getFirstMappedPort(),
      username: pg.getUsername(),
      password: pg.getPassword(),
      database: pg.getDatabase(),
      synchronize: true,
      entities: [CertificationEntity],
    });

    await dataSource.initialize();
    await seedRows(dataSource, 'certification', 'cooperative', [COOPERATIVE_FIXTURE]);
  }, 60_000);

  afterEach(async () => {
    await truncateTables(dataSource, ['certification']);
  });

  afterAll(async () => {
    await dataSource?.destroy();
    await pg?.stop();
  });

  it('should persist a new certification with status pending', async () => {
    const repo = dataSource.getRepository(CertificationEntity);

    const cert = repo.create({
      cooperativeId: COOPERATIVE_FIXTURE.id,
      status: 'pending',
    });

    const saved = await repo.save(cert);

    expect(saved.id).toBeDefined();
    expect(saved.status).toBe('pending');
  });
});
```

---

## CI Note

In GitHub Actions, Testcontainers automatically pulls Docker images during the test run — no manual `docker pull` step is needed. To keep CI builds deterministic and fast:

- **Always pin image versions** — use `postgres:16-alpine` not `postgres:latest`
- **Cache Docker layer pulls** — use `docker/setup-buildx-action` with layer caching if image pulls are slow
- Integration tests run on merge to `main` (see `testing-strategy.md` for the full CI schedule)
