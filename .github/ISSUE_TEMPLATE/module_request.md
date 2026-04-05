---
name: Module Request
about: Propose a new domain module to add to the Terroir.ma modular monolith
title: '[MODULE] '
labels: module-request, needs-triage, architecture
assignees: ''
---

## New Module Name

<!-- Snake-case name, e.g. `inspection` or `traceability` -->

**Module name:** `src/modules/`

## Domain Coverage

<!-- What real-world domain concept does this module own?
     Which part of Morocco's Law 25-06 certification ecosystem does it address? -->

## Entities

<!-- List the TypeORM entities this module would own. Modules own their own database tables. -->

| Entity Name | Description | Key Fields |
|-------------|-------------|------------|
| | | |
| | | |

## PostgreSQL Schema

<!-- Sketch the main tables and their columns. Include any PostGIS geometry columns if relevant. -->

```sql
-- Example
CREATE TABLE inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cooperative_id UUID NOT NULL,
  -- ...
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Kafka Events Produced

<!-- Events this module publishes for other modules to consume.
     Format: `module.event-name` with payload description. -->

| Event Topic | Payload | When Emitted |
|------------|---------|--------------|
| | | |

## Kafka Events Consumed

<!-- Events from other modules that this module needs to react to. -->

| Event Topic | Producer Module | Action Taken |
|------------|----------------|--------------|
| | | |

## REST API Endpoints

<!-- Key HTTP endpoints this module exposes. -->

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| | | | |

## Keycloak Roles Required

<!-- What new or existing Keycloak realm roles are needed to access this module's endpoints? -->

- [ ] Uses existing roles only: `cooperative-admin`, `product-manager`, `certification-auditor`, `platform-admin`
- [ ] Requires new role(s): _______________

## Cross-Module Communication

<!-- This module must NOT directly import from other modules.
     Describe how it receives data it needs from other modules (via Kafka events or REST calls). -->

## Morocco-Specific Considerations

<!-- Any Law 25-06 provisions, OMPIC/ONSSA rules, or Moroccan data formats this module must handle. -->

## Justification / Business Value

<!-- Why does this module need to exist as a separate module rather than extending an existing one? -->
