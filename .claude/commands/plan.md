# /plan

**Description:** Create a detailed implementation plan from a design document.

**Arguments:** $ARGUMENTS = path to design.md, or empty to use the most recent design in docs/plans/

**Steps:**
1. Announce: "Creating implementation plan."
2. Load the design document from $ARGUMENTS (or most recent if not specified).
3. Write plan with header:
```
# [Feature Name] Implementation Plan
> **For Claude:** Use /execute to implement this plan task-by-task.
**Goal:** [One sentence]
**Architecture:** [Which modules, which events, which entities]
**Tech Stack:** NestJS, TypeScript, PostgreSQL + PostGIS, Redpanda, Keycloak, Redis
**Modules Affected:** [list]
**Estimated Story Points:** [Fibonacci number]
```
4. Break into bite-sized tasks (2-5 minutes each), each with:
   - Files to create or modify
   - Exact code or commands
   - Verification steps
5. Mandatory items per plan:
   - Every Kafka event must have a TypeScript interface in src/common/interfaces/events/
   - Every new endpoint must have class-validator DTOs
   - Every entity change requires a TypeORM migration task
   - Every task batch ends with: `npm run lint`, `npm run typecheck`, `npm run test:unit`
6. Include a "Testing Tasks" section at the end with specific test files.
7. Include story point estimate.
8. Save plan to `docs/plans/YYYY-MM-DD-<topic>/plan.md`.
9. Offer: "Plan saved. Ready to execute? Use /execute."

**Example:** `/plan docs/plans/2026-03-01-batch-recall/design.md`

**Error Handling:**
- If design doc has ambiguities: ask clarifying questions before writing the plan.
- If plan would require cross-module imports: redesign using Kafka events.
