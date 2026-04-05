# /sprint-status

**Description:** Generate sprint dashboard with story progress and velocity.

**Steps:**
1. Read current sprint log from `.sessions/sprint-logs/sprint-[N].md`.
2. Read `docs/project-management/PRODUCT-BACKLOG.md` for story details.
3. Read `.sessions/current-state.json` for module and test status.
4. Generate dashboard:
```
## Sprint [N] Status — YYYY-MM-DD

### Stories
| ID | Story | Points | Status |
|----|-------|--------|--------|
| TM-001 | Infrastructure scaffold | 8 | ✅ Done |

### Metrics
- Planned: [X] points
- Completed: [Y] points
- Remaining: [Z] points
- Days remaining: [N]
- Projected completion: [On track / At risk / Behind]

### Module Health
- Cooperative: [status]
- Product: [status]
- Certification: [status]
- Notification: [status]

### Test Health
- Unit: [pass/fail, coverage%]
- Integration: [pass/fail]
- E2E: [pass/fail]
```

**Example:** `/sprint-status`
