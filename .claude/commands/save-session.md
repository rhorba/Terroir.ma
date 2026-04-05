# /save-session

**Description:** Save current session state before quitting.

**Steps:**
1. Announce: "Saving session state."
2. Generate `.sessions/current-state.json` with:
   - timestamp (ISO 8601)
   - session_id (session-YYYY-MM-DD-NNN)
   - project_phase (scaffolding | development | testing)
   - current_sprint info (number, name, dates, goal)
   - active_feature info (name, docs paths, current batch/task)
   - modules_status (entities/controllers/tests per module)
   - certification_chain_status
   - test_status (unit/integration/e2e counts)
   - blockers, next_actions, decisions_made, files_modified_this_session
3. Write daily log to `.sessions/daily-logs/YYYY-MM-DD.md` with: what was done, decisions, blockers, what's next.
4. Update sprint log in `.sessions/sprint-logs/sprint-[N].md` if in active sprint.
5. Run: `git add .sessions/ && git commit -m "chore(session): save state YYYY-MM-DD"`
6. Print resume instructions: "Session saved. Next time, run /resume to continue."

**Example:** `/save-session`

**Error Handling:**
- If git commit fails: check for uncommitted code changes that need to be included.
- If .sessions/ doesn't exist: create it first.
