---
name: writing-plans
description: Create detailed implementation plans with bite-sized tasks (2-5 min each), exact file paths, code examples, and verification steps. Assumes zero codebase context — plans must be self-contained.
---

# Writing Plans — Terroir.ma

## Plan Header Template
```markdown
# [Feature Name] Implementation Plan
> **For Claude:** Use /execute to implement this plan task-by-task.

**Goal:** [One sentence describing what will work when done]
**Architecture:** [Modules touched, events added, entities changed]
**Tech Stack:** NestJS 10, TypeScript 5.4 strict, PostgreSQL 16 + PostGIS, Redpanda, Keycloak 24, Redis 7
**Modules Affected:** [list]
**Estimated Story Points:** [Fibonacci: 1, 2, 3, 5, 8, 13]
**Backlog Reference:** TM-XXX
```

## Task Granularity Rules
Each task should be completable in 2-5 minutes and produce ONE artifact:
- "Define TypeORM entity Harvest with all fields" — one task
- "Create HarvestController with 2 endpoints" — one task
- "Create HarvestService.logHarvest() method" — one task
- "Create Kafka producer for product.harvest.logged event" — one task
- NOT "Build the entire harvest feature" — too large

## Task Template
```markdown
### Task N: [Descriptive title]
**File(s):** `src/modules/product/entities/harvest.entity.ts` (create)
**Steps:**
1. Create file at [path]
2. [Exact code to write]
3. [Command to run to verify]
**Verification:** `npm run typecheck` passes
```

## Mandatory Requirements Per Plan
1. **Kafka Events** — every new event needs:
   - Task: "Define [EventName] TypeScript interface in src/common/interfaces/events/"
   - Task: "Create [Module]Producer.publish[Event]() method"
   - Task: "Create [Module]Listener.handle[Event]() consumer"
2. **DTOs** — every endpoint needs:
   - Task: "Create [Action][Entity]Dto with class-validator decorators"
3. **Migrations** — every entity change needs:
   - Task: "Generate TypeORM migration for [change]"
4. **Verification Checkpoint** — every 3 tasks, add:
   - Task: "Verification checkpoint: npm run lint && npm run typecheck && npm run test:unit"
5. **Test Tasks** — mandatory section at end:
   - "Write unit tests for [Service].[method]()"
   - "Write integration test for [flow]"

## Kafka Event Task Template
```markdown
### Task N: Define [EventName] TypeScript interface
**File:** `src/common/interfaces/events/[module].events.ts` (modify)
**Steps:**
1. Add interface extending BaseEvent:
```typescript
export interface [EventName]Event extends BaseEvent {
  [field]: [type];
}
```
**Verification:** `npm run typecheck` passes
```

## Keycloak Guard Task Template
```markdown
### Task N: Add Keycloak role guard to [Endpoint]
**File:** `src/modules/[module]/controllers/[module].controller.ts` (modify)
**Steps:**
1. Add decorators above the method:
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('[role-name]', 'super-admin')
```
**Verification:** Test with invalid token → 401, wrong role → 403, correct role → 200/201
```

## Story Points Reference
- 1 point: simple CRUD endpoint, minor config change
- 2 points: entity + service + controller
- 3 points: module with Kafka events
- 5 points: complex workflow (multi-step, multi-entity)
- 8 points: full certification chain segment
- 13 points: entire module from scratch
