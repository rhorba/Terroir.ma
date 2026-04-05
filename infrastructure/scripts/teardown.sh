#!/usr/bin/env bash
# =============================================================================
# Terroir.ma Teardown Script
# Stops and removes ALL containers, volumes, and networks for this project.
# WARNING: All data will be permanently lost.
# Run from the repository root: bash infrastructure/scripts/teardown.sh
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "=== Terroir.ma Teardown ==="
echo ""
echo "WARNING: This will PERMANENTLY DESTROY all containers and volumes!"
echo "  - terroir_pgdata       (all application database data)"
echo "  - terroir_keycloak_pgdata (all Keycloak data)"
echo "  - All running containers"
echo ""
read -r -p "Are you sure? (type YES to confirm): " confirm

if [ "$confirm" != "YES" ]; then
  echo "Teardown cancelled. Nothing was changed."
  exit 0
fi

cd "${REPO_ROOT}"

echo ""
echo "Stopping and removing all containers, volumes, and networks..."
docker compose --profile full down -v --remove-orphans

echo ""
echo "Cleaning up dangling Docker volumes (if any)..."
docker volume ls --filter "name=terroir" --format "{{.Name}}" | xargs -r docker volume rm || true

echo ""
echo "=== Teardown complete. ==="
echo ""
echo "To start fresh, run:"
echo "  bash infrastructure/scripts/bootstrap.sh"
