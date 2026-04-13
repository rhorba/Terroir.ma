import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import * as path from 'path';

dotenv.config();

/**
 * TypeORM CLI data source.
 * Used by `typeorm migration:run`, `migration:generate`, `migration:revert`.
 *
 * Usage:
 *   npx typeorm -d src/database/data-source.ts migration:run
 *   npx typeorm -d src/database/data-source.ts migration:generate src/database/migrations/MyMigration
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL ?? 'postgresql://terroir:terroir@localhost:5432/terroir_ma',
  schema: 'public',
  entities: [path.join(__dirname, '../modules/**/entities/*.entity{.ts,.js}')],
  migrations: [path.join(__dirname, './migrations/*{.ts,.js}')],
  migrationsTableName: 'typeorm_migrations',
  synchronize: false,
  logging: process.env.NODE_ENV !== 'production',
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});
