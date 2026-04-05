# Technical Debt Register

| ID | Description | Location | Impact | Plan | Sprint Added |
|----|-------------|----------|--------|------|--------------|
| TD-001 | `CertificationListener.handleLabTestCompleted` doesn't call `certificationService.updateBatchEligibility` — the method exists but is not wired to update batch eligibility state | `certification.listener.ts:~30` | Medium — batch eligibility not actually updated | Implement `updateBatchEligibility` in Sprint 2 | 1 |
| TD-002 | `SmsService` is a stub — no production SMS gateway integrated | `sms.service.ts` | High (production) | Phase 2 Moroccan SMS gateway integration | 1 |
| TD-003 | QR verification Redis cache not invalidated on certification revocation — a revoked cert may still return cached `valid: true` for up to 5 minutes | `qr-code.service.ts`, `certification.service.ts` | Medium | Sprint 2: emit `qr.cache.invalidate` event on revocation; consumer deletes Redis key | 1 |
| TD-004 | No rate limiting on `GET /verify/:uuid` — enumeration risk | `main.ts` | Medium | Sprint 2: add `@nestjs/throttler`, 100 req/s per IP | 1 |
| TD-005 | Swagger schema missing for standard error envelope on all controllers | All controllers | Low — incomplete API docs | Sprint 2: add `@ApiErrorResponse` decorator | 1 |
| TD-006 | Testcontainers image versions not pinned — `postgres:16-alpine` vs `postgres:16.2-alpine` | `test/integration/**` | Low — non-deterministic test env | Pin to `postgres:16.4-alpine`, `confluentinc/cp-kafka:7.6.0` | 1 |
| TD-007 | `notification.listener.ts` references event fields (`productName`, `labName`, `inspectorName`) that don't exist on the current event interfaces | `notification.listener.ts` | Medium — listener won't compile/run until fixed | Sprint 2: enrich events with display fields OR add a read-model lookup in the listener | 1 |
| TD-008 | No dead letter queue (DLQ) consumer implemented — failed Kafka messages are lost | All listeners | High (production) | Sprint 2: add DLQ consumer service per module | 1 |
| TD-009 | `ConfigModule` not imported in `NotificationModule` — `EmailService` and `SmsService` depend on `ConfigService` but module wiring may fail | `notification.module.ts` | High — service startup failure | Sprint 2: verify ConfigModule is global or explicitly imported | 1 |
