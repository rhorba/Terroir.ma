# Definition of Ready

A user story is **Ready** for sprint planning when ALL of the following are true:

## Business Readiness

- [ ] Story is written in the format: *As a [role], I want to [action] so that [benefit]*
- [ ] Acceptance criteria are defined (at least 3 concrete, testable criteria)
- [ ] The Keycloak role(s) required are identified
- [ ] Any regulatory constraint (Law 25-06, CNDP) is noted
- [ ] Story is estimated in story points

## Technical Readiness

- [ ] Kafka events produced/consumed by this story are listed
- [ ] Database schema changes identified (new entity, new column, new index)
- [ ] TypeORM migration required? (yes/no)
- [ ] Any cross-module read model updates identified
- [ ] No unresolved blocking dependencies on other stories

## Design Readiness

- [ ] API endpoint(s) defined (method, path, roles, request/response shape)
- [ ] DTO field names and validation rules specified
- [ ] Error cases enumerated (what 4xx errors can this return?)

## Story Point Reference

| Points | Meaning |
|--------|---------|
| 1 | Trivial — config change, small DTO addition |
| 2 | Simple — one service method + one test |
| 3 | Standard — controller + service + migration + tests |
| 5 | Complex — multiple services, Kafka event, integration test |
| 8 | Large — spans multiple modules or has external dependency |
| 13 | Epic-level — should be split before Sprint Planning |
