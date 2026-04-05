# /logs

**Description:** Tail logs for a specific Docker container.

**Arguments:** $ARGUMENTS = container name (default: terroir-app)

**Container names:**
- terroir-app (NestJS application)
- postgresql (PostgreSQL)
- redis (Redis)
- redpanda (Redpanda/Kafka)
- keycloak (Keycloak)
- mailpit (Email testing)

**Steps:**
1. If $ARGUMENTS is empty, use "terroir-app".
2. Run `docker compose logs -f $ARGUMENTS` from infrastructure/docker/
3. For terroir-app logs: filter for errors with `| grep -E "ERROR|WARN"`

**Example:** `/logs redpanda`

**Error Handling:**
- If container not found: list running containers with `docker ps`.
- If logs are too verbose: pipe to grep for specific patterns.
