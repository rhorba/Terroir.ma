# Session Protocol — Terroir.ma

## Why This Exists
Claude Code has no persistent memory between conversations. This `.sessions/` system provides structured save/resume so development continues seamlessly across sessions.

## Mandatory Protocol
1. **EVERY session STARTS with** `/resume`
2. **EVERY session ENDS with** `/save-session`
3. After every `/execute` batch: auto-save progress to `current-state.json`

## Files
```
.sessions/
├── current-state.json     # Machine-readable project state
├── SESSION-PROTOCOL.md    # This file
├── daily-logs/            # Human-readable daily summaries
│   └── YYYY-MM-DD.md
└── sprint-logs/           # Sprint tracking
    └── sprint-N.md
```

## Infra-First Rule
If a sprint contains a DB/Docker task (migrations, Testcontainers, live service):
1. **Run it in the first 15 minutes** of the session, before any feature code
2. If it fails or requires manual setup → **defer the task immediately** and note the blocker in `current-state.json`
3. Do not let infra tasks carry over more than once — schedule a dedicated infra session instead

This prevents a repeat of the TM-3 pattern (migration verification deferred across 3 sprints because it always came after feature work).

## Crash Recovery
If `current-state.json` is lost:
1. `git log --oneline -20` — find recent `chore(session): save state` commits
2. `ls docs/plans/` — find active plan
3. `ls .sessions/daily-logs/` — find latest daily log
4. Reconstruct state from these sources

## current-state.json Schema
See `.claude/skills/session-persistence.md` for the full JSON schema.
