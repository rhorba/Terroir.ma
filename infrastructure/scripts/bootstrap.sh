#!/usr/bin/env bash
# =============================================================================
# Terroir.ma Bootstrap Script
# Brings up the full infrastructure stack and seeds it with initial data.
# Run from the repository root: bash infrastructure/scripts/bootstrap.sh
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "=== Terroir.ma Bootstrap Script ==="
echo "Repository root: ${REPO_ROOT}"
echo "Starting full infrastructure setup..."
echo ""

cd "${REPO_ROOT}"

# ── 1. Start core infrastructure ─────────────────────────────────────────────
echo "[1/6] Starting core containers (profile: core)..."
docker compose --profile core up -d

echo "Waiting for PostgreSQL to be ready..."
until docker compose exec postgresql pg_isready -U terroir -d terroir_db 2>/dev/null; do
  echo "  PostgreSQL not ready, waiting 2s..."
  sleep 2
done
echo "  PostgreSQL is ready."

echo "Waiting for Redis to be ready..."
until docker compose exec redis redis-cli ping 2>/dev/null | grep -q PONG; do
  echo "  Redis not ready, waiting 2s..."
  sleep 2
done
echo "  Redis is ready."

# ── 2. Wait for Keycloak ─────────────────────────────────────────────────────
echo ""
echo "[2/6] Waiting for Keycloak to be ready..."
until curl -sf http://localhost:8443/health/ready > /dev/null 2>&1; do
  echo "  Keycloak not ready, waiting 3s..."
  sleep 3
done
echo "  Keycloak is ready."

# ── 3. Import Keycloak realm ──────────────────────────────────────────────────
echo ""
echo "[3/6] Importing Keycloak realm..."
bash infrastructure/scripts/keycloak-import.sh

# ── 4. Create Redpanda topics ─────────────────────────────────────────────────
echo ""
echo "[4/6] Creating Redpanda topics..."
bash infrastructure/scripts/redpanda-create-topics.sh

# ── 5. Run database migrations ───────────────────────────────────────────────
echo ""
echo "[5/6] Running database migrations..."
npm run migration:run

# ── 6. Seed data ──────────────────────────────────────────────────────────────
echo ""
echo "[6/6] Seeding initial data..."
bash infrastructure/scripts/seed-data.sh

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║         Bootstrap complete!                      ║"
echo "╠══════════════════════════════════════════════════╣"
echo "║  API:             http://localhost:3000           ║"
echo "║  Redpanda UI:     http://localhost:8080           ║"
echo "║  Keycloak Admin:  http://localhost:8443/admin     ║"
echo "║                   admin / admin                   ║"
echo "║  Mailpit:         http://localhost:8025           ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo "Run 'make dev' to start the NestJS app in watch mode."
