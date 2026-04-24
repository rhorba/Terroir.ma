# Product Backlog — Terroir.ma

## Overview

This backlog covers all epics and user stories for Terroir.ma v1. Stories are organized by epic and include priority, status, and story point estimates.

**Story Format:** US-{id} | As a {role}, I want to {action} so that {benefit} | Priority | Status | Points

**Status values:** Done | In Progress | Todo
**Priority values:** High | Medium | Low

> **Process note (added Sprint 7 retro):** When `/brainstorm` narrows a story's scope (e.g., read-only instead of full CRUD), update the SP estimate in this backlog at the end of the brainstorm session — before sprint commitment. This keeps velocity calculations accurate.

---

## Epic 1: Cooperative Onboarding

> Enable cooperatives to register on the platform, add members, and receive verification from super-admins.

| Story ID | User Story                                                                                                                                     | Priority | Status | Points |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ | ------ |
| US-001   | As a cooperative administrator, I want to register my cooperative on the platform so that I can begin the certification process                | High     | Done   | 5      |
| US-002   | As a super-admin, I want to create a cooperative record with validated CIN, ICE, and IF numbers so that only legitimate entities are onboarded | High     | Done   | 8      |
| US-003   | As a cooperative administrator, I want to add members to my cooperative so that harvesters can be associated with production records           | High     | Done   | 5      |
| US-004   | As a super-admin, I want to verify a cooperative's registration so that only approved cooperatives can access certification workflows          | High     | Done   | 3      |
| US-005   | As a cooperative administrator, I want to receive a notification when my cooperative is verified so that I know I can proceed                  | High     | Done   | 2      |
| US-006   | As a super-admin, I want to reject a cooperative registration with a reason so that applicants can correct and resubmit                        | Medium   | Done   | 3      |
| US-007   | As a cooperative administrator, I want to receive a rejection notification with the reason so that I can address the issues                    | Medium   | Done   | 2      |
| US-008   | As a cooperative member, I want to update my profile (phone, address, farming plot) so that my information stays current                       | Medium   | Done   | 3      |
| US-009   | As a cooperative administrator, I want to view all my cooperative members so that I can manage membership                                      | Medium   | Done   | 2      |
| US-010   | As a super-admin, I want to deactivate a cooperative so that non-compliant cooperatives lose platform access                                   | Low      | Done   | 3      |

**Epic 1 Total Points:** 36

---

## Epic 2: Product Registry

> Allow cooperatives to register agricultural products with SDOQ specifications and track harvest batches with GPS coordinates.

| Story ID | User Story                                                                                                                                                    | Priority | Status | Points |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ | ------ |
| US-011   | As a cooperative administrator, I want to register a product with its SDOQ specification so that the product is linked to its protected designation of origin | High     | Done   | 8      |
| US-012   | As a cooperative member, I want to log a harvest with GPS coordinates so that the geographic origin of each harvest is verifiable                             | High     | Done   | 5      |
| US-013   | As a cooperative administrator, I want to create a batch from one or more harvests so that products can be tracked through processing                         | High     | Done   | 5      |
| US-014   | As a cooperative administrator, I want to view the complete history of a batch so that I can trace its origin and processing steps                            | High     | Done   | 3      |
| US-015   | As a cooperative administrator, I want to search products by SDOQ type and region so that I can find relevant records quickly                                 | Medium   | Done   | 3      |
| US-016   | As a super-admin, I want to manage the list of recognized SDOQ product types so that only valid designations are registered                                   | Medium   | Done   | 5      |
| US-017   | As a cooperative administrator, I want to upload supporting documents for a product registration so that SDOQ compliance can be verified                      | Medium   | Done   | 3      |
| US-018   | As an inspector, I want to view a product's SDOQ specification so that I can verify compliance during inspection                                              | High     | Done   | 2      |
| US-019   | As a cooperative administrator, I want to record post-harvest processing steps for a batch so that the full chain of custody is documented                    | Medium   | Done   | 5      |
| US-020   | As a super-admin, I want to export product registry data so that regulatory reporting is possible                                                             | Low      | Done   | 3      |

**Epic 2 Total Points:** 42

---

## Epic 3: Lab Testing

> Integrate lab test results into the certification workflow, with ONSSA lab support and product-type-specific test parameters.

| Story ID | User Story                                                                                                                         | Priority | Status | Points |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ | ------ |
| US-021   | As a lab technician, I want to submit test results for a batch so that the certification workflow can proceed                      | High     | Done   | 8      |
| US-022   | As a lab technician, I want to see the required test parameters for a given product type so that I submit the correct data         | High     | Done   | 5      |
| US-023   | As a cooperative administrator, I want to receive a notification when lab results are available so that I can review them promptly | High     | Done   | 2      |
| US-024   | As a cooperative administrator, I want to be notified when a batch fails lab testing so that I can take corrective action          | High     | Done   | 3      |
| US-025   | As a super-admin, I want to configure test parameters by product type so that lab requirements reflect SDOQ standards              | Medium   | Done   | 1      |
| US-026   | As a lab technician, I want to upload a PDF lab report alongside structured results so that the full report is archived            | Medium   | Done   | 3      |
| US-027   | As a super-admin, I want to integrate with an ONSSA lab information system so that results are submitted electronically (Phase 2)  | Low      | Todo   | 13     |
| US-028   | As a cooperative administrator, I want to view the lab test history for all my batches so that I can track quality trends          | Medium   | Done   | 3      |
| US-029   | As an inspector, I want to view lab test results for a batch during inspection so that I have full context                         | High     | Done   | 2      |
| US-030   | As a super-admin, I want to flag a lab as accredited so that only authorized labs can submit results                               | Medium   | Done   | 3      |

**Epic 3 Total Points:** 47

---

## Epic 4: Certification Workflow

> End-to-end certification workflow from cooperative request through inspection, certification body decision, and revocation.

| Story ID | User Story                                                                                                                                      | Priority | Status | Points |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ | ------ |
| US-031   | As a cooperative administrator, I want to request certification for a batch so that I can obtain a conformity certificate                       | High     | Done   | 5      |
| US-032   | As a certification body officer, I want to schedule an inspection for a certification request so that a field visit can be arranged             | High     | Done   | 5      |
| US-033   | As an inspector, I want to file an inspection report so that the certification body has the information needed to make a decision               | High     | Done   | 8      |
| US-034   | As a certification body officer, I want to grant a certificate so that the cooperative can legally market their product                         | High     | Done   | 5      |
| US-035   | As a certification body officer, I want to deny a certification request with reasons so that the cooperative can address deficiencies           | High     | Done   | 3      |
| US-036   | As a cooperative administrator, I want to receive a notification when my certification is granted so that I can proceed to export documentation | High     | Done   | 2      |
| US-037   | As a cooperative administrator, I want to receive a notification when my certification is denied so that I can understand the reasons           | High     | Done   | 2      |
| US-038   | As a certification body officer, I want to generate a unique certification number so that each certificate is uniquely identifiable             | High     | Done   | 3      |
| US-039   | As a super-admin, I want to revoke a certificate so that non-compliant products lose their certification status                                 | High     | Done   | 5      |
| US-040   | As a cooperative administrator, I want to receive a notification when my certificate is revoked so that I can respond immediately               | High     | Done   | 2      |
| US-041   | As a super-admin, I want to view a complete audit trail for each certification so that I can satisfy regulatory inquiries                       | High     | Done   | 5      |
| US-042   | As a certification body officer, I want to view all pending certification requests so that I can manage my workload                             | Medium   | Done   | 3      |
| US-043   | As an inspector, I want to view my scheduled inspections so that I can plan field visits                                                        | Medium   | Done   | 3      |
| US-044   | As a super-admin, I want to assign inspectors to inspections so that the right expert covers the right product                                  | Medium   | Done   | 3      |
| US-045   | As a super-admin, I want to configure certification validity periods by product type so that certificates expire appropriately                  | Medium   | Done   | 3      |
| US-046   | As a cooperative administrator, I want to renew an expiring certificate so that my products remain certified                                    | Medium   | Done   | 5      |
| US-047   | As a certification body officer, I want to generate a PDF certificate so that the cooperative has a printable document                          | Medium   | Done   | 5      |
| US-048   | As a super-admin, I want to view certification statistics by region and product so that I can report to MAPMDREF                                | Medium   | Done   | 5      |
| US-049   | As a cooperative administrator, I want to view all certifications for my cooperative so that I can manage my certification portfolio            | Low      | Done   | 3      |
| US-050   | As a super-admin, I want to export a certification compliance report so that regulatory submissions are supported                               | Low      | Done   | 5      |

**Epic 4 Total Points:** 80

---

## Epic 5: QR Code & Verification

> Generate QR codes for certified batches and provide a fast, public verification endpoint for consumers and authorities.

| Story ID | User Story                                                                                                                                      | Priority | Status | Points |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ | ------ |
| US-051   | As a certification body officer, I want to generate a QR code for a granted certificate so that the product can be verified by scanning         | High     | Done   | 5      |
| US-052   | As a consumer, I want to scan a QR code and receive product verification in under 200ms so that I can quickly confirm authenticity              | High     | Done   | 8      |
| US-053   | As a customs agent, I want to verify a QR code offline so that I can confirm authenticity without internet access                               | Medium   | Todo   | 13     |
| US-054   | As a super-admin, I want QR codes to expire with the certificate so that expired certificates cannot be verified as valid                       | High     | Done   | 3      |
| US-055   | As a consumer, I want to see product details (origin, cooperative, product type) when verifying a QR code so that I have meaningful information | High     | Done   | 3      |
| US-056   | As a super-admin, I want revoked certificate QR codes to return a revoked status so that consumers are not misled                               | High     | Done   | 3      |
| US-057   | As a cooperative administrator, I want to download the QR code image for my certificate so that I can print it on packaging                     | Medium   | Done   | 3      |
| US-058   | As a super-admin, I want to track QR scan events so that I can monitor product distribution                                                     | Low      | Done   | 5      |
| US-059   | As a consumer, I want the verification page to display in Arabic, French, or Amazigh so that it is accessible to all Moroccan users             | Medium   | Done   | 5      |
| US-060   | As a super-admin, I want QR verification to use Redis caching so that repeated scans do not overload the database                               | High     | Done   | 3      |

**Epic 5 Total Points:** 51

---

## Epic 6: Export Documentation

> Support customs clearance by generating export documentation and integrating with EACCE customs agents.

| Story ID | User Story                                                                                                                              | Priority | Status | Points |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ | ------ |
| US-061   | As a cooperative administrator, I want to request export documentation for a certified batch so that I can initiate customs clearance   | High     | Done   | 5      |
| US-062   | As a customs agent (EACCE), I want to validate an export documentation request so that the shipment is cleared                          | High     | Done   | 5      |
| US-063   | As a customs agent, I want to assign the correct HS code to an export so that the shipment is correctly classified                      | High     | Done   | 3      |
| US-064   | As a cooperative administrator, I want to receive a notification when my export is cleared so that I can proceed with the shipment      | High     | Done   | 2      |
| US-065   | As a customs agent, I want to reject an export documentation request with reasons so that the cooperative can resolve issues            | Medium   | Done   | 3      |
| US-066   | As a cooperative administrator, I want to view the status of all my export documentation requests so that I can manage export logistics | Medium   | Done   | 3      |
| US-067   | As a super-admin, I want to view all export clearances so that I can report export volume to MAPMDREF                                   | Medium   | Done   | 3      |
| US-068   | As a customs agent, I want to generate a PDF export certificate so that the cooperative has documentation for the shipment              | Medium   | Done   | 5      |
| US-069   | As a cooperative administrator, I want to view HS code assignments for my exports so that I can verify customs classification           | Low      | Done   | 2      |
| US-070   | As a super-admin, I want to export a report of all export clearances by destination country so that trade statistics are available      | Low      | Done   | 3      |

**Epic 6 Total Points:** 34

---

## Epic 7: Notifications

> Deliver email and SMS notifications in Arabic, French, and Amazigh for all key workflow events.

| Story ID | User Story                                                                                                                                                     | Priority | Status | Points |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ | ------ |
| US-071   | As any platform user, I want to receive email notifications for key workflow events so that I am kept informed                                                 | High     | Done   | 5      |
| US-072   | As any platform user, I want notifications delivered in my preferred language (Arabic, French, or Amazigh) so that I understand them                           | High     | Done   | 8      |
| US-073   | As a cooperative administrator, I want to receive an SMS for critical events (certification granted, revoked, export cleared) so that I am alerted immediately | High     | Done   | 5      |
| US-074   | As a platform user, I want to view my notification history so that I can review past alerts                                                                    | Medium   | Done   | 3      |
| US-075   | As a super-admin, I want to manage notification templates so that messages can be updated without code changes                                                 | Medium   | Done   | 8      |
| US-076   | As a super-admin, I want to view failed notification counts so that I can identify delivery problems                                                           | Medium   | Done   | 3      |
| US-077   | As a platform user, I want to set my notification preferences (email, SMS, or both) so that I receive alerts on my preferred channel                           | Low      | Done   | 3      |
| US-078   | As a super-admin, I want notifications to be retried on failure so that transient errors do not cause missed alerts                                            | High     | Done   | 5      |
| US-079   | As a super-admin, I want notification events to be published to Kafka so that notification delivery is decoupled from business logic                           | High     | Done   | 3      |
| US-080   | As a super-admin, I want Handlebars templates to support RTL layout for Arabic so that notifications render correctly                                          | Medium   | Done   | 3      |

**Epic 7 Total Points:** 46

---

## Epic 8: Admin & Reporting

> Super-admin dashboard, certification analytics, and cooperative compliance reports for MAPMDREF reporting obligations.

| Story ID | User Story                                                                                                                                       | Priority | Status | Points |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------ | ------ |
| US-081   | As a super-admin, I want a dashboard showing key platform metrics so that I have an operational overview                                         | Medium   | Done   | 8      |
| US-082   | As a super-admin, I want certification analytics broken down by region and product type so that I can identify geographic trends                 | Medium   | Done   | 8      |
| US-083   | As a super-admin, I want a cooperative compliance report so that I can identify cooperatives with outstanding obligations                        | Medium   | Done   | 5      |
| US-084   | As a MAPMDREF representative, I want to export periodic certification reports so that regulatory obligations are met                             | High     | Done   | 5      |
| US-085   | As a super-admin, I want to view user activity logs so that platform usage is auditable                                                          | Medium   | Done   | 5      |
| US-086   | As a super-admin, I want to manage user roles and permissions so that access control is maintained                                               | High     | Done   | 5      |
| US-087   | As a super-admin, I want to view Kafka DLQ message counts so that I can detect processing failures                                               | Medium   | Done   | 3      |
| US-088   | As a super-admin, I want to view notification delivery rates so that communication effectiveness is monitored                                    | Medium   | Done   | 3      |
| US-089   | As a super-admin, I want to generate a report of active certifications so that ONSSA can verify compliance                                       | Medium   | Done   | 3      |
| US-090   | As a super-admin, I want to configure system settings (campaign year, product types, HS codes) so that the platform reflects current regulations | High     | Done   | 8      |

**Epic 8 Total Points:** 53

---

## Epic 9: Phase 2 — Observability & Quality

> Instrument the platform with Prometheus metrics, distributed tracing, Avro schema validation, and authenticated Playwright E2E tests.

### 9a — Prometheus + Grafana Monitoring

| Story ID | User Story                                                                                                                                                               | Priority | Status | Points |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------ | ------ |
| US-091   | As a DevOps engineer, I want a global `HttpMetricsInterceptor` that records request duration and count per route so that Prometheus has structured HTTP performance data | High     | Todo   | 5      |
| US-092   | As a DevOps engineer, I want Prometheus and Grafana added to the Docker monitoring profile so that the observability stack starts with one command                       | Medium   | Todo   | 3      |
| US-093   | As a super-admin, I want a provisioned Grafana dashboard showing request rate, P95/P99 latency, and 4xx/5xx error rate so that I can monitor API health at a glance      | Medium   | Todo   | 3      |

**9a Total Points:** 11

### 9b — Jaeger Distributed Tracing

| Story ID | User Story                                                                                                                                                               | Priority | Status | Points |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------ | ------ |
| US-094   | As a DevOps engineer, I want OpenTelemetry auto-instrumentation for HTTP, KafkaJS, and TypeORM spans so that the full certification chain is traceable end-to-end        | High     | Todo   | 8      |
| US-095   | As a DevOps engineer, I want `traceId` and `spanId` injected into every Pino log line so that logs and Jaeger traces are correlated by trace ID                          | Medium   | Todo   | 3      |
| US-096   | As a DevOps engineer, I want a Jaeger all-in-one service in the Docker monitoring profile so that distributed traces are viewable in the UI without extra infrastructure | Medium   | Todo   | 2      |

**9b Total Points:** 13

### 9c — Kafka Schema Registry + Avro

| Story ID | User Story                                                                                                                                                                                                              | Priority | Status | Points |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ | ------ |
| US-097   | As a DevOps engineer, I want all 27 Kafka events defined as Avro schemas and registered in Redpanda Schema Registry with BACKWARD compatibility so that schema evolution is enforced at the registry level              | High     | Todo   | 8      |
| US-098   | As a DevOps engineer, I want the `KafkaProducerService` to encode all messages as Avro via `SchemaRegistryService` so that every published event is schema-validated before sending                                     | High     | Todo   | 5      |
| US-099   | As a DevOps engineer, I want the `KafkaConsumerService` to decode Avro messages via `SchemaRegistryService` and integration-tested against a live Redpanda Schema Registry so that consumer deserialization is verified | High     | Todo   | 5      |

**9c Total Points:** 18

### 9d — Authenticated Playwright E2E

| Story ID | User Story                                                                                                                                                                                                                    | Priority | Status | Points |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ | ------ |
| US-100   | As a QA engineer, I want a Keycloak test realm with 8 role-specific test users and a Playwright `global-setup.ts` that authenticates each role and saves storage state so that no test needs to repeat the login flow         | High     | Todo   | 5      |
| US-101   | As a QA engineer, I want a `certification-chain.spec.ts` covering the full 12-step chain (inspector report → lab results → certification-body grant) so that end-to-end regressions across the chain are caught automatically | High     | Todo   | 8      |
| US-102   | As a QA engineer, I want authenticated E2E tests for customs-agent export document validation and super-admin cooperative management so that the two highest-stakes financial/legal flows are covered                         | High     | Todo   | 5      |
| US-103   | As a QA engineer, I want authenticated dashboard + list smoke tests for cooperative-admin, cooperative-member, inspector, and lab-technician so that all 8 staff role portals are covered by at least one authenticated test  | Medium   | Todo   | 5      |

**9d Total Points:** 23

**Epic 9 Total Points:** 65

---

## Backlog Summary

| Epic                                      | Stories | Total Points | Done   | In Progress | Todo   |
| ----------------------------------------- | ------- | ------------ | ------ | ----------- | ------ |
| Epic 1: Cooperative Onboarding            | 10      | 36           | 10     | 0           | 0      |
| Epic 2: Product Registry                  | 10      | 42           | 10     | 0           | 0      |
| Epic 3: Lab Testing                       | 10      | 47           | 9      | 0           | 1      |
| Epic 4: Certification Workflow            | 20      | 80           | 20     | 0           | 0      |
| Epic 5: QR Code & Verification            | 10      | 51           | 9      | 0           | 1      |
| Epic 6: Export Documentation              | 10      | 34           | 10     | 0           | 0      |
| Epic 7: Notifications                     | 10      | 46           | 10     | 0           | 0      |
| Epic 8: Admin & Reporting                 | 10      | 53           | 10     | 0           | 0      |
| Epic 9: Phase 2 — Observability & Quality | 13      | 65           | 0      | 0           | 13     |
| **Total**                                 | **103** | **454**      | **88** | **0**       | **15** |

> v1 deferred (2): US-027 (ONSSA lab integration, 13 SP), US-053 (QR offline verify, 13 SP) — both Phase 2 scope.
> Phase 2 todo (13): US-091 – US-103.

---

## Phase 2 Sprint Plan

Rolling average velocity (FE sprints 1–10): **12.7 SP**. Phase 2 sprints are infrastructure-heavy; estimates reflect that. Schema Registry sprint (P2-S3) is intentionally over average — 27-event migration is a single cohesive change that should not be split mid-schema.

| Sprint | Name                                 | Stories                | SP  | Goal                                                                                                                             |
| ------ | ------------------------------------ | ---------------------- | --- | -------------------------------------------------------------------------------------------------------------------------------- |
| P2-S1  | Prometheus + Grafana                 | US-091, US-092, US-093 | 11  | `/metrics` endpoint live, Grafana dashboard provisioned, monitoring profile starts with `docker compose --profile monitoring up` |
| P2-S2  | Jaeger Distributed Tracing           | US-094, US-095, US-096 | 13  | OTel auto-instrumentation active, `traceId` in every Pino log, Jaeger UI shows HTTP→Kafka→DB spans for a certification grant     |
| P2-S3  | Kafka Schema Registry + Avro         | US-097, US-098, US-099 | 18  | All 27 events migrated to Avro, Schema Registry enforces BACKWARD compat, integration test proves round-trip encode/decode       |
| P2-S4  | E2E Auth Setup + Certification Chain | US-100, US-101         | 13  | Keycloak test realm seeded, 8 role auth states stored, full 12-step certification chain passes in CI                             |
| P2-S5  | E2E Critical Paths + Role Smokes     | US-102, US-103         | 10  | Customs-agent + super-admin critical paths covered, all 8 staff role portals have at least one authenticated test                |

**Phase 2 Total:** 5 sprints · 65 SP · 13 stories
