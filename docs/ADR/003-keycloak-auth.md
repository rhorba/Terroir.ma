# ADR-003: Use Keycloak 24 for Authentication and Authorization

Date: 2026-03-30

## Status

Accepted

## Context

The Terroir.ma platform has 9 distinct roles with non-trivial permission boundaries. A custom authentication system would require significant engineering investment to implement correctly (password hashing, MFA, token rotation, session management, brute-force protection, OIDC compliance). The platform must also:

- Support SSO for cooperative federations that may operate their own identity providers (Phase 2).
- Provide MFA for high-privilege roles (super-admin, certification-body, inspector).
- Remain compliant with OIDC and OAuth 2.0 standards for API client integrations.
- Integrate with Morocco's cooperative federation identity systems in Phase 2.

Building these capabilities from scratch is not an appropriate use of v1 engineering time.

## Decision

Use **Keycloak 24** as the sole identity provider for the platform.

**Authentication flow:** All API endpoints (except `/health` and `/verify/:uuid`) require a valid JWT Bearer token issued by the Terroir.ma Keycloak realm. NestJS passport-jwt validates the token signature against Keycloak's JWKS endpoint (cached with a 5-minute TTL).

**Authorization model:** Roles are stored in Keycloak as realm roles and included in the JWT under `realm_access.roles`. NestJS guards read this claim and enforce role-based access control. No application-level role storage in PostgreSQL.

**Defined roles:**

| Role | Description |
|---|---|
| `super-admin` | Full platform access; user and configuration management |
| `cooperative-admin` | Manages their cooperative's members, products, and certifications |
| `cooperative-member` | Read access to their cooperative's data; submits product batches |
| `lab-technician` | Enters lab analysis results for certification workflows |
| `inspector` | Conducts field inspections; submits inspection reports |
| `certification-body` | Reviews and grants/rejects certification decisions |
| `customs-agent` | Read-only access to certification status for customs checks |
| `consumer` | Public-facing QR verification and product information |
| `service-account` | Machine-to-machine API access (CI, integrations, webhooks) |

**Token lifetimes:**
- Access tokens: 5 minutes
- Refresh tokens: 30 minutes
- Service account tokens: 60 minutes (no refresh; re-authenticated via client credentials)

**Test environments:** A dedicated `terroir-test` realm with pre-seeded users for each role. Realm configuration is version-controlled as a Keycloak realm export JSON.

## Consequences

**Positive:**
- MFA, brute-force protection, password policies, and audit logs are handled by Keycloak out of the box.
- OIDC compliance enables Phase 2 federation with external identity providers without application changes.
- Short access token lifetime (5 minutes) limits the blast radius of a leaked token.
- Pre-seeded test realm enables deterministic integration tests without mocking auth.

**Negative / Risks:**
- **Single point of failure:** A Keycloak outage causes a full platform authentication outage. Mitigation: Phase 2 adds a Keycloak HA cluster (active-passive, shared PostgreSQL backend).
- Short token lifetime increases refresh traffic. Clients must implement silent refresh correctly.
- Keycloak is a heavy dependency (~512MB RAM minimum). Dev environment uses a Docker Compose service.
- Role changes require a Keycloak realm update; there is no application-layer override mechanism in v1.
