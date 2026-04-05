# Terroir.ma — Phase Roadmap

## Vision

Terroir.ma is a phased certification management platform for Morocco's geographical indication (GI) products. Each phase builds on the previous, maintaining backward compatibility and architectural integrity.

---

## Phase 1 — Foundation: Modular Monolith (Current)

**Status:** In Progress
**Target completion:** Sprint 6 (approx. 2026-06-01)
**Scope:** Localhost only — a complete, tested, working system for one developer

### What Gets Built

**Infrastructure (8 Docker containers)**

| Container | Purpose | Status |
|-----------|---------|--------|
| NestJS app | API server (Port 3000) | In progress |
| PostgreSQL 16 + PostGIS | Primary database (Port 5432) | Done |
| Redis 7 | Cache + rate limiting (Port 6379) | Done |
| Redpanda | Kafka-compatible broker (Port 9092) | Done |
| Redpanda Console | Topic browser (Port 8080) | Done |
| Keycloak 24 | Identity provider (Port 8443) | Done |
| Mailpit | Email dev trap (Port 8025) | Done |
| Schema Registry | (Built into Redpanda, Port 8081) | Done |

**Application (4 Domain Modules)**

| Module | Entities | Events Produced |
|--------|----------|-----------------|
| Cooperative | Cooperative, Member, Farm | 3 events |
| Product | ProductType, Harvest, Batch, LabTest, LabTestResult | 5 events |
| Certification | Certification, Inspection, InspectionReport, QrCode, ExportDocument | 8 events |
| Notification | Notification, NotificationTemplate | 2 events |

**Domain Features**
- Cooperative registration with CIN/ICE/IF validation
- Product type declaration with SDOQ category (IGP/AOP/Label Agricole)
- Harvest logging with GPS farm coordinates (PostGIS)
- Production batch tracking with batch numbers
- Lab test ordering and result submission with JSONB parameters
- Full 12-step certification chain
- Inspection scheduling and reporting
- HMAC-SHA256 QR code generation and public verification
- Export document issuance
- Trilingual notifications: Arabic, French, Amazigh (Tifinagh)
- Morocco-specific validators: CIN, ICE, IF, phone (+212), MAD currency

**Authentication**
- Keycloak realm with 9 roles: `cooperative-admin`, `lab-technician`, `inspector`, `certification-body`, `customs-agent`, `consumer`, `super-admin`, `cooperative-member`, `service-account`
- JWT-based API authentication via passport-jwt
- Role-based access control on every protected endpoint

**Testing (Three Levels)**

| Level | Tool | Target | What It Tests |
|-------|------|--------|---------------|
| Unit | Jest + ts-jest | 80% coverage | Business logic, validators, HMAC signing |
| Integration | Testcontainers | Key flows | Real PostgreSQL queries, Kafka event flow |
| E2E | Supertest + docker-compose.test.yml | Full chain | HTTP request → event → response |

**CI/CD**
- GitHub Actions pipeline: lint → build → unit tests → integration tests → E2E tests
- TypeScript strict mode, ESLint zero warnings
- Conventional Commits enforced via commitlint

**QR Verification**
- `GET /api/v1/verify/:uuid` — public endpoint, no authentication
- HMAC-SHA256 signature verification
- Redis cache for sub-200ms response
- Rate limited: 1000 requests per 15 minutes per IP

### Phase 1 Success Criteria

- [ ] All 12 certification chain steps work end-to-end via HTTP
- [ ] QR verification endpoint responds in under 200ms (Redis cache hit)
- [ ] 80% unit test coverage across all 4 modules
- [ ] Integration tests pass with real PostgreSQL + Redpanda via Testcontainers
- [ ] E2E test covers the full certification chain in one test suite
- [ ] CI/CD pipeline passes on every push
- [ ] All 18 Kafka events have TypeScript interfaces
- [ ] All Morocco-specific validators tested (CIN, ICE, IF, +212)
- [ ] Trilingual notification templates render correctly (AR/FR/ZGH)
- [ ] `docker compose up` starts all 8 containers healthy within 2 minutes

---

## Phase 2 — Observability + Hardening

**Prerequisite:** Phase 1 complete (all Phase 1 success criteria met)
**Estimated effort:** 4–6 sprints after Phase 1
**Goal:** Production-ready quality for a single-server deployment

### Observability Stack

**Prometheus + Grafana**
- Add `prom-client` to NestJS app
- Instrument all HTTP endpoints: request rate, latency (p50/p90/p99), error rate
- PostgreSQL metrics via `postgres_exporter`
- Redis metrics via `redis_exporter`
- Redpanda metrics via built-in Prometheus endpoint
- Grafana dashboards for: certification chain throughput, QR scan rate, Kafka consumer lag, PostgreSQL query times, Keycloak auth success/failure rate

**Jaeger Distributed Tracing**
- Add OpenTelemetry SDK to NestJS
- Trace every incoming HTTP request through: JWT validation → controller → service → repository → Kafka publish
- Trace Kafka consumer: consume → process → DB write → produce (if applicable)
- Identify slow queries and event processing bottlenecks
- Prerequisite for Phase 3 (microservices require distributed tracing by definition)

### Schema Hardening

**Avro Schemas + Schema Registry**
- Replace JSON event serialization with Avro
- Define `.avsc` schema files for all 18 events
- Register schemas in Redpanda's built-in Schema Registry (Port 8081)
- TypeScript types generated from Avro schemas (no manual sync)
- Schema evolution rules enforced: backward-compatible changes only
- Full/transitive compatibility checked in CI

### Performance Testing

**k6 Load Testing**
- Baseline performance test: 100 concurrent users, 5 minutes
- Test scenarios: QR verification surge (1000 req/min), certification request flow, Kafka event throughput
- SLO definitions: QR verify p99 < 500ms, certification request p99 < 1s
- Regression tests: new code must not exceed SLO thresholds

### Security Hardening

**OWASP ZAP Automated Security Scanning**
- ZAP baseline scan in CI pipeline on every release branch
- Custom rules for Moroccan ID format injection
- CORS policy validation
- CSP header validation
- JWT manipulation tests

**Additional Security Measures**
- HMAC secret rotation procedure and runbook
- Keycloak brute force protection tuning
- PostgreSQL row-level security (RLS) experiments
- CNDP audit log completeness review
- Penetration test of QR verification endpoint

### Phase 2 Deliverables

- Prometheus + Grafana stack (2 new Docker containers)
- Jaeger tracing container + OTel instrumentation
- Avro schemas for all 18 events with Schema Registry
- k6 test suite with SLO thresholds
- OWASP ZAP integration in CI
- HMAC rotation runbook
- Updated CNDP compliance documentation

---

## Phase 3 — Scale: Microservices + Kubernetes

**Prerequisite:** Phase 2 complete (Jaeger tracing in place — required for microservice debugging)
**Estimated effort:** 6–12 months
**Goal:** Cloud-deployed, horizontally scalable, multi-tenant

### Microservice Extraction

**Strategy: One Module at a Time (Strangler Fig Pattern)**

The modular monolith's strict isolation means each extraction is independent. Order:

1. **NotificationModule** first — no upstream dependencies, easy to extract
2. **CooperativeModule** second — produces events consumed by others, but reads nothing
3. **ProductModule** third — depends on cooperative events (read-model only)
4. **CertificationModule** last — most complex, depends on all others' events

**Per-Module Extraction Checklist**
- [ ] Create new NestJS app from module directory
- [ ] Migrate PostgreSQL schema to new database
- [ ] Update Kafka consumer group IDs
- [ ] Write Kubernetes Deployment + Service YAML
- [ ] Write Helm chart with configurable replicas, resources, environment
- [ ] Write Pact consumer/provider contract tests
- [ ] Deploy behind ingress with same URL path
- [ ] Remove module from monolith
- [ ] Verify E2E tests still pass (they test HTTP, not deployment topology)

### Kubernetes Orchestration

**Helm Charts**
- One Helm chart per microservice
- Shared `terroir-common` chart for: PostgreSQL, Redis, Redpanda, Keycloak
- `values.yaml` for dev / staging / production environments
- HorizontalPodAutoscaler for certification and notification services

**Kubernetes Resources per Service**
- `Deployment` with health checks (liveness: `/health`, readiness: `/ready`)
- `Service` (ClusterIP)
- `Ingress` (nginx) for external routing
- `ConfigMap` for non-secret configuration
- `ExternalSecret` (ESO) referencing AWS Secrets Manager or GCP Secret Manager
- `HPA` for auto-scaling

### Cloud Deployment

**Option A: AWS ECS (Fargate)**
- Managed container runtime, no Kubernetes cluster to maintain
- RDS PostgreSQL with PostGIS extension
- ElastiCache Redis
- MSK (Amazon Managed Kafka) replacing Redpanda
- Cognito potentially replacing Keycloak (with careful evaluation)
- ECR for container image registry

**Option B: GCP Cloud Run**
- Serverless container execution, pay-per-request
- Cloud SQL (PostgreSQL) with PostGIS
- Memorystore (Redis)
- Pub/Sub or Confluent Cloud replacing Redpanda
- Firebase Auth potentially replacing Keycloak
- Artifact Registry for container images

**Decision criteria for Option A vs B:** Driven by cost analysis at actual load, team GCP/AWS familiarity, and partnership opportunities with Moroccan cloud providers.

### Mobile Applications

**React Native (Expo)**

Two apps:

| App | Users | Key Features |
|-----|-------|-------------|
| Inspector App | inspector, certification-body | Inspection checklists, photo upload, offline GPS, report filing |
| Consumer App | consumer | QR code scanning, product origin story, lab test results display |

- Offline-first architecture (SQLite sync)
- Arabic/French/Amazigh RTL support
- GPS coordinate collection for farm mapping
- Camera integration for QR scanning and inspection photos
- Push notifications via FCM/APNs

### Contract Testing

**Pact**
- Each microservice pair has Pact consumer/provider contracts
- Pact Broker hosted on PactFlow or self-hosted
- Contract tests run in CI before deployment
- Prevents microservice API incompatibilities

### Chaos Engineering

**Chaos Monkey / LitmusChaos**
- Kill NotificationModule pod → verify certification chain continues
- Introduce Kafka consumer lag → verify dead letter queue activates
- Simulate PostgreSQL connection saturation → verify circuit breaker kicks in
- Redis eviction → verify QR verification still works (just slower)
- Keycloak outage → verify graceful degradation (public endpoints still work)

### Phase 3 Deliverables

- 4 independent microservice repositories (or Nx monorepo)
- 4 PostgreSQL databases (migrated from schemas)
- Helm charts for each service + infrastructure
- Cloud deployment (ECS or Cloud Run)
- React Native Inspector App (v1: inspection filing)
- React Native Consumer App (v1: QR scanning)
- Pact contract test suite
- Chaos engineering runbook

---

## Timeline Summary

```
2026 Q1-Q2  │ Phase 1: Modular Monolith (in progress)
             │   Sprint 1: Scaffold + infrastructure
             │   Sprint 2: Cooperative module
             │   Sprint 3: Product module
             │   Sprint 4: Certification module
             │   Sprint 5: Notification module + QR
             │   Sprint 6: E2E tests + CI/CD
             │
2026 Q3-Q4  │ Phase 2: Observability + Hardening
             │   Prometheus/Grafana, Jaeger, Avro, k6, ZAP
             │
2027 Q1+    │ Phase 3: Microservices + Cloud
             │   Extract modules, K8s, cloud deploy, mobile
```

---

*Document version: 1.0 — Phase 1*
*Last updated: 2026-03-28*
