---
name: pmp-project-management
description: PMP-inspired project management for Terroir.ma. Project charter, WBS, risk management, stakeholder analysis, communication plan — adapted for solo development with Claude Code as Scrum Master.
---

# PMP Project Management — Terroir.ma

## Project Charter Summary
- **Project:** Terroir.ma
- **Purpose:** Digitize Morocco's terroir product certification chain under Law 25-06 (SDOQ)
- **Developer:** Solo + Claude Code (AI pair programmer)
- **Scope In:** Modular monolith, 4 domain modules, Kafka events, Keycloak auth, QR verification, localhost
- **Scope Out:** Monetization, mobile apps (v1), cloud deployment, blockchain
- **Success Criteria:**
  - Full certification chain event flow working
  - 80%+ test coverage
  - CI/CD pipeline passing
  - QR verification < 200ms (via Redis)
  - Docker Compose starts all 8 containers in < 2 minutes

## WBS (Work Breakdown Structure)
```
1.0 Terroir.ma v1
├── 1.1 Project Management
│   ├── 1.1.1 Charter + WBS
│   ├── 1.1.2 Risk Register
│   └── 1.1.3 Sprint Planning
├── 1.2 Infrastructure
│   ├── 1.2.1 Docker Compose (8 containers)
│   ├── 1.2.2 Redpanda topic setup
│   ├── 1.2.3 Keycloak realm configuration
│   └── 1.2.4 CI/CD pipeline
├── 1.3 NestJS Application
│   ├── 1.3.1 App skeleton + common layer
│   ├── 1.3.2 Cooperative module
│   ├── 1.3.3 Product module
│   ├── 1.3.4 Certification module
│   └── 1.3.5 Notification module
├── 1.4 Testing
│   ├── 1.4.1 Unit tests (80% coverage)
│   ├── 1.4.2 Integration tests (Testcontainers)
│   └── 1.4.3 E2E tests (full chain)
└── 1.5 Documentation
    ├── 1.5.1 Architecture docs
    ├── 1.5.2 Domain docs
    └── 1.5.3 Runbooks
```

## Risk Categories
1. **Technical Risks:** Module coupling, JSONB validation, PostGIS performance
2. **Scope Risks:** Feature creep into Phase 2/3
3. **Security Risks:** QR forgery, Keycloak misconfiguration
4. **Process Risks:** Session state loss, broken CI/CD

## Change Control
All scope changes require:
1. Document the change in a design.md
2. Update PRODUCT-BACKLOG.md (add story, estimate points)
3. Update RISK-REGISTER.md if new risks introduced
4. Only implement after /brainstorm → /plan → /execute workflow

## Monitoring & Control
- Daily: /daily-standup (session log review)
- Per sprint: /sprint-status (velocity, blockers)
- Per feature: progress.md in docs/plans/
- Per session: /save-session (state preservation)
