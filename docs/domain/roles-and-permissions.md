# Roles and Permissions

This document defines the nine Keycloak roles used by the Terroir.ma platform and specifies which HTTP endpoints each role is authorised to call per module.

---

## Role Definitions

| Role | Description |
|------|-------------|
| `super-admin` | Platform administrator. Can verify cooperatives, manage product specifications, and override decisions. |
| `cooperative-admin` | Administrator of a registered cooperative. Manages the cooperative's profile, members, and certification requests. |
| `cooperative-member` | Rank-and-file member of a cooperative. Logs harvests and creates batches. |
| `lab-technician` | Employee of an ONSSA-accredited laboratory. Submits lab analysis results for batch samples. |
| `inspector` | Appointed field inspector. Conducts on-site inspections and files inspection reports. |
| `certification-body` | Certification authority officer. Schedules inspections, reviews dossiers, and issues grant/deny/revoke decisions. |
| `customs-agent` | EACCE or customs official. Validates export clearance documents for certified batches. |
| `consumer` | End consumer or member of the public. Can verify product certification via QR code scan. |
| `service-account` | Machine-to-machine service identity. Used by internal Kafka event consumers and background jobs. No REST API access. |

---

## Authentication

All endpoints (except the public QR verify endpoint) require a valid Keycloak-issued JWT Bearer token in the `Authorization` header. The JWT is validated against the Keycloak realm public key on every request. Role extraction is performed from the `realm_access.roles` claim.

The public QR verify endpoint (`GET /verify/:uuid`) accepts unauthenticated requests.

---

## Cooperative Module

Base path: `/cooperatives`

| Endpoint | Method | Description | Allowed Roles |
|----------|--------|-------------|---------------|
| `/cooperatives` | POST | Register a new cooperative | `cooperative-admin` |
| `/cooperatives/:id` | GET | Get cooperative details | `cooperative-admin`, `cooperative-member`, `super-admin`, `certification-body` |
| `/cooperatives/:id` | PATCH | Update cooperative profile | `cooperative-admin` |
| `/cooperatives/:id/verify` | POST | Approve cooperative registration | `super-admin` |
| `/cooperatives/:id/reject` | POST | Reject cooperative registration | `super-admin` |
| `/cooperatives/:id/members` | POST | Add a member to the cooperative | `cooperative-admin` |
| `/cooperatives/:id/members` | GET | List cooperative members | `cooperative-admin`, `super-admin` |
| `/cooperatives/:id/members/:memberId` | DELETE | Remove a member | `cooperative-admin`, `super-admin` |
| `/cooperatives/:id/farms` | POST | Register a farm | `cooperative-admin` |
| `/cooperatives/:id/farms` | GET | List farms | `cooperative-admin`, `cooperative-member`, `inspector` |
| `/cooperatives/:id/harvests` | POST | Log a harvest | `cooperative-member` |
| `/cooperatives/:id/harvests` | GET | List harvests | `cooperative-admin`, `cooperative-member`, `super-admin` |

**Notes:**
- A `cooperative-admin` may only act on cooperatives where their `userId` matches the `adminUserId` field. Cross-cooperative access is denied.
- A `cooperative-member` may only log harvests for cooperatives they are actively enrolled in.

---

## Product Module

Base path: `/products`

| Endpoint | Method | Description | Allowed Roles |
|----------|--------|-------------|---------------|
| `/products/specifications` | GET | List SDOQ product specifications | `cooperative-admin`, `cooperative-member`, `super-admin`, `certification-body` |
| `/products/specifications/:id` | GET | Get specification detail (including lab parameters) | All authenticated roles |
| `/products/specifications` | POST | Create a product specification | `super-admin` |
| `/products/specifications/:id` | PATCH | Update a product specification | `super-admin` |
| `/products/batches` | POST | Create a batch | `cooperative-member`, `cooperative-admin` |
| `/products/batches` | GET | List batches (filtered by cooperativeId) | `cooperative-admin`, `cooperative-member`, `super-admin`, `certification-body` |
| `/products/batches/:id` | GET | Get batch detail | `cooperative-admin`, `cooperative-member`, `certification-body`, `super-admin` |
| `/products/lab-submissions` | POST | Submit a lab sample | `lab-technician`, `cooperative-admin` |
| `/products/lab-submissions/:id` | GET | Get submission status | `lab-technician`, `cooperative-admin`, `super-admin` |
| `/products/lab-submissions/:id/results` | POST | Submit lab analysis results | `lab-technician` |
| `/products/lab-submissions/:id/results` | GET | View lab results | `lab-technician`, `cooperative-admin`, `certification-body`, `super-admin` |

**Notes:**
- `lab-technician` can only submit and update results for submissions assigned to their registered lab (`labId`).
- `cooperative-member` and `cooperative-admin` can only create batches linked to their own cooperative's harvests.

---

## Certification Module

Base path: `/certifications`

| Endpoint | Method | Description | Allowed Roles |
|----------|--------|-------------|---------------|
| `/certifications` | POST | Submit a certification request | `cooperative-admin`, `cooperative-member` |
| `/certifications` | GET | List certifications | `cooperative-admin`, `certification-body`, `super-admin` |
| `/certifications/:id` | GET | Get certification detail | `cooperative-admin`, `cooperative-member`, `certification-body`, `inspector`, `super-admin` |
| `/certifications/:id/inspection` | POST | Schedule an inspection | `certification-body` |
| `/certifications/:id/inspection` | GET | Get inspection details | `certification-body`, `inspector`, `cooperative-admin`, `super-admin` |
| `/certifications/:id/inspection/report` | POST | File inspection report | `inspector` |
| `/certifications/:id/inspection/report` | GET | View inspection report | `certification-body`, `inspector`, `super-admin` |
| `/certifications/:id/decision` | POST | Issue grant/deny decision | `certification-body` |
| `/certifications/:id/revoke` | POST | Revoke a granted certification | `certification-body`, `super-admin` |
| `/certifications/:id/qrcode` | POST | Generate QR code | `certification-body`, `super-admin` |
| `/certifications/:id/qrcode` | GET | Get QR code details | `cooperative-admin`, `certification-body`, `super-admin` |
| `/certifications/:id/export-documents` | POST | Request export clearance document | `cooperative-admin` |
| `/certifications/:id/export-documents` | GET | List export documents | `cooperative-admin`, `certification-body`, `customs-agent`, `super-admin` |
| `/certifications/:id/export-documents/:docId/validate` | POST | Validate an export document | `customs-agent` |
| `/verify/:uuid` | GET | Public QR code verification | **PUBLIC — no authentication required** |

**Notes:**
- `inspector` can only file a report for inspections to which they are assigned (`inspectorUserId` must match the authenticated user).
- `cooperative-admin` may only request certification for batches belonging to their cooperative.
- The `GET /verify/:uuid` endpoint is publicly accessible and returns only the certification's public fields (certification number, product type, cooperative name, region, status, valid until). No PII is exposed.

---

## Notification Module

The notification module has **no REST API endpoints**. It is triggered exclusively by consuming Kafka events.

| Access Pattern | Details |
|----------------|---------|
| Kafka consumer | Listens on all relevant topics. Uses `service-account` Keycloak client credentials for any downstream API calls required during notification delivery. |
| REST API | None. No endpoints are exposed. |
| Direct invocation | Not permitted. Other modules must emit a Kafka event; they must not call the notification service directly via HTTP. |

---

## Role-to-Module Matrix (Summary)

| Role | Cooperative | Product | Certification | Notification | Public Verify |
|------|-------------|---------|---------------|--------------|---------------|
| `super-admin` | Full access | Full access | Full access | None | Yes |
| `cooperative-admin` | Own cooperative | Own cooperative batches | Request, view | None | Yes |
| `cooperative-member` | Harvest logging | Batch creation | Request, view | None | Yes |
| `lab-technician` | None | Lab submissions/results | View results only | None | Yes |
| `inspector` | View farms | None | File report, view | None | Yes |
| `certification-body` | View | View | Full (schedule, decide, revoke, QR) | None | Yes |
| `customs-agent` | None | None | Validate export docs | None | Yes |
| `consumer` | None | None | None | None | Yes |
| `service-account` | None | None | None | Kafka consumer | Yes |

---

## Keycloak Configuration Notes

- All roles are defined at the **realm level** (not client-level) to enable cross-client role checks.
- Role assignment is managed by `super-admin` users via the Keycloak Admin Console or Admin REST API.
- The `cooperative-admin` role is assigned manually after cooperative registration verification (Step 1 of the certification workflow).
- The `lab-technician` role includes a custom attribute `labId` (UUID) in the Keycloak user profile, which the platform reads from the JWT to enforce lab-scoped access control.
- The `inspector` role similarly includes a custom attribute `inspectorId` used to match inspection assignments.
- Token expiry: access tokens are valid for 5 minutes; refresh tokens for 8 hours. Long-running background jobs use the `service-account` client credentials grant.
