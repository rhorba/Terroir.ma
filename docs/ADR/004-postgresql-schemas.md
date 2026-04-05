# ADR-004: Use Separate PostgreSQL Schemas per Domain Module

Date: 2026-03-30

## Status

Accepted

## Context

ADR-001 establishes that each domain module must own its data exclusively, mirroring the per-service database boundary that microservices would enforce. Options considered:

1. **Single shared schema:** Simplest setup, but allows cross-module JOINs and foreign keys that create tight coupling and make future service extraction painful.
2. **Separate databases per module:** Strong isolation, but requires multiple connection pools and complicates local development. Premature for v1.
3. **Separate PostgreSQL schemas within one database:** Provides logical isolation and ownership boundaries without the operational complexity of multiple databases. Cross-schema queries are possible in SQL but can be prohibited by convention and review.

Option 3 was chosen as the right balance for v1.

## Decision

Each domain module owns exactly one PostgreSQL schema. Cross-schema foreign keys are prohibited.

| Module | Schema name |
|---|---|
| cooperative | `cooperative` |
| product | `product` |
| certification | `certification` |
| notification | `notification` |

**TypeORM configuration:** Each module's TypeORM entities declare `schema: '<module>'` on their `@Entity()` decorator. Each module's data source (or the shared data source with module-scoped entity registration) references only its own entities. No module's repository or query builder references another module's schema.

**Cross-module data:** When module A needs data owned by module B, module A maintains its own read copy. For example, the `certification` schema stores a `cooperative_name` column that is populated and kept current via a Kafka consumer listening to `cooperative.cooperative.updated` events. This is an intentional denormalization.

**Prohibition enforcement:**
- ESLint rule forbids importing entities from other modules.
- Code review checklist includes a cross-schema JOIN check.
- Phase 2: pg-readonly role per schema prevents runtime cross-schema reads at the database level.

**Migrations:** Each module has its own migrations directory: `src/<module>/migrations/`. Migration files are namespaced by schema to prevent conflicts.

## Consequences

**Positive:**
- Module data ownership is explicit and auditable.
- Phase 3 extraction to separate databases requires only changing the connection string per module — no schema refactoring.
- Accidental cross-module coupling via shared ORM queries is prevented by code review and import rules.

**Negative / Risks:**
- **No cross-schema JOINs:** Reporting queries that span multiple domains (e.g., "list all certified products with their cooperative name") must be assembled at the application layer or via a dedicated read model / reporting schema (Phase 2).
- **Data denormalization:** Cooperative names, product names, and similar reference data are stored redundantly in consuming schemas. These copies can lag behind the source of truth by the Kafka consumer lag window.
- Developers must be disciplined about not reaching for a quick SQL JOIN across schemas. This requires onboarding education.
