# Communication Plan

## Stakeholder Communication

| Stakeholder | Channel | Frequency | Content |
|------------|---------|-----------|---------|
| MAPMDREF (Product Owner) | Email + monthly meeting | Monthly | Sprint review demo, roadmap updates, blockers |
| Dev team (internal) | Daily standup via `/daily-standup` command | Daily | Progress, blockers, next steps |
| CNDP | Formal correspondence | As needed | CNDP declaration, incident reports |
| Cooperative pilot users | Email + in-app notifications | As needed | Beta access, onboarding guide |

## Internal Development Communication

### Daily
- Run `/daily-standup` at start of session → generates standup summary
- Save to `.sessions/daily-logs/YYYY-MM-DD.json`

### Per Sprint
- Sprint start: `/plan` → creates `docs/plans/sprint-N-plan.md`
- Sprint end: `/retro` → saves to `.sessions/sprint-logs/sprint-N-retro.md`
- Update `CHANGELOG.md` and `PRODUCT-BACKLOG.md` story statuses

### Incident Communication
- Critical bugs affecting data integrity → notify MAPMDREF within 24h
- Personal data breach → notify CNDP within 72h (Law 09-08)
- Kafka DLQ messages detected → investigate within 4h

## Session Continuity

Since this is a single-developer project using Claude Code:
- Every session starts with `/resume` to restore context
- Every session ends with `/save-session` to persist state
- The `.sessions/current-state.json` is the single source of truth for current sprint state
- See [SESSION-PROTOCOL.md](../../.sessions/SESSION-PROTOCOL.md) for full protocol
