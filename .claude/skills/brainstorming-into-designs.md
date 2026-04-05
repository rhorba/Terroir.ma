---
name: brainstorming-into-designs
description: Refine rough ideas into fully-formed designs through collaborative questioning. One question at a time, multiple choice preferred, YAGNI ruthlessly. Adapted for Terroir.ma NestJS modular monolith with Kafka events, Keycloak auth, and PostgreSQL.
---

# Brainstorming Into Designs — Terroir.ma

## Process Overview
1. Understand the idea (check project context first)
2. Ask domain-specific questions one at a time
3. Explore 2-3 approaches
4. Present design incrementally (200-300 words per section)
5. Save validated design to docs/plans/

## Step 1: Context Check
Before asking questions, read:
- Recent git commits related to the feature area
- Existing entities in the relevant module(s)
- Current Kafka events that already exist for this domain
- Any related backlog items in PRODUCT-BACKLOG.md

## Step 2: Terroir.ma-Specific Questions
Ask these ONE AT A TIME, multiple choice where possible:

**Module Impact:**
"Which module(s) does [feature] primarily touch?
a) cooperative  b) product  c) certification  d) notification  e) new module needed"

**Kafka Events:**
"Does [feature] need a new event in the certification chain?
a) Yes, it's a new chain step  b) Yes, but it's a side-effect  c) No, read-only  d) Unsure"

**Actor Role:**
"Which actor initiates [feature]?
a) cooperative-admin  b) cooperative-member  c) lab-technician  d) inspector  e) certification-body  f) customs-agent  g) consumer  h) super-admin"

**Product Types:**
"Does [feature] involve lab test parameters?
a) No  b) Yes — all products  c) Yes — specific types: [argan/saffron/olive/honey/dates/roses]"

**QR/Verification:**
"Does [feature] affect QR code generation or public verification?
a) No  b) Yes — QR data changes  c) Yes — verification UI/API changes"

**Localization:**
"Does [feature] show text to end users?
a) No, internal only  b) Yes — needs ar-MA + fr-MA  c) Yes — needs all 3 languages"

**PII:**
"Does [feature] handle personal data (name, CIN, phone, email, GPS)?
a) No  b) Yes — CNDP compliance required"

## Step 3: Approach Generation
Generate exactly 2-3 approaches:
- **Approach A**: Simplest YAGNI version — minimum viable
- **Approach B**: Slightly more capable — handles 80% of cases
- **Approach C** (if needed): Full implementation — Phase 2 candidate

For each approach, specify:
- Module(s) affected
- New Kafka events (if any)
- New entities or fields
- API endpoints
- Auth requirements
- YAGNI assessment

## Step 4: Design Document
Save to `docs/plans/YYYY-MM-DD-<feature>/design.md`:
```markdown
# [Feature Name] Design
**Date:** YYYY-MM-DD
**Status:** Approved | Draft
**Approach chosen:** A | B | C

## Problem Statement
[One paragraph]

## Chosen Approach
[Description]

## Module Impact
- Primary: [module]
- Secondary: [modules]

## Kafka Events
| Event | Topic | Producer | Consumer |
|-------|-------|----------|----------|

## API Contract
| Method | Endpoint | Auth | Role |
|--------|----------|------|------|

## Entity Changes
| Entity | Module | Changes |
|--------|--------|---------|

## Acceptance Criteria
- [ ] ...
```

## Key Principles
- One question at a time — never ask multiple questions at once
- YAGNI ruthlessly — if it's Phase 2, say so and scope it down
- Always check if a new Kafka event is the right solution before proposing direct module coupling
- Prefer extending existing entities over creating new ones for v1
