---
name: Feature Request
about: Propose a new feature or enhancement for the Terroir.ma platform
title: '[FEAT] '
labels: enhancement, needs-triage
assignees: ''
---

## Problem Statement

<!-- What problem does this feature solve? Why does it matter for Morocco's terroir certification ecosystem?
     Be specific: which user role is affected (cooperative-admin, certification-auditor, consumer, platform-admin)? -->

## Proposed Solution

<!-- Describe the solution you'd like. Be as specific as possible about the user-facing behaviour and the technical approach. -->

## Terroir.ma Module

<!-- Which module does this feature primarily belong to? -->

- [ ] `cooperative` — Cooperative registration, management, Keycloak group sync
- [ ] `product` — Product catalog, batch tracking, terroir metadata, SDOQ designation
- [ ] `certification` — SDOQ review workflow, auditor assignment, QR code issuance
- [ ] `notification` — Email templates, event-driven notifications
- [ ] `common` — Shared utilities, guards, decorators
- [ ] New module (fill out the Module Request template instead)

## Kafka Events Needed

<!-- List any new Kafka events this feature would produce or consume.
     Use the format: `domain.event-name` (e.g., `product.batch-registered`) -->

**Produces:**
-

**Consumes:**
-

## Keycloak Roles Affected

<!-- Which Keycloak realm roles need to be able to access this feature? -->

- [ ] `cooperative-admin`
- [ ] `product-manager`
- [ ] `certification-auditor`
- [ ] `platform-admin`
- [ ] Public (no authentication required)

## Morocco-Specific Considerations

<!-- Does this feature involve any Morocco-specific data, regulations, or edge cases? -->

- [ ] CIN (Carte d'Identité Nationale) validation
- [ ] ICE (Identifiant Commun de l'Entreprise) validation
- [ ] Commune / Province / Region from RGPH 2014 list
- [ ] Geographic coordinates within Morocco bounding box
- [ ] Law 25-06 SDOQ designation rules (AOP / IGP / STG)
- [ ] Arabic / French bilingual content
- [ ] None of the above

## Acceptance Criteria

<!-- Define what "done" looks like for this feature as a checklist -->

- [ ] ...
- [ ] ...
- [ ] ...

## Alternatives Considered

<!-- What other approaches did you consider and why did you reject them? -->

## Additional Context

<!-- Mockups, API design sketches, relevant sections of Law 25-06, links to OMPIC/ONSSA documentation, etc. -->
