---
name: executing-plans
description: Execute implementation plans in controlled batches of 3 with mandatory verification checkpoints. Ensures modules remain in sync before moving between batches. Tracks progress in progress.md.
---

# Executing Plans — Terroir.ma

## Pre-Execution Audit
Before starting any plan:
1. Read the plan completely
2. Verify referenced file paths exist (or know they'll be created)
3. Check that all Kafka event interfaces are defined first
4. Check that no task would introduce cross-module imports
5. If any ambiguity exists: STOP and ask — never guess

## Batch Execution Protocol
Execute exactly 3 tasks per batch:
1. Mark task as `in_progress`
2. Execute every step in order
3. Run task-level verification
4. Mark task as `completed`
5. Repeat for next 2 tasks
6. After batch: run `npm run lint && npm run typecheck && npm run test:unit`
7. If verification fails: fix NOW, do not proceed to next batch
8. Update progress.md

## Progress Tracking
```markdown
# Execution Progress
**Plan:** docs/plans/[folder]/plan.md
**Last updated:** YYYY-MM-DD HH:MM
**Status:** In Progress | Completed | Blocked

## Task Status
| # | Task | Status | Batch |
|---|------|--------|-------|
| 1 | Define entity | ✅ completed | 1 |
| 2 | Create service | ✅ completed | 1 |
| 3 | Create controller | ✅ completed | 1 |
| 4 | Add Kafka producer | ⏳ pending | 2 |

## Batch Log
### Batch 1 (Tasks 1–3) — YYYY-MM-DD
- ✅ Task 1: Created cooperative.entity.ts with all fields
- ✅ Task 2: Created cooperative.service.ts with register()
- ✅ Task 3: Created cooperative.controller.ts with POST /cooperatives
- Verification: lint ✅ typecheck ✅ test ✅

## Resume Instructions
To continue: /execute docs/plans/[folder]/plan.md
Next batch: Batch 2, starting at Task 4
```

## Critical Blockers — STOP CONDITIONS
Do NOT proceed if:
- TypeScript compilation fails (type errors)
- ESLint detects cross-module imports
- TypeORM migration fails to run
- Build fails (`npm run build`)
- Kafka event schema conflicts with existing interface
- Health check returns non-200 after code change
- Any ambiguity about which module owns a piece of logic

When blocked: report the exact error, show what was attempted, ask user for direction.

## Test Plan (Final Step)
After ALL tasks are completed:
1. Write test plan: docs/plans/[folder]/test-plan.md
2. Create test files per the testing tasks section
3. Run `npm run test:unit -- [module]`
4. Fix ALL failures (no skipping)
5. Only after ALL tests pass: declare plan complete

## Definition of Done Check
Before declaring a plan complete, verify:
- [ ] TypeScript strict — no `any` types
- [ ] ESLint zero warnings
- [ ] All public methods have JSDoc
- [ ] Unit tests written (≥80% coverage for changed code)
- [ ] Kafka event interfaces defined
- [ ] TypeORM migration generated if schema changed
- [ ] Response envelope used on all endpoints
- [ ] Morocco validators applied where applicable
- [ ] progress.md updated to "Completed"
