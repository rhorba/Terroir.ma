---
name: scrum-agile
description: Scrum framework for solo development with Claude Code as Scrum Master. Product backlog, sprint planning, standups, reviews, retrospectives, Definition of Done/Ready, velocity tracking via files and slash commands.
---

# Scrum Agile — Terroir.ma

## Roles
- **Product Owner:** Developer (Mohamed) — owns backlog, prioritizes
- **Scrum Master:** Claude Code — facilitates ceremonies, tracks blockers
- **Dev Team:** Developer + Claude Code — implements

## Sprint Structure
- Duration: 2 weeks
- Story points: Fibonacci (1, 2, 3, 5, 8, 13)
- Sprint planning: Manual (read backlog, select stories, create sprint log)
- Daily: /daily-standup
- Sprint review: /sprint-status
- Retrospective: /retro

## Definition of Done (Complete Checklist)
A story is DONE when ALL are true:
- [ ] TypeScript strict — no `any` types
- [ ] ESLint passes with zero warnings
- [ ] Prettier formatting applied
- [ ] JSDoc on all public methods
- [ ] Unit tests written and passing (≥80% coverage for changed code)
- [ ] Integration tests for DB/Kafka interactions (if applicable)
- [ ] All existing tests still passing
- [ ] Kafka event interfaces defined (if new events)
- [ ] TypeORM migration generated (if schema changed)
- [ ] Response envelope used on all endpoints
- [ ] Health endpoints work
- [ ] Morocco validators applied (if user input: phone, CIN, ICE, MAD)
- [ ] CNDP compliance verified (if personal data)
- [ ] Progress updated in docs/plans/<feature>/progress.md
- [ ] Session state saved via /save-session

## Definition of Ready (Story is Ready When)
- [ ] Design doc exists (from /brainstorm)
- [ ] Implementation plan exists (from /plan)
- [ ] Story points estimated
- [ ] Dependencies identified and resolved
- [ ] Acceptance criteria defined
- [ ] Backlog item has a TM-XXX ID

## Sprint Log Format
`.sessions/sprint-logs/sprint-N.md`:
```markdown
# Sprint [N] — [Name]
**Dates:** YYYY-MM-DD to YYYY-MM-DD
**Goal:** [One sentence]

## Selected Stories
| ID | Story | Points | Status |
|----|-------|--------|--------|
| TM-001 | Infrastructure scaffold | 8 | ✅ Done |

## Daily Log
### Day 1 (YYYY-MM-DD)
- Session [N]: [what was done]

## Velocity
Planned: [X] | Completed: [Y]
```

## Velocity Tracking
After each sprint, update `docs/project-management/VELOCITY-TRACKER.md`.
Target velocity = 80% of rolling average (last 3 sprints).
Sprint 1 baseline: plan for 16 points (aggressive but motivating).

## Backlog Grooming Rules
- Every feature starts with /brainstorm before entering backlog
- Stories in "Ready" state get estimated before sprint planning
- Phase 2/3 items stay in backlog but are never selected for v1 sprints
- Risk register reviewed at sprint planning
