# Changelog

All notable changes to Terroir.ma are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Cooperative registration module with CIN/ICE/IF validators
- Certification request and decision workflow (12 steps, Law 25-06)
- Inspection scheduling and report filing
- QR code generation with HMAC-SHA256 signing for tamper-proof verification
- Export document generation for customs clearance
- Notification module — trilingual (ar-MA, fr-MA, zgh) email + SMS
- Kafka event chain: 18 events across 4 domain modules
- Keycloak integration with 9 roles
- Docker Compose multi-profile setup (core/app/monitoring/full)
- Handlebars email templates for certification-granted, lab-test-completed, inspection-scheduled
- PostgreSQL schemas: cooperative, product, certification, notification
- Morocco-specific validators: CIN, ICE, IF, phone (+212), MAD currency
- Trilingual support with RTL layout for Arabic

### Infrastructure
- Redpanda (Kafka-compatible) for event streaming
- Redis for QR verification cache (target: < 200ms)
- Mailpit as dev SMTP sink
- PostGIS 3.4 for farm GPS coordinates
- Testcontainers for integration tests
- Pino structured logging with PII redaction

## [0.1.0] — Scaffolding Sprint

- Initial project scaffolding
- Module structure: cooperative, product, certification, notification
- Docker Compose with all required services
- TypeORM configuration with 4 schemas
- Keycloak realm configuration
- CI/CD pipeline with GitHub Actions
