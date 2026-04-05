# Terroir.ma — Documentation Index

> Platform that digitizes Morocco's terroir product certification chain under Law 25-06 (SDOQ).

## Quick Links

| Need | Go to |
|------|-------|
| Set up locally | [runbooks/local-dev-setup.md](runbooks/local-dev-setup.md) |
| Understand the domain | [domain/certification-workflow.md](domain/certification-workflow.md) |
| API reference | [api/openapi-spec.yml](api/openapi-spec.yml) |
| Architecture decisions | [ADR/](ADR/) |
| Run tests | [testing/testing-strategy.md](testing/testing-strategy.md) |
| Sprint planning | [project-management/SPRINT-1-PLAN.md](project-management/SPRINT-1-PLAN.md) |
| Law 25-06 overview | [morocco/law-25-06.md](morocco/law-25-06.md) |

## Documentation Structure

```
docs/
├── ADR/                    # Architecture Decision Records (001–010)
├── api/                    # OpenAPI spec + Postman collection
├── diagrams/               # Mermaid diagrams (state machine, flows, architecture)
├── domain/                 # Domain model, certification workflow, Kafka events
├── morocco/                # Law 25-06, SDOQ products, localization, CNDP
├── project-management/     # Backlog, sprints, risk register, DoD
├── runbooks/               # Operational guides
├── testing/                # Testing strategy and conventions
├── ARCHITECTURE.md         # System architecture overview
├── CHANGELOG.md            # Version history
├── CODE_OF_CONDUCT.md      # Community guidelines
├── CONTRIBUTING.md         # How to contribute
├── PHASE-ROADMAP.md        # v1 → v2 → v3 roadmap
└── SECURITY.md             # Security policy and vulnerability reporting
```

## Core Concepts

- **Modular Monolith**: 4 NestJS domain modules (cooperative, product, certification, notification), each with its own PostgreSQL schema
- **Event-driven**: 18 Kafka events over Redpanda; modules communicate exclusively via events — never by importing each other's services
- **Certification flow**: 12 steps from cooperative registration to QR-code-signed certified product
- **Trilingual**: ar-MA (RTL), fr-MA, zgh (Tifinagh) throughout the notification layer
- **Morocco-first**: CIN/ICE/IF validators, agricultural campaign year (Oct→Sep), MAD currency, CNDP compliance

## Getting Started

```bash
# 1. Start infrastructure
docker compose --profile core up -d

# 2. Run migrations
npm run migration:run

# 3. Start API
npm run start:dev

# 4. Verify
curl http://localhost:3000/health
```

See [runbooks/local-dev-setup.md](runbooks/local-dev-setup.md) for the full guide.
