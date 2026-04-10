# Sprint 1 Log — Infrastructure Scaffold Sprint

**Dates:** 2026-03-28 → 2026-04-11
**Status:** COMPLETE ✓

## Goal
Complete full project scaffold: infrastructure, .claude/, src/ skeleton, docs, tests, shared constants.

## Outcome
**Sprint 1 closed with all acceptance criteria met:**
- Zero TypeScript errors (`npm run typecheck`)
- 85 tests passing across unit / integration / e2e tiers
- Full NestJS modular monolith scaffold: 4 domain modules, entities, controllers, services, events
- Docker Compose infrastructure (Postgres/PostGIS, Redpanda, Keycloak, Redis, Mailpit)
- Kafka event definitions for all 18 domain events
- 3-level test pyramid operational

## Velocity
All sprint stories delivered. No carry-over to Sprint 2.

## Key Technical Decisions
| Decision | Rationale |
|---|---|
| `KafkaClientModule` @Global | Provides KAFKA_CLIENT token once, available everywhere |
| `TestJwtStrategy` (passport-custom) | Bypasses Keycloak in e2e without breaking production JWT guard |
| E2E DB self-init | `createTestApp()` creates schemas + synchronizes tables automatically |
| `type: 'varchar'` on nullable strings | reflect-metadata emits `Object` for `string \| null` without explicit type |
| `testTimeout` at root config | Jest doesn't support it inside `projects[]` array |

## Blockers Encountered & Resolved
1. **`DataTypeNotSupportedError: Object`** → Added `type: 'varchar'` to all nullable string columns
2. **Schema doesn't exist in Testcontainers** → Extract schemas from entity metadata, CREATE before synchronize
3. **`Unknown authentication strategy "jwt"` in e2e** → TestJwtStrategy registered under `'jwt'` name
4. **KAFKA_CLIENT unresolvable in e2e** → Global KafkaClientModule + override in test helper
5. **QR verify returning 500 in e2e** → E2E DB self-init; controller throws NotFoundException/ForbiddenException

## Sprint 2 Preview
- Implement 12-step certification chain business logic
- Redis caching on QR verification (target: < 200ms)
- Coverage report baseline
