# /execute

**Description:** Execute an implementation plan in batches of 3 tasks with verification checkpoints.

**Arguments:** $ARGUMENTS = path to plan.md, or empty to use the most recent plan

**Steps:**
1. Announce: "Executing plan."
2. **Load and Audit:** Read plan from $ARGUMENTS. Verify all module, Kafka, and Keycloak paths are addressed. If critical gaps exist, STOP and raise them.
3. **Execute Batch (3 tasks at a time):**
   - Mark task as in_progress
   - Follow every step exactly as written in the plan
   - Run verification after each task
   - Mark task as completed
   - After each batch, run: `npm run lint && npm run typecheck && npm run test:unit`
4. **Update progress.md:**
```
# Execution Progress
**Plan:** `docs/plans/<folder>/plan.md`
**Last updated:** YYYY-MM-DD
## Status
| Task | Title | Status |
|------|-------|--------|
| 1 | [title] | ✅ completed |
## Batch Log
### Batch 1 (Tasks 1–3) — YYYY-MM-DD
- ✅ Task 1: [summary]
- Verification: lint ✅ typecheck ✅ test ✅
## Resume Instructions
To continue: /execute docs/plans/<folder>/plan.md
Next batch starts at Task N.
```
5. **After ALL tasks complete:** Write test plan, execute it, fix failures. Only after all tests pass: declare plan complete.
6. **STOP if (Critical Blockers):** Type mismatch, migration fails, build fails, Kafka event schema invalid, health check non-200, ambiguity. DO NOT GUESS — ask user.

**Example:** `/execute docs/plans/2026-03-01-batch-recall/plan.md`

**Error Handling:**
- Never skip a failing verification step.
- Never proceed with ambiguous requirements.
- If lint fails: fix before moving to next batch.
