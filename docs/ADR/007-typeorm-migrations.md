# ADR-007: TypeORM Migrations (Not synchronize) in Production

Date: 2026-03-30

## Status

Accepted

## Context

TypeORM's `synchronize: true` option automatically alters the database schema to match entity definitions on application startup. While convenient during early development, this behavior is dangerous in non-development environments:

- It can **silently drop columns** if a property is removed from an entity, destroying production data.
- It can **rename or recreate constraints** in unexpected ways, causing foreign key violations.
- It runs DDL statements during application startup, which can cause prolonged startup latency or failed deployments under load.
- It provides no audit trail of schema changes.
- It cannot be rolled back.

These risks are unacceptable for a production system managing certification data with regulatory significance.

## Decision

`synchronize` is set based on environment:

| Environment | `synchronize` value | Rationale |
|---|---|---|
| `production` | `false` | All schema changes via migration files |
| `staging` | `false` | Must mirror production behavior |
| `development` | `false` | Enforces migration discipline during development |
| `test` (Testcontainers) | `true` | Containers are ephemeral; synchronize is safe and fast |

**Migration workflow:**

1. Developer modifies a TypeORM entity.
2. Developer runs `typeorm migration:generate -n <description>` to auto-generate a migration file.
3. Developer reviews the generated file, corrects any unsafe operations (e.g., unexpected column drops), and commits it to source control.
4. The migration file is placed in `src/<module>/migrations/` following the naming convention `{timestamp}-{description}.ts` (e.g., `1712345678901-AddCertificationStatusIndex.ts`).
5. CI pipeline runs `typeorm migration:run` against the test database before running integration tests.
6. Deployment pipeline runs `typeorm migration:run` against the target database before starting the new application version.

**Rollback procedure:**
1. Run `typeorm migration:revert` to undo the most recent migration.
2. Deploy the previous application version.
3. Repeat if multiple migrations need reverting.

All migration files must include a `down()` method that cleanly reverses the `up()` operation. Migration files without a valid `down()` will not be merged.

**DataSource configuration:** A dedicated `data-source.ts` file at the repository root exposes the TypeORM `DataSource` instance for use by the CLI, separate from the NestJS application bootstrap to avoid circular initialization.

## Consequences

**Positive:**
- Schema changes are explicit, reviewable, and version-controlled alongside the application code that requires them.
- Rollback is possible via `migration:revert` paired with a previous code version.
- No risk of accidental data loss from synchronize behavior in production or staging.
- Migrations serve as an auditable history of schema evolution.

**Negative / Risks:**
- Developers must remember to generate and commit migration files before or alongside entity changes. Deploying entity changes without a corresponding migration will cause runtime TypeORM errors.
- Migration generation is not always perfect; auto-generated files must be reviewed carefully for unsafe operations (particularly DROP COLUMN and RENAME).
- Migration run time adds to deployment duration. Long-running migrations (e.g., adding an index on a large table) must be planned for zero-downtime deployment (using `CREATE INDEX CONCURRENTLY`).
