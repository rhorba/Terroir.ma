# Project Charter — Terroir.ma

## Project Overview

**Project Name**: Terroir.ma — Digital Certification Platform for Moroccan SDOQ Products
**Version**: 1.0 (v1 Passion Project)
**Date**: 2026
**Status**: Active — Sprint 1 (Scaffolding)

## Problem Statement

Morocco has 37+ recognized SDOQ (Signes Distinctifs d'Origine et de Qualité) products under Law 25-06, yet the certification process is largely paper-based. Cooperatives face delays of months, inspectors file paper reports, lab results arrive by fax, and consumers cannot verify product authenticity at the point of purchase. Counterfeit argan oil and saffron are a documented problem affecting Morocco's export reputation.

## Solution

A modular monolith NestJS platform that digitizes the 12-step certification chain:
- Cooperative registration and verification
- Harvest logging with GPS farm coordinates
- Lab test submission and result tracking
- Inspection scheduling and report filing
- Certification decision (grant/deny/revoke)
- QR-code-signed certified product labels for consumer verification
- Export document generation for customs clearance

## Goals

| Goal | Metric |
|------|--------|
| Digitize the certification chain end-to-end | 12 steps covered in v1 |
| Consumer verification speed | QR scan < 200ms p99 |
| Trilingual support | ar-MA, fr-MA, zgh notifications |
| CNDP compliance | CNDP declaration submitted before go-live |
| Test coverage | ≥ 80% unit test coverage |

## Scope

**In scope (v1)**:
- All 4 domain modules (cooperative, product, certification, notification)
- 18 Kafka events
- 9 Keycloak roles
- REST API with Swagger
- HMAC-signed QR codes
- Email notifications (Mailpit in dev)
- Docker Compose local development environment

**Out of scope (v1)**:
- Production deployment / cloud infrastructure
- Mobile app
- Prometheus/Grafana monitoring
- SMS gateway (production)
- ONSSA direct API integration
- Admin UI

## Constraints

- Single developer (passion project)
- localhost-only for v1
- PostgreSQL single instance (no replication)
- Redpanda single-node

## Assumptions

- Docker Desktop available on dev machine
- Node 20 LTS + npm 10
- Keycloak realm can be imported from JSON
- ONSSA lab results submitted via file upload (not direct API)

## Success Criteria

- `docker compose --profile full up -d && npm run start:dev` → API starts clean
- `GET /health` returns 200 with all dependencies healthy
- Full certification flow testable via Postman collection
- QR code generated and verifiable via public endpoint
- All unit tests pass with ≥ 80% coverage
