# Sprint Ceremonies Guide

## Session Management

Start every Claude Code session:
```
/resume
```
Reads `.sessions/current-state.json` and `.sessions/daily-logs/` to restore context.

End every session:
```
/save-session
```
Writes current work, decisions, and next steps to `.sessions/`.

## Daily Standup

Run at the start of each working day:
```
/daily-standup
```
Generates:
- **Yesterday**: completed tasks from `.sessions/daily-logs/YYYY-MM-DD.json`
- **Today**: planned tasks from current sprint plan
- **Blockers**: items marked as blocked in todo list

## Sprint Planning

At the start of a sprint:
```
/plan Sprint N: [goal description]
```
Claude Code will:
1. Read the product backlog (`docs/project-management/PRODUCT-BACKLOG.md`)
2. Propose stories for the sprint based on priority and velocity
3. Break each story into tasks
4. Save the plan to `docs/plans/sprint-N-plan.md`

## Sprint Review

At the end of a sprint:
1. Demo working software (run `docker compose --profile full up -d`, test endpoints)
2. Update story statuses in `PRODUCT-BACKLOG.md`
3. Update `CHANGELOG.md` with new features
4. Update `.sessions/current-state.json` sprint fields

## Sprint Retrospective

Run at the end of a sprint:
```
/retro
```
Generates a retrospective with:
- **What went well**: patterns from daily logs where work was completed on schedule
- **What to improve**: recurring blockers, technical debt items added
- **Action items**: concrete improvements for next sprint

Saves to `.sessions/sprint-logs/sprint-N-retro.md`.

## Sprint Status Dashboard

At any point during a sprint:
```
/sprint-status
```
Shows:
- Stories: Done / In Progress / Todo / Blocked
- Story points: completed / total
- Days remaining
- Blockers list
- Burn-down summary

## Velocity Tracking

After each sprint retrospective, record velocity in `.sessions/sprint-logs/velocity.json`:
```json
{
  "sprints": [
    { "sprint": 1, "planned": 34, "completed": 28, "date": "2026-04-18" }
  ]
}
```
