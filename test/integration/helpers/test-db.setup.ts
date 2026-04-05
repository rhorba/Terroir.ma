/**
 * Database schema setup for integration tests.
 * Creates PostgreSQL schemas and seeds reference data before test suites run.
 */

import { DataSource } from 'typeorm';

/**
 * Create the four domain schemas in the test database.
 * TypeORM's `synchronize: true` creates tables within the default public schema;
 * call this after initialize() to ensure schemas exist before schema-qualified queries.
 */
export async function createSchemas(dataSource: DataSource): Promise<void> {
  const schemas = ['cooperative', 'product', 'certification', 'notification'];
  for (const schema of schemas) {
    await dataSource.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  }
}

/**
 * Drop all tables in the given schemas (for full reset between test suites).
 * Less granular than truncateTables — use only in afterAll.
 */
export async function dropSchemas(dataSource: DataSource): Promise<void> {
  const schemas = ['cooperative', 'product', 'certification', 'notification'];
  for (const schema of schemas) {
    await dataSource.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  }
}

/**
 * Reset sequences in a schema (useful after truncating to keep IDs predictable in tests).
 */
export async function resetSequences(dataSource: DataSource, schema: string): Promise<void> {
  const sequences = await dataSource.query<{ sequence_name: string }[]>(
    `SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = $1`,
    [schema],
  );

  for (const { sequence_name } of sequences) {
    await dataSource.query(
      `ALTER SEQUENCE "${schema}"."${sequence_name}" RESTART WITH 1`,
    );
  }
}
