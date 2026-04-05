# /docker-up

**Description:** Start Docker Compose services by profile.

**Arguments:** $ARGUMENTS = core | app | monitoring | full

**Profiles:**
- core: PostgreSQL, Redis, Redpanda, Keycloak, Keycloak-DB, Mailpit (6 containers)
- app: terroir-app NestJS application (requires core running)
- monitoring: Redpanda Console UI
- full: all 8 containers

**Steps:**
1. Navigate to infrastructure/docker/: `cd infrastructure/docker`
2. Run `docker compose --profile $ARGUMENTS up -d`
3. Wait for health checks: poll every 5s for up to 120s
4. Run `/health-check` to verify all dependencies
5. Report container status: `docker compose ps`

**Example:** `/docker-up core`

**Error Handling:**
- If containers fail to start: `docker compose logs <container>` to diagnose.
- If port conflicts: check what's using the port with `lsof -i :<port>`.
- If Keycloak fails: it needs keycloak-db to be healthy first — check ordering.
- If out of memory: Redpanda needs 512MB minimum.
