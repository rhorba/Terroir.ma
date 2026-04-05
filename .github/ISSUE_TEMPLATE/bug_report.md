---
name: Bug Report
about: Report a defect in the Terroir.ma platform
title: '[BUG] '
labels: bug, needs-triage
assignees: ''
---

## Description

<!-- A clear and concise description of the bug. What went wrong? -->

## Steps to Reproduce

1. ...
2. ...
3. ...

## Expected Behaviour

<!-- What did you expect to happen? -->

## Actual Behaviour

<!-- What actually happened? Include error messages, status codes, or unexpected data. -->

## Environment

| Component | Version / Value |
|-----------|----------------|
| Node.js | |
| NestJS | |
| PostgreSQL container | `postgis/postgis:16-3.4` |
| Redis container | `redis:7-alpine` |
| Redpanda container | |
| Keycloak container | |
| OS | |
| Docker Compose version | |

**Module Affected:**
- [ ] `cooperative`
- [ ] `product`
- [ ] `certification`
- [ ] `notification`
- [ ] `common` / auth / guards
- [ ] Infrastructure

## Kafka Event Chain Step (if applicable)

<!-- If this bug occurs during an async event flow, which step in the chain failed? -->

- [ ] Not Kafka-related
- [ ] `cooperative.registered` event
- [ ] `product.submitted` event
- [ ] `certification.approved` event
- [ ] `certification.rejected` event
- [ ] `qr.scanned` event
- [ ] Other: _______________

## Logs

<!-- Paste relevant structured JSON logs from `docker compose logs` or the API terminal.
     Remove any sensitive data (tokens, passwords, personal information) before pasting. -->

```json

```

## Additional Context

<!-- Screenshots, curl commands, Postman collections, or anything else that helps reproduce the bug. -->
