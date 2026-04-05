# Database Migrations Runbook — TypeORM

This runbook covers generating, running, reverting, and managing TypeORM database migrations for Terroir.ma.

---

## Overview

Terroir.ma uses TypeORM migrations to manage database schema changes in a versioned, reproducible way. All schema changes — new tables, added columns, dropped indices, constraint changes — must go through a migration file. Direct schema modifications in production are never permitted.

The TypeORM DataSource configuration lives at:

```
src/config/typeorm.config.ts
```

---

## Generating a Migration

When you modify a TypeORM entity, generate a migration that captures the diff:

```bash
npx typeorm migration:generate migrations/MigrationName -d src/config/typeorm.config.ts
```

Replace `MigrationName` with a PascalCase description of the change.

**Example:**

```bash
npx typeorm migration:generate migrations/AddCertificationIndex -d src/config/typeorm.config.ts
```

TypeORM compares the current entity definitions against the database schema and generates the SQL diff as a migration file.

> Always review the generated migration file before committing. TypeORM's diff sometimes produces DROP statements that are unsafe — verify that no data is lost.

---

## Migration File Naming

Generated files follow the format:

```
{timestamp}-{PascalCaseDescription}.ts
```

**Example:**

```
1720000000000-AddCertificationIndex.ts
```

The timestamp is a Unix millisecond timestamp generated automatically by TypeORM. Do not modify it. The description must be PascalCase and describe the purpose of the migration concisely.

**Good names:**
- `1720000000001-AddCooperativeGeoColumn.ts`
- `1720000000002-CreateNotificationTemplateTable.ts`
- `1720000000003-DropLegacyStatusEnum.ts`

**Bad names:**
- `1720000000004-Fix.ts`
- `1720000000005-update.ts`

---

## Running Pending Migrations

Apply all migrations that have not yet run against the target database:

```bash
# Short form (uses the npm script)
npm run migration:run

# Explicit form
npx typeorm migration:run -d src/config/typeorm.config.ts
```

TypeORM tracks which migrations have been applied in the `migrations` table in the database. It runs only the pending ones, in timestamp order.

---

## Reverting the Last Migration

Roll back the most recently applied migration:

```bash
npx typeorm migration:revert -d src/config/typeorm.config.ts
```

This calls the `down()` method of the last applied migration. To revert multiple migrations, run this command multiple times.

---

## Checking Migration Status

List all migrations and whether they have been applied:

```bash
npx typeorm migration:show -d src/config/typeorm.config.ts
```

Output example:

```
[X] 1720000000000-InitialSchema
[X] 1720000000001-AddCertificationIndex
[ ] 1720000000002-AddProductBatchGeoColumn
```

`[X]` = applied. `[ ]` = pending.

---

## Rules

### Never edit a migration that has run in production

Once a migration has been applied to the production database, its file is immutable. If you need to change the schema further, generate a new migration.

Editing an applied migration causes the checksum in the `migrations` table to drift, which will cause TypeORM to error or skip the migration on subsequent deployments.

### Always test the rollback before merging

Before opening a pull request with a new migration:

1. Run the migration: `npm run migration:run`
2. Verify the schema change is correct
3. Revert it: `npx typeorm migration:revert -d src/config/typeorm.config.ts`
4. Confirm the revert brings the schema back to its prior state
5. Run the migration again to leave the database in the correct final state

### One migration per pull request

Each PR must contain at most one migration file. This keeps the rollback surface small and makes code review straightforward.

---

## Rollback Plan

If a bad migration reaches production:

1. Revert the migration:

   ```bash
   npx typeorm migration:revert -d src/config/typeorm.config.ts
   ```

2. Deploy the previous Docker image to restore the application to the state before the bad migration:

   ```bash
   docker pull your-registry/terroir-ma-api:<previous-tag>
   docker service update --image your-registry/terroir-ma-api:<previous-tag> terroir-ma-api
   ```

3. Investigate the root cause, fix the migration, and re-deploy.

---

## CI Integration

Migrations run automatically in GitHub Actions before integration tests execute:

```yaml
# .github/workflows/integration.yml (excerpt)
- name: Run migrations
  run: npm run migration:run
  env:
    DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}

- name: Run integration tests
  run: npm run test:integration
```

This ensures that integration tests always run against a correctly migrated schema, and that any migration that breaks the schema is caught before it reaches `main`.
