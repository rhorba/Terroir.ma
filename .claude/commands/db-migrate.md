# /db-migrate

**Description:** Run, generate, or revert TypeORM migrations.

**Arguments:** $ARGUMENTS = "run" | "generate" | "revert"

**Steps:**
- If $ARGUMENTS is "generate":
  1. Run `npm run migration:generate -- src/migrations/Migration$(date +%s)`
  2. Review the generated migration file for correctness.
  3. Confirm: "Migration generated. Review before running."
- If $ARGUMENTS is "run":
  1. Run `npm run migration:run`
  2. Verify: check TypeORM migration table for new entry.
  3. Run `npm run typecheck` to confirm entities match schema.
- If $ARGUMENTS is "revert":
  1. Show current migration state.
  2. Ask user to confirm revert (DESTRUCTIVE action).
  3. Run `npm run migration:revert`

**Example:** `/db-migrate run`

**Error Handling:**
- If migration fails: show full error, check if PostgreSQL is running, check schema permissions.
- If migration creates conflicts: STOP, do not auto-fix, ask user to review.
- Never auto-sync in production (TypeORM synchronize: false always).
