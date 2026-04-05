# /health-check

**Description:** Check health of all running Terroir.ma services and dependencies.

**Steps:**
1. Check NestJS app liveness: `curl -s http://localhost:3000/health | jq .`
2. Check NestJS app readiness: `curl -s http://localhost:3000/ready | jq .`
3. Check PostgreSQL: `docker exec terroir-ma-postgresql-1 pg_isready -U terroir`
4. Check Redis: `docker exec terroir-ma-redis-1 redis-cli ping`
5. Check Redpanda: `curl -s http://localhost:9644/v1/status/ready`
6. Check Keycloak: `curl -s http://localhost:8443/health/ready`
7. Check Mailpit: `curl -s http://localhost:8025/api/v1/info`
8. Report status for each dependency: ✅ OK or ❌ FAILED with error.

**Example:** `/health-check`

**Error Handling:**
- If NestJS app is not running: suggest `make docker-app` or `make dev`.
- If PostgreSQL is not running: suggest `make docker-core`.
- If Redpanda is unhealthy: check `docker logs terroir-ma-redpanda-1`.
- If Keycloak is not ready: it may still be booting — wait 30s and retry.
