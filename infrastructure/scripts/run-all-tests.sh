#!/usr/bin/env bash
# =============================================================================
# Terroir.ma — Full Test Suite Runner
# Runs unit, integration, and E2E tests in sequence.
# Spins up test infrastructure via docker-compose.test.yml for integration/e2e.
# Exit code: 0 if all pass, 1 if any fail.
# Run from the repository root: bash infrastructure/scripts/run-all-tests.sh
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_TEST_FILE="infrastructure/docker/docker-compose.test.yml"

cd "${REPO_ROOT}"

FAILED=0
START_TIME=$(date +%s)

echo "=== Running All Terroir.ma Tests ==="
echo "Repository: ${REPO_ROOT}"
echo "Started at: $(date)"
echo ""

# ── Helper ────────────────────────────────────────────────────────────────────
cleanup_test_infra() {
  echo ""
  echo "Tearing down test infrastructure..."
  docker compose -f "${COMPOSE_TEST_FILE}" down -v --remove-orphans 2>/dev/null || true
}

# ── 1. Unit Tests ─────────────────────────────────────────────────────────────
echo "─────────────────────────────────────────────"
echo "[1/3] Running unit tests..."
echo "─────────────────────────────────────────────"
if npm run test:unit; then
  echo "PASS unit tests"
else
  echo "FAIL unit tests"
  FAILED=1
fi

# ── 2. Integration Tests ─────────────────────────────────────────────────────
echo ""
echo "─────────────────────────────────────────────"
echo "[2/3] Running integration tests..."
echo "─────────────────────────────────────────────"

echo "Bringing up test infrastructure..."
docker compose -f "${COMPOSE_TEST_FILE}" up -d

echo "Waiting for test containers to be healthy..."
# Poll health status for up to 60 seconds
MAX_WAIT=60
ELAPSED=0
while [ "${ELAPSED}" -lt "${MAX_WAIT}" ]; do
  UNHEALTHY=$(docker compose -f "${COMPOSE_TEST_FILE}" ps --format json \
    2>/dev/null | jq -r '.[] | select(.Health != "healthy" and .Health != "") | .Name' \
    2>/dev/null | wc -l || echo "0")
  if [ "${UNHEALTHY}" -eq 0 ]; then
    echo "  All containers healthy."
    break
  fi
  echo "  Waiting for ${UNHEALTHY} container(s)... (${ELAPSED}s)"
  sleep 5
  ELAPSED=$((ELAPSED + 5))
done

TEST_DATABASE_URL="postgresql://terroir_test:terroir_test_pass@localhost:5434/terroir_test_db" \
TEST_REDIS_URL="redis://localhost:6380" \
TEST_KAFKA_BROKERS="localhost:19093" \
TEST_KEYCLOAK_URL="http://localhost:8444" \
npm run test:integration || { echo "FAIL integration tests"; FAILED=1; }

cleanup_test_infra

# ── 3. E2E Tests ──────────────────────────────────────────────────────────────
echo ""
echo "─────────────────────────────────────────────"
echo "[3/3] Running E2E tests..."
echo "─────────────────────────────────────────────"

echo "Bringing up test infrastructure for E2E..."
docker compose -f "${COMPOSE_TEST_FILE}" up -d

echo "Waiting for test infrastructure (E2E needs longer start)..."
sleep 10

TEST_DATABASE_URL="postgresql://terroir_test:terroir_test_pass@localhost:5434/terroir_test_db" \
TEST_REDIS_URL="redis://localhost:6380" \
TEST_KAFKA_BROKERS="localhost:19093" \
TEST_KEYCLOAK_URL="http://localhost:8444" \
npm run test:e2e || { echo "FAIL E2E tests"; FAILED=1; }

cleanup_test_infra

# ── Summary ───────────────────────────────────────────────────────────────────
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "═══════════════════════════════════════════════"
echo "Test suite completed in ${DURATION}s"
if [ "${FAILED}" -eq 0 ]; then
  echo "Result: ALL TESTS PASSED"
  echo "═══════════════════════════════════════════════"
  exit 0
else
  echo "Result: SOME TESTS FAILED — check output above"
  echo "═══════════════════════════════════════════════"
  exit 1
fi
