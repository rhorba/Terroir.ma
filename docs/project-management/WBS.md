# Work Breakdown Structure (WBS)

## 1.0 Infrastructure & DevOps

- 1.1 Docker Compose (core profile — postgres, redis, redpanda, keycloak, mailpit)
- 1.2 Docker Compose (app + monitoring profiles)
- 1.3 Dockerfile (multi-stage NestJS build)
- 1.4 GitHub Actions CI (lint → unit → integration)
- 1.5 GitHub Actions CD (build → push image → deploy)
- 1.6 Keycloak realm configuration (9 roles, 5 clients)
- 1.7 PostgreSQL init script (4 schemas, PostGIS, extensions)
- 1.8 Redpanda topic creation (18 topics + DLQ variants)
- 1.9 Makefile shortcuts

## 2.0 Core Framework

- 2.1 NestJS app bootstrap (main.ts, app.module.ts)
- 2.2 Configuration modules (app, database, kafka, keycloak, redis)
- 2.3 Common decorators (current-user, roles, api-response)
- 2.4 Common guards (jwt-auth, roles)
- 2.5 Common filters (http-exception)
- 2.6 Common interceptors (response envelope, logging, correlation-id)
- 2.7 Morocco validators (CIN, ICE, IF, phone, MAD)
- 2.8 Pino logger with PII redaction
- 2.9 Health endpoint (/health, /ready)
- 2.10 Swagger / OpenAPI setup

## 3.0 Cooperative Module

- 3.1 Entities (Cooperative, Member, Farm)
- 3.2 Service (CRUD, verification workflow)
- 3.3 Controller (REST endpoints)
- 3.4 DTOs (create, update, add-member, map-farm)
- 3.5 Kafka producer (registration events)
- 3.6 Kafka listener (consumes: cooperative.registration.verified)
- 3.7 TypeORM migration

## 4.0 Product Module

- 4.1 Entities (Product, ProductType, Harvest, ProductionBatch, LabTest, LabTestResult)
- 4.2 Services (product, harvest, batch, lab-test)
- 4.3 Controllers (product, harvest, batch, lab-test)
- 4.4 DTOs (create-product, log-harvest, create-batch, submit-lab-test)
- 4.5 Lab parameter validation per product type
- 4.6 Kafka producer (batch.created, lab.test.completed)
- 4.7 Kafka listener
- 4.8 TypeORM migration

## 5.0 Certification Module

- 5.1 Entities (Certification, Inspection, InspectionReport, QrCode, ExportDocument)
- 5.2 Certification service (12-step state machine)
- 5.3 Inspection service + QR code service + export document service
- 5.4 Controllers (certification, inspection, qr-code, export-document)
- 5.5 DTOs (request, schedule, report, grant, deny, revoke, export)
- 5.6 Certification number generator (TERROIR-{type}-{region}-{year}-{seq})
- 5.7 HMAC-SHA256 QR signing + Redis cache
- 5.8 Kafka producer (all certification events)
- 5.9 Kafka listener (lab.test.completed, cooperative.registration.verified)
- 5.10 TypeORM migration

## 6.0 Notification Module

- 6.1 Entities (Notification, NotificationTemplate)
- 6.2 Notification service (Handlebars rendering, channel dispatch)
- 6.3 Email service (Nodemailer + Mailpit)
- 6.4 SMS service (stub for v1)
- 6.5 Handlebars templates (7 files — ar-MA, fr-MA, zgh)
- 6.6 Kafka listener (certification.decision.granted, lab.test.completed, inspection.scheduled)
- 6.7 TypeORM migration

## 7.0 Testing

- 7.1 Jest configuration (3 projects: unit, integration, e2e)
- 7.2 Test factories (9 factory files)
- 7.3 Test fixtures (JSON + TS fixtures)
- 7.4 Test helpers (database, app, auth, seed)
- 7.5 Unit tests (10 spec files — 80% coverage gate)
- 7.6 Integration tests (5 files + Testcontainers setup)
- 7.7 E2E tests (3 files + docker-compose.test.yml)

## 8.0 Documentation

- 8.1 ADRs (10 decisions)
- 8.2 Domain documentation (5 files)
- 8.3 Morocco regulatory documentation (4 files)
- 8.4 API documentation (OpenAPI + Postman)
- 8.5 Testing documentation (3 files)
- 8.6 Project management documentation (10 files)
- 8.7 Runbooks (4 files + troubleshooting)
- 8.8 Architecture diagrams (6 Mermaid files)
- 8.9 Claude Code skills + commands (15 + 20 files)
- 8.10 Session persistence (.sessions/ protocol)
