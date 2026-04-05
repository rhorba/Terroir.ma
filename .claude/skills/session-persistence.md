---
name: session-persistence
description: File-based session persistence for Claude Code. Saves project state, daily logs, sprint logs so progress is never lost when quitting and resuming. Handles the context-window-loss problem in long development sessions.
---

# Session Persistence — Terroir.ma

## Why This Exists
Claude Code has no persistent memory between conversations. This .sessions/ system provides a structured way to save and restore context so development can continue seamlessly across sessions.

## State Architecture
```
.sessions/
├── current-state.json   # Machine-readable current state
├── SESSION-PROTOCOL.md  # Instructions for save/resume
├── daily-logs/          # Human-readable daily summaries
│   └── YYYY-MM-DD.md
└── sprint-logs/         # Sprint tracking
    └── sprint-N.md
```

## Mandatory Protocol
1. EVERY session STARTS with /resume
2. EVERY session ENDS with /save-session
3. After every /execute batch: auto-save progress to current-state.json

## current-state.json Schema
```json
{
  "timestamp": "2026-03-29T10:00:00Z",
  "session_id": "session-2026-03-29-001",
  "project_phase": "scaffolding",
  "current_sprint": {
    "sprint_number": 1,
    "sprint_name": "Infrastructure Sprint",
    "start_date": "2026-03-28",
    "end_date": "2026-04-11",
    "goal": "Complete infrastructure scaffold and NestJS skeleton"
  },
  "active_feature": {
    "name": "infrastructure-scaffold",
    "plan_doc": "docs/plans/2026-03-28-infrastructure/plan.md",
    "progress_doc": "docs/plans/2026-03-28-infrastructure/progress.md",
    "current_batch": 1,
    "current_task": 3,
    "total_tasks": 15
  },
  "modules_status": {
    "cooperative": { "entities": false, "controllers": false, "tests_passing": null },
    "product": { "entities": false, "controllers": false, "tests_passing": null },
    "certification": { "entities": false, "controllers": false, "tests_passing": null },
    "notification": { "entities": false, "controllers": false, "tests_passing": null }
  },
  "certification_chain_status": {
    "kafka_events_defined": 0,
    "chain_steps_implemented": 0,
    "chain_steps_total": 12,
    "qr_verification_working": false
  },
  "test_status": {
    "unit": { "total": 0, "passing": 0, "coverage": "0%" },
    "integration": { "total": 0, "passing": 0 },
    "e2e": { "total": 0, "passing": 0 }
  },
  "blockers": [],
  "next_actions": ["Complete infrastructure scaffold", "Run make docker-core to verify"],
  "decisions_made": [],
  "files_modified_this_session": []
}
```

## Auto-Save Triggers
- After every /execute batch completes
- After every git commit
- When a module's first entity/service/test is created

## Crash Recovery
If current-state.json is lost:
1. `git log --oneline -20` — see recent commits and chore(session) saves
2. `ls docs/plans/` — find active plan
3. `ls .sessions/daily-logs/` — find latest daily log
4. Reconstruct state from these sources
