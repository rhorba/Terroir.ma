/**
 * Testcontainers setup helpers.
 * Provides reusable container lifecycle management for integration tests.
 */

import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';

export interface TestDatabase {
  container: StartedPostgreSqlContainer;
  dataSource: DataSource;
  connectionUri: string;
}

/**
 * Start a PostgreSQL 16 + PostGIS container and initialize a DataSource.
 * Call in beforeAll(); teardown with stopTestDatabase() in afterAll().
 */
export async function startTestDatabase(entities: Function[]): Promise<TestDatabase> {
  const container = await new PostgreSqlContainer('postgis/postgis:16-3.4')
    .withDatabase('terroir_test')
    .withUsername('test')
    .withPassword('test')
    .start();

  const connectionUri = container.getConnectionUri();

  const dataSource = new DataSource({
    type: 'postgres',
    url: connectionUri,
    entities,
    synchronize: true, // safe for tests; never use in production
    logging: false,
  });

  await dataSource.initialize();

  return { container, dataSource, connectionUri };
}

export async function stopTestDatabase(db: TestDatabase): Promise<void> {
  await db.dataSource.destroy();
  await db.container.stop();
}
