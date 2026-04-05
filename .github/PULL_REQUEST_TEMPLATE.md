## Summary

<!-- Describe what this PR does and why. 2-4 sentences max. -->

-
-

## Type of Change

<!-- Check all that apply -->

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Refactoring (no functional change, code quality improvement)
- [ ] Database migration (adds or alters schema)
- [ ] Configuration change (environment variables, Docker, Keycloak)
- [ ] Documentation update
- [ ] CI/CD change

## Module(s) Affected

<!-- Which domain modules does this PR touch? -->

- [ ] `cooperative`
- [ ] `product`
- [ ] `certification`
- [ ] `notification`
- [ ] `common` / shared utilities
- [ ] Infrastructure / Docker
- [ ] Keycloak / Auth

## Testing Done

<!-- Describe the tests you ran and how to reproduce them -->

```bash
# Commands to verify this PR
npm run test:unit
# or
npm run test:integration
```

- [ ] Unit tests added or updated
- [ ] Integration tests added or updated (if DB/Kafka interaction involved)
- [ ] E2E tests added or updated (if new API endpoints)
- [ ] Manually tested against local Docker stack (`make docker-up`)

## Definition of Done

<!-- All boxes must be checked before merging -->

- [ ] TypeScript strict mode — no `any`, no `@ts-ignore`
- [ ] ESLint passes with zero warnings (`npm run lint`)
- [ ] Prettier formatting applied (`npm run format`)
- [ ] `tsc --noEmit` passes (`npm run typecheck`)
- [ ] Test coverage remains at or above 80% for branches/functions/lines/statements
- [ ] No cross-module direct imports (modules communicate via Kafka events only)
- [ ] If Kafka events are produced or consumed: event schemas documented in `shared/events/`
- [ ] If schema changed: TypeORM migration generated and committed in `migrations/`
- [ ] If user input is accepted: Moroccan-specific validators applied (CIN, ICE, commune, coordinates)
- [ ] `.env.example` updated if new environment variables were added
- [ ] Swagger decorators added for any new/changed API endpoints

## Related Backlog Item

<!-- Link to the GitHub Issue or project board item -->

Closes #
