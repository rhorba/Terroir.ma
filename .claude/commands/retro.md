# /retro

**Description:** Generate sprint retrospective from session logs.

**Steps:**
1. Read all daily logs for the completed sprint from `.sessions/daily-logs/`.
2. Read sprint log from `.sessions/sprint-logs/sprint-[N].md`.
3. Read velocity data from `docs/project-management/VELOCITY-TRACKER.md`.
4. Generate retrospective:
```
## Sprint [N] Retrospective — YYYY-MM-DD

### Metrics
- Committed: [X] points | Completed: [Y] points | Velocity: [Z]
- Test coverage: [X%] → [Y%]

### What Went Well
- [item from logs]

### What Didn't Go Well
- [item from logs]

### Action Items
| Item | Owner | Due |
|------|-------|-----|
| [action] | Developer | Next sprint |

### Decisions Made This Sprint
- [decision and rationale]

### Definition of Done Compliance
- [checklist items with pass/fail]
```
5. Update `docs/project-management/VELOCITY-TRACKER.md` with sprint velocity.
6. Save retro to `.sessions/sprint-logs/sprint-[N]-retro.md`.

**Example:** `/retro`
