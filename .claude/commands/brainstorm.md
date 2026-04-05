# /brainstorm

**Description:** Start a collaborative design session for a new feature.

**Arguments:** $ARGUMENTS = feature name (e.g., "cooperative-dashboard", "lab-test-history")

**Steps:**
1. Announce: "Starting brainstorm session for: $ARGUMENTS"
2. Check current project state: read relevant files, recent git commits, existing docs related to $ARGUMENTS.
3. Ask questions ONE AT A TIME. Prefer multiple choice. Cover:
   a. Which module(s) does this touch? (cooperative / product / certification / notification)
   b. Does it need a new Kafka event in the certification chain?
   c. Which actor role does this affect? (cooperative-admin, lab-technician, inspector, certification-body, customs-agent, consumer)
   d. Does it involve lab test parameters? Which product types?
   e. Does it affect QR code data or verification logic?
   f. Does it need Arabic/French/Amazigh localization?
   g. Does it handle Morocco-specific formats (phone, CIN, ICE, MAD)?
   h. Does it touch CNDP-regulated personal data?
4. Propose 2-3 approaches covering: module design, Kafka events, API contracts, auth requirements.
5. Recommend the most YAGNI approach.
6. Present design in sections of 200-300 words. Check user confirms before continuing.
7. Create `docs/plans/YYYY-MM-DD-$ARGUMENTS/` directory.
8. Save validated design to `docs/plans/YYYY-MM-DD-$ARGUMENTS/design.md`.
9. Offer: "Design saved. Ready to create an implementation plan? Use /plan."

**Example:** `/brainstorm batch-recall-workflow`

**Error Handling:**
- If feature seems to scope into Phase 2/3: flag it and apply YAGNI — suggest a simpler v1 version.
- If feature requires cross-module service imports: redesign to use Kafka events instead.
