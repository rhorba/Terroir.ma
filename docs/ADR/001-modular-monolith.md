# ADR-001: Adopt Modular Monolith over Microservices for v1

Date: 2026-03-30

## Status

Accepted

## Context

The v1 team consists of 3 developers. The platform has a single deployment target and the primary challenge is iterating quickly on domain logic rather than scaling to massive traffic. Microservices would introduce significant operational overhead that is not justified at this stage:

- Distributed tracing and observability tooling (Jaeger, OpenTelemetry collector)
- Service mesh or API gateway for inter-service communication
- Per-service CI/CD pipelines and container registries
- Inter-service authentication (mTLS or service tokens)
- Network latency and partial failure handling between services

None of these costs buy meaningful benefit when all services would be deployed to the same infrastructure and accessed by the same team.

## Decision

Build a single NestJS application structured as a modular monolith with 4 domain modules:

1. **cooperative** — manages cooperatives, members, and federation relationships
2. **product** — manages product definitions, batches, and traceability records
3. **certification** — manages certification workflows, inspections, and decisions
4. **notification** — manages outbound notifications (email, SMS, push)

**Module boundary rules:**

- Modules communicate exclusively via Kafka events. A module never imports another module's services, repositories, or entities.
- Each module owns its own PostgreSQL schema (see ADR-004).
- Cross-module data needs are satisfied by each module maintaining its own read copy, kept in sync via Kafka event consumers.
- NestJS barrel imports across module boundaries are prohibited; enforced via ESLint `no-restricted-imports` rules and code review.

**Phase 3 extraction path:** Because modules are already decoupled at the communication layer (Kafka) and the data layer (separate schemas), extracting any module into a standalone microservice requires only moving the module's code, pointing its consumer/producer at the same Kafka cluster, and provisioning a dedicated database.

## Consequences

**Positive:**
- Single deployment artifact; dramatically simpler CI/CD for v1.
- Shared memory space allows synchronous in-process testing without network stubs.
- All domain logic visible in one repository; easier onboarding and refactoring.
- Enforced Kafka boundary means the extraction path to microservices remains open.

**Negative / Risks:**
- Shared process introduces noisy-neighbor risk: a CPU-intensive operation in one module (e.g., bulk QR code generation) can affect latency in others. Mitigation: NestJS worker threads for heavy tasks in Phase 2.
- A single crash takes down all modules simultaneously. Mitigation: robust error handling, circuit breakers, and health checks.
- Module boundary discipline depends on team adherence and tooling — it is not enforced by the runtime.
