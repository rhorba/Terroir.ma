---
name: modular-monolith-patterns
description: How to build and maintain modules in Terroir.ma's NestJS modular monolith. Module isolation rules, hexagonal architecture, PostgreSQL schema-per-module, inter-module communication via Kafka, and the Phase 3 microservice extraction path.
---

# Modular Monolith Patterns — Terroir.ma

## Module Isolation Rules (CRITICAL)
1. A module MUST NOT import another module's services, repositories, or entities.
2. A module MUST NOT query another module's PostgreSQL schema.
3. Inter-module communication: ONLY via Kafka events.
4. Shared code goes in `src/common/` — not in any module.
5. Static data goes in `shared/constants/` — importable by all.

## ESLint Enforcement
The ESLint config includes a rule that BLOCKS imports from `src/modules/A/` inside `src/modules/B/`. CI will fail if violated.

## Standard Module Structure
```
src/modules/<module-name>/
├── <module-name>.module.ts      # NestJS module definition
├── controllers/                 # HTTP layer
│   └── <module-name>.controller.ts
├── services/                    # Business logic
│   └── <module-name>.service.ts
├── entities/                    # TypeORM entities (schema: <module-name>)
│   └── <module-name>.entity.ts
├── dto/                         # class-validator DTOs
│   ├── create-<module-name>.dto.ts
│   └── update-<module-name>.dto.ts
├── events/                      # Kafka producers
│   ├── <module-name>-events.ts  # TypeScript interfaces
│   └── <module-name>.producer.ts
└── listeners/                   # Kafka consumers
    └── <module-name>.listener.ts
```

## Hexagonal Architecture Within Each Module
```
HTTP Request → Controller (validates DTO, calls service)
            → Service (business logic, calls repository)
            → Repository (TypeORM, queries PostgreSQL schema)
            → Kafka Producer (publishes events on state changes)
Kafka Event → Listener (subscribes, calls service)
```

## PostgreSQL Schema-Per-Module
Each module has its own schema. Entities use the schema prefix:
```typescript
@Entity({ schema: 'cooperative', name: 'cooperative' })
export class Cooperative { ... }
```
No cross-schema foreign keys. If module B needs data from module A, it:
1. Listens to module A's Kafka events and stores a local copy (read model).
2. Calls module A's REST API (internal HTTP, via HTTP module).

## NestJS Module Registration
```typescript
// app.module.ts
@Module({
  imports: [
    CooperativeModule,
    ProductModule,
    CertificationModule,
    NotificationModule,
    // Never import modules from within a module
  ],
})
export class AppModule {}
```

## Inter-Module Communication Pattern
```typescript
// In cooperative.service.ts — publish event
await this.cooperativeProducer.publish({
  eventId: uuidv4(),
  correlationId: context.correlationId,
  timestamp: new Date().toISOString(),
  version: 1,
  source: 'cooperative',
  cooperativeId: cooperative.id,
  cooperativeName: cooperative.name,
});

// In notification.listener.ts — consume event
@EventPattern('cooperative.registration.verified')
async handleCooperativeVerified(data: CooperativeVerifiedEvent) {
  await this.notificationService.sendWelcomeEmail(data);
}
```

## Phase 3 Extraction Path
When extracting a module to a microservice:
1. The module.ts becomes a standalone NestJS app (main.ts).
2. The PostgreSQL schema becomes a separate database.
3. Kafka events stay the same — zero changes to event contracts.
4. REST API stays the same — update API gateway URLs only.
5. Auth: Keycloak client credentials for service-to-service.
What changes: deployment only. Business logic untouched.

## Standard Response Envelope
```typescript
interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string; details?: unknown } | null;
  meta: { page?: number; limit?: number; total?: number };
}
```
