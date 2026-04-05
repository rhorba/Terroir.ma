# Risk Register

| ID | Description | Probability | Impact | Mitigation | Owner | Status |
|----|-------------|-------------|--------|------------|-------|--------|
| R-001 | Keycloak OIDC integration complexity delays auth | M | H | Sprint 1 spike; mock AuthGuard for early dev; realm pre-seeded | Backend Lead | Open |
| R-002 | ONSSA lab API unavailable for v1 | H | M | File upload as interim; direct API in Phase 2 | Product Owner | Accepted |
| R-003 | PostGIS setup issues on Windows WSL2 | M | M | Docker for all infra; WSL2 known issues documented in runbook | Backend Dev 1 | Open |
| R-004 | Redpanda single-node = message loss on crash | L | H | Acceptable for dev/staging; Phase 2 adds 3-node cluster | Infra | Accepted |
| R-005 | Keycloak single instance = auth outage | L | H | Acceptable for v1; Phase 2 HA Keycloak cluster | Infra | Accepted |
| R-006 | CNDP compliance review delays launch | M | H | Legal review in parallel; CNDP declaration 60 days before go-live | Product Owner | Open |
| R-007 | Arabic/Tifinagh font rendering in email clients | M | L | Test with Gmail/Outlook/Yahoo; system font fallbacks | Backend Dev 2 | Open |
| R-008 | Agricultural campaign year edge case (Oct 1 boundary) | L | M | Unit tested in certification-number.spec.ts | Backend Lead | Mitigated |
| R-009 | QR verification latency > 200ms under load | L | M | Redis cache 5-min TTL; connection pooling; load test Phase 2 | Backend Lead | Open |
| R-010 | Handlebars template injection via context variables | L | H | Context variables are structured data (not raw user strings); HTML auto-escaped by Handlebars | Backend Lead | Mitigated |
| R-011 | HMAC secret leaked via environment variables | M | H | Phase 2: migrate to HashiCorp Vault; .env not committed to git | Backend Lead | Open |
