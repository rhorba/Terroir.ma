# API Versioning Strategy

## v1 (Current)

No explicit version prefix. All endpoints are at root path:
```
GET  /health
POST /certifications/request
GET  /verify/:uuid
```

**Rationale**: v1 is internal-only (no external consumers yet). Adding `/v1/` prefix for a single version adds no value and creates friction.

## v2 Strategy (Phase 2)

When breaking changes are required:

1. Enable NestJS URI versioning in `main.ts`:
```typescript
app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
```

2. Decorate controllers with `@Version('2')` for new versions
3. v1 endpoints remain functional during the **6-month deprecation window**
4. Deprecation notice: `Deprecation: true` HTTP header + Swagger `deprecated: true`

## Breaking vs. Non-Breaking Changes

| Change | Breaking? | Action Required |
|--------|-----------|-----------------|
| Adding optional request field | No | Deploy directly |
| Adding response field | No | Deploy directly |
| Removing request/response field | **Yes** | New version required |
| Changing field type | **Yes** | New version required |
| Changing HTTP method | **Yes** | New version required |
| Changing status codes | **Yes** | New version required |
| Renaming endpoint | **Yes** | Old endpoint → 301 redirect for 6 months |

## Kafka Event Versioning

All events include a `version` field (currently `"1.0"`):
```json
{ "eventId": "...", "version": "1.0", "timestamp": "..." }
```

During a schema evolution:
1. Publish new events as `version: "2.0"` on the **same topic**
2. Consumers must handle both `"1.0"` and `"2.0"` during migration period
3. After all consumers are updated, retire `"1.0"` support

Phase 2 will add Avro schema validation via Confluent Schema Registry to enforce this contract.
