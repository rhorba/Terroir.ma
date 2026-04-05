# /resume

**Description:** Reload last session state and continue where you left off.

**Steps:**
1. Read `.sessions/current-state.json`. If missing: "No previous session found. Starting fresh."
2. Read latest file in `.sessions/daily-logs/`.
3. If active_feature exists: read its progress.md.
4. If current_sprint exists: read its sprint log.
5. Present context summary:
```
🔄 Session Resumed — Terroir.ma
📅 Last session: YYYY-MM-DD
🏃 Sprint: [N] — [Name] (ends YYYY-MM-DD)
📊 Modules: cooperative [entities✅ controllers❌] | product [❌] | certification [❌] | notification [❌]
🎯 Active Feature: [name] — Task [X] of [Y]
🚫 Blockers: [list]
📝 Decisions to remember: [list]
⚡ Suggested next action: [action]
```
6. Offer: "Ready to continue? Use /execute to resume the active plan."

**Example:** `/resume`

**Error Handling:**
- If current-state.json is corrupted: read daily logs to reconstruct state manually.
- If referenced plan is missing: search docs/plans/ for the most recent plan.
