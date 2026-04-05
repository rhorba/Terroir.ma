import { DataSource } from 'typeorm';

/**
 * Truncate all tables in the given schemas (in dependency order) between integration tests.
 * Uses TRUNCATE ... CASCADE for safety.
 */
export async function truncateTables(dataSource: DataSource, schemas: string[] = ['cooperative', 'product', 'certification', 'notification']): Promise<void> {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();

  try {
    await queryRunner.startTransaction();

    for (const schema of schemas) {
      await queryRunner.query(
        `DO $$ DECLARE r RECORD; BEGIN FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = '${schema}') LOOP EXECUTE 'TRUNCATE TABLE ${schema}.' || quote_ident(r.tablename) || ' CASCADE'; END LOOP; END $$;`,
      );
    }

    await queryRunner.commitTransaction();
  } catch (err) {
    await queryRunner.rollbackTransaction();
    throw err;
  } finally {
    await queryRunner.release();
  }
}

/**
 * Execute raw SQL against the test database — useful for seeding fixtures.
 */
export async function seedRows(
  dataSource: DataSource,
  schema: string,
  table: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) return;

  const columns = Object.keys(rows[0]);
  const colList = columns.map((c) => `"${c}"`).join(', ');

  for (const row of rows) {
    const values = columns.map((c) => row[c]);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    await dataSource.query(
      `INSERT INTO "${schema}"."${table}" (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
      values,
    );
  }
}
