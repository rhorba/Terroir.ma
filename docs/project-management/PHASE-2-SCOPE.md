# Phase 2 Scope

Items explicitly deferred from v1 (Sprint 1–2) to Phase 2.

## Observability
- **Prometheus + Grafana**: metrics for certification rate, notification delivery, QR scan volume, Kafka consumer lag
- **Jaeger distributed tracing**: correlation ID propagation across all service calls, trace visualization
- **Loki log aggregation**: structured Pino JSON logs → Loki → Grafana

## Kafka Schema Registry
- Confluent Schema Registry (or Redpanda's built-in) + **Avro schemas** for all 18 events
- Schema evolution: backward-compatible changes only; breaking changes require new topic + migration period
- Consumer-driven contract tests with **Pact**

## SMS Gateway (Production)
- Integration with a Moroccan SMS provider (e.g., Bulk SMS MA, OVH SMS, or InfiSMS)
- Required env vars: `SMS_GATEWAY_URL`, `SMS_API_KEY`, `SMS_SENDER_ID`
- Activate `SmsService` for critical events (certification granted, inspection scheduled)

## High-Availability Infrastructure
- **Keycloak cluster**: 3-node HA with shared PostgreSQL backend
- **Redpanda cluster**: 3 brokers, replication factor 3, min ISR 2
- **PostgreSQL**: primary + 2 read replicas with pgBouncer connection pooler
- **Redis Sentinel**: 3-node sentinel setup for cache HA

## Security Hardening
- **HashiCorp Vault**: `QR_HMAC_SECRET`, `KEYCLOAK_CLIENT_SECRET`, database credentials
- **OWASP ZAP** automated scanning in CI on every merge to main
- **mTLS** between NestJS and PostgreSQL/Redis in production
- Rate limiting: `@nestjs/throttler` on `/verify/:uuid` (100 req/s) and `/certifications/request` (10 req/min per cooperative)

## Performance
- **k6 load tests**: `GET /verify/:uuid` target 1000 RPS < 200ms p99
- **TypeORM query analysis**: slow query log > 100ms, index optimization
- **HTTP/2** for API endpoints

## Admin Features
- **Notification template management UI**: allow non-developers to update Handlebars templates
- **Cooperative dashboard**: certification pipeline overview, expiry alerts
- **Super-admin reporting**: certifications by region/product/type, cooperative compliance rates

## Integrations
- **ONSSA lab information system**: direct API integration to replace file-upload interim solution
- **EACCE export portal**: automated export document submission
- **Mobile PWA**: QR scanner for consumers with offline verification support
