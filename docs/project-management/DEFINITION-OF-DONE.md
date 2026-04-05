# Definition of Done

## Story Level

A user story is Done when:

- [ ] Code reviewed and approved by ≥ 1 team member
- [ ] Unit tests written with ≥ 80% coverage for new code
- [ ] Integration test written for any new DB operation or Kafka event
- [ ] TypeScript compiles with no errors (`tsc --noEmit`) in strict mode
- [ ] ESLint passes with no warnings (`npm run lint`)
- [ ] API endpoint decorated with `@ApiOperation` and `@ApiResponse`
- [ ] No `any` type in new code (enforced by ESLint `@typescript-eslint/no-explicit-any: error`)
- [ ] Correlation ID propagated through all service calls
- [ ] Error responses use standard envelope `{ success: false, error: { code, message } }`
- [ ] New env vars added to `.env.example` with inline comments
- [ ] No PII logged (Pino redact config covers all new PII fields)

## Sprint Level

A sprint is Done when:

- [ ] All stories meet Story Level DoD
- [ ] Integration tests green in CI (`npm run test:integration`)
- [ ] `GET /health` returns 200 with all dependencies healthy
- [ ] `CHANGELOG.md` updated with sprint changes
- [ ] Sprint retrospective completed, saved to `.sessions/sprint-logs/`
- [ ] Technical debt items documented in `TECHNICAL-DEBT.md`

## Release Level

A release is Done when:

- [ ] All sprint DoDs met
- [ ] E2E tests green against `docker-compose.test.yml`
- [ ] CNDP compliance checklist reviewed (see `docs/morocco/cndp-compliance.md`)
- [ ] OWASP Top 10 self-assessment completed
- [ ] TypeORM migrations tested: `run` → verify → `revert` → verify → `run`
- [ ] Load test on `GET /verify/:uuid` confirms < 200ms at 100 RPS
- [ ] `SECURITY.md` reviewed and up-to-date
- [ ] Docker images tagged and pushed to registry
- [ ] Rollback plan documented and tested
