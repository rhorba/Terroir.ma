# /test-report

**Description:** Run the full test suite and generate a comprehensive report.

**Steps:**
1. Run `npm run test:unit -- --coverage --json --outputFile=.sessions/test-results-unit.json`
2. Run `npm run test:integration -- --json --outputFile=.sessions/test-results-integration.json`
3. Run `npm run test:e2e -- --json --outputFile=.sessions/test-results-e2e.json`
4. Parse results and generate report:
```
## Test Report — YYYY-MM-DD HH:MM

### Unit Tests
- Pass: [N] | Fail: [N] | Skip: [N]
- Coverage: branches [X%] functions [X%] lines [X%]
- Per module: cooperative [X%] | product [X%] | certification [X%] | notification [X%]

### Integration Tests
- Pass: [N] | Fail: [N]
- Kafka event chain: [status]
- PostGIS queries: [status]

### E2E Tests
- Pass: [N] | Fail: [N]
- Full certification chain: [status]
- QR verification: [status]

### Failures (if any)
- [test name]: [error message] — Suggested fix: [suggestion]
```

**Example:** `/test-report`
