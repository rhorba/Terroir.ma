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

## Crash Recovery
If `current-state.json` is lost:
1. `git log --oneline -20` — find recent `chore(session): save state` commits
2. `ls docs/plans/` — find active plan
3. `ls .sessions/daily-logs/` — find latest daily log
4. Reconstruct state from these sources

## current-state.json Schema
See `.claude/skills/session-persistence.md` for the full JSON schema.
