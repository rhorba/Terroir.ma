# /daily-standup

**Description:** Generate today's standup report from session logs.

**Steps:**
1. Read the last 1-3 daily logs from `.sessions/daily-logs/`.
2. Read current sprint log from `.sessions/sprint-logs/`.
3. Read `.sessions/current-state.json` for blockers and next actions.
4. Generate standup:
```
## Daily Standup — YYYY-MM-DD

### Yesterday
- [completed tasks from last session]

### Today
- [planned tasks from next_actions in current-state.json]

### Blockers
- [blockers from current-state.json]

### Sprint Progress
- Sprint [N]: [X] of [Y] story points completed
- Velocity: [calculated]
- At-risk items: [list]
```

**Example:** `/daily-standup`
