# ADR-008: Pino for Structured JSON Logging

Date: 2026-03-30

## Status

Accepted

## Context

Platform logs must satisfy several requirements that plain-text logging cannot meet:

- **Machine-parseability:** Logs will be ingested by ELK Stack or Grafana Loki in Phase 2. Structured JSON enables field-based querying and alerting without regex parsing.
- **Correlation ID propagation:** Each log entry must be linkable to the originating HTTP request or Kafka event. This is essential for debugging cross-module workflows.
- **PII redaction:** Morocco's Commission Nationale de contrôle de la protection des Données à caractère Personnel (CNDP) requires that personal data not be retained in log systems without appropriate controls. Email addresses, phone numbers, and CIN (Carte d'Identité Nationale) numbers must never appear in plaintext logs.
- **Performance:** Logging must not add measurable latency to request processing. NestJS's default logger (`console.log`) is synchronous and unstructured.

Winston was considered but is significantly slower than Pino in benchmarks (~5× lower throughput) and requires more configuration to achieve equivalent JSON output.

## Decision

Use **Pino 9.x** as the application logger, integrated into NestJS via a custom `PinoLogger` service that wraps the Pino instance and is injectable as a NestJS provider.

**Standard log fields** (present on every log entry):

| Field | Type | Description |
|---|---|---|
| `level` | string | `trace`, `debug`, `info`, `warn`, `error`, `fatal` |
| `time` | string | ISO 8601 UTC timestamp |
| `correlationId` | uuid | From Kafka event header or HTTP `X-Correlation-ID` header |
| `module` | string | NestJS module name (e.g., `CertificationModule`) |
| `eventId` | uuid | Present when log is emitted in the context of a Kafka event |
| `msg` | string | Log message |

**PII redaction** via Pino's built-in `redact` option (replaces matched field values with `[Redacted]`):

```typescript
redact: [
  'email',
  'phone',
  '*.email',
  '*.phone',
  '*.cin',
  '*.recipientEmail',
  '*.recipientPhone',
  'payload.email',
  'payload.phone',
  'payload.cin',
]
```

The redact paths are evaluated at serialization time with zero performance cost for non-matching paths.

**Correlation ID propagation:**
- HTTP requests: `X-Correlation-ID` header is read by a NestJS middleware and stored in `AsyncLocalStorage`. If absent, a new UUID v4 is generated and returned in the response header.
- Kafka events: `correlationId` is read from the event envelope and stored in `AsyncLocalStorage` by the consumer interceptor.
- The Pino logger reads `correlationId` from `AsyncLocalStorage` on every log call.

**Environment-specific output:**
- `production` / `staging`: Raw JSON (default Pino output), one log entry per line.
- `development`: `pino-pretty` transport for human-readable, colorized console output.
- `test`: Log level set to `silent` by default to keep test output clean; overridable via `LOG_LEVEL` env var.

**Minimum log levels by environment:**
- `production`: `info`
- `staging`: `debug`
- `development`: `debug`

## Consequences

**Positive:**
- Pino is the fastest Node.js logger available; async logging via worker thread (pino's default) means log I/O does not block the event loop.
- Structured JSON output is immediately ingestible by ELK/Loki without a parsing stage.
- Built-in `redact` option provides PII protection at the serialization layer — no manual field scrubbing required in application code.
- `correlationId` on every log entry makes cross-module request tracing possible in log queries without a dedicated distributed tracing backend (Phase 1 requirement).

**Negative / Risks:**
- **Log volume:** JSON logs are larger than equivalent plain-text logs (~2–3×). Log storage and ingestion costs in Phase 2 will be higher than a plain-text equivalent. Mitigation: set appropriate minimum log levels per environment.
- **`pino-pretty` is dev-only:** Developers must not configure `pino-pretty` in production, as it significantly reduces throughput. This is enforced via environment checks in the logger factory.
- **`redact` path coverage must be maintained:** If a new PII field is introduced in an entity or event payload, the redact path list must be updated. A missed field could result in PII appearing in logs. Phase 2 should add a linting rule to flag known PII field names not covered by the redact list.
