# ADR-002: Use Kafka (Redpanda) for Inter-Module Events

Date: 2026-03-30

## Status

Accepted

## Context

ADR-001 mandates that domain modules must not call each other's services directly. An event bus is therefore required as the sole inter-module communication channel. The event bus must satisfy:

- **Reliability:** Events must not be lost if a consumer is temporarily unavailable.
- **Ordering:** Events within a single entity's lifecycle must be delivered in order (e.g., certification.decision.pending before certification.decision.granted).
- **Replayability:** New consumers or consumer restarts must be able to replay events from a known offset.
- **Fan-out:** A single event (e.g., `certification.decision.granted`) must be independently consumable by multiple modules (notification, product, audit) without coupling.

A simple in-process event emitter (Node.js `EventEmitter`) does not satisfy reliability or replayability. RabbitMQ satisfies fan-out but lacks log-based replayability by default. Kafka satisfies all requirements.

## Decision

Use **Redpanda** as the event broker. Redpanda is Kafka-protocol-compatible and runs as a single binary with no ZooKeeper dependency, significantly reducing operational complexity for dev and staging environments.

**Topic naming convention:** `<module>.<entity>.<action>`

Examples:
- `certification.decision.granted`
- `cooperative.member.created`
- `product.batch.submitted`

**Standard event envelope** (all events must include):

```json
{
  "eventId": "<uuid-v4>",
  "correlationId": "<uuid-v4>",
  "version": 1,
  "timestamp": "<ISO-8601-UTC>",
  "payload": { }
}
```

- `eventId`: globally unique; used by consumers for idempotency checks (stored in a `processed_events` table per consumer module).
- `correlationId`: propagated from the originating HTTP request or Kafka event to link all downstream events in a workflow.
- `version`: integer; enables consumers to handle schema evolution.

**Dead letter topics:** Failed messages (after 3 retry attempts with exponential backoff) are written to `<topic>.dlq`. An alert is triggered when any DLQ receives a message.

**Consumer group naming:** `<consuming-module>.<topic>` (e.g., `notification.certification.decision.granted`).

## Consequences

**Positive:**
- Modules are fully decoupled at the communication layer; extraction to microservices requires no change to event contracts.
- Replayability enables event sourcing patterns and audit log reconstruction.
- Redpanda removes ZooKeeper, reducing dev environment resource requirements and operational surface.
- Fan-out is native to Kafka's consumer group model.

**Negative / Risks:**
- **Eventual consistency:** Consumers will lag behind producers by milliseconds to seconds. UIs that immediately display the result of a cross-module action must account for this (e.g., polling or optimistic updates).
- **Out-of-order delivery:** Network partitions or consumer restarts can cause redelivery of older messages. Consumers must be idempotent (eventId check) and tolerate reordering within acceptable bounds.
- Debugging event-driven flows requires correlation ID propagation discipline and a log aggregation setup.

**Phase 2:** Add Confluent Schema Registry (compatible with Redpanda) and Avro schemas for all event types. This enforces schema evolution contracts and prevents breaking changes from being deployed silently.
