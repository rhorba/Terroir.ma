# /lint-all

**Description:** Run ESLint and Prettier checks on the entire codebase.

**Steps:**
1. Run ESLint: `npm run lint`
2. Run Prettier check: `npm run format:check`
3. Report: show error count per file, grouped by type.
4. If errors found: offer to auto-fix with `npm run lint:fix && npm run format`.
5. Critical: flag any cross-module import violations (ESLint rule enforces this).

**Example:** `/lint-all`

**Error Handling:**
- If ESLint finds cross-module imports (src/modules/A importing from src/modules/B): these MUST be fixed manually — refactor to use Kafka events instead.
- If Prettier finds formatting issues: safe to auto-fix with `npm run format`.
- If ESLint rule @typescript-eslint/no-explicit-any triggers: fix by adding proper types.
