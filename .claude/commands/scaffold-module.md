# /scaffold-module

**Description:** Create a new NestJS domain module in src/modules/$ARGUMENTS with all required boilerplate: module.ts, controller, service, entities, dto, events (producer + listener), and a new PostgreSQL schema. Update app.module.ts to import it.

**Arguments:** $ARGUMENTS = module name (kebab-case, e.g., audit, traceability)

**Steps:**
1. Validate $ARGUMENTS is a valid module name (lowercase, kebab-case, no existing module conflict).
2. Create `src/modules/$ARGUMENTS/` directory structure:
   - `$ARGUMENTS.module.ts`
   - `controllers/$ARGUMENTS.controller.ts`
   - `services/$ARGUMENTS.service.ts`
   - `entities/$ARGUMENTS.entity.ts`
   - `dto/create-$ARGUMENTS.dto.ts`
   - `dto/update-$ARGUMENTS.dto.ts`
   - `events/$ARGUMENTS-events.ts`
   - `events/$ARGUMENTS.producer.ts`
   - `listeners/$ARGUMENTS.listener.ts`
3. Create PostgreSQL schema migration: add `CREATE SCHEMA IF NOT EXISTS $ARGUMENTS;` to infrastructure/postgresql/init/01-init.sql.
4. Add TypeScript event interfaces to `src/common/interfaces/events/$ARGUMENTS.events.ts`.
5. Open `src/app.module.ts` and add the new module to imports.
6. Run `npm run lint` and `npm run typecheck` to verify.

**Example:** `/scaffold-module audit`

**Error Handling:**
- If module already exists: STOP, do not overwrite. Ask user to choose a different name.
- If app.module.ts import fails: check for syntax errors and fix.
- If typecheck fails after scaffolding: fix type errors before proceeding.
