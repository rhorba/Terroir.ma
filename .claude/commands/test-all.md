# /test-all

**Description:** Run the full test suite: unit → integration → e2e. Report pass/fail and coverage.

**Steps:**
1. **Unit Tests**: `npm run test:unit`
   - Show pass/fail count per module
   - Show coverage per module (must be ≥80%)
   - Fail fast if coverage drops below threshold
2. **Integration Tests**: `npm run test:integration`
   - Requires Docker running (Testcontainers will spin up PostgreSQL + Redpanda)
   - Show event chain test results
3. **E2E Tests**: `npm run test:e2e`
   - Requires full Docker stack running: `make docker-core`
   - Show certification chain flow results
4. Generate report: pass/fail per level, coverage per module, list of failing tests.

**Example:** `/test-all`

**Error Handling:**
- If unit coverage < 80%: list uncovered files, suggest which tests to write.
- If integration tests fail: check Docker is running with `docker ps`.
- If E2E tests fail: check full stack is up with `/health-check`.
