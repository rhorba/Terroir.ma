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

  // Initialize without synchronize first to create schemas
  const dataSource = new DataSource({
    type: 'postgres',
    url: connectionUri,
    entities,
    synchronize: false,
    logging: false,
  });

  await dataSource.initialize();

  // Create schemas inferred from entity metadata
  const schemas = new Set<string>();
  for (const entity of entities) {
    const meta = dataSource.getMetadata(entity as Function);
    if (meta.schema) schemas.add(meta.schema);
  }
  for (const schema of schemas) {
    await dataSource.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  }

  // Now synchronize tables inside the created schemas
  await dataSource.synchronize();

  return { container, dataSource, connectionUri };
}

export async function stopTestDatabase(db: TestDatabase): Promise<void> {
  await db.dataSource.destroy();
  await db.container.stop();
}
