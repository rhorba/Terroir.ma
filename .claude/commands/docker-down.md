# /docker-down

**Description:** Stop and remove all Terroir.ma Docker containers and volumes.

**Steps:**
1. Warn user: "This will stop all containers and remove volumes. Data will be lost."
2. Confirm before proceeding.
3. Navigate to infrastructure/docker/: `cd infrastructure/docker`
4. Run `docker compose --profile full down -v`
5. Verify: `docker ps | grep terroir` should return nothing.
6. Clean up dangling volumes: `docker volume prune -f` (optional).

**Example:** `/docker-down`

**Error Handling:**
- If containers are stuck: `docker compose --profile full kill` then `down`.
- If volumes cannot be removed: check for orphan containers with `docker ps -a`.
