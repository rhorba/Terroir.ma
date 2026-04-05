#!/usr/bin/env bash
# =============================================================================
# Terroir.ma — Keycloak Realm Import Script
# Authenticates to Keycloak admin API and imports the terroir-ma realm.
# Idempotent: skips import if realm already exists.
# Run from the repository root: bash infrastructure/scripts/keycloak-import.sh
# =============================================================================
set -euo pipefail

echo "=== Importing Keycloak Realm ==="

KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8443}"
KEYCLOAK_ADMIN="${KEYCLOAK_ADMIN:-admin}"
KEYCLOAK_ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-admin}"
REALM_FILE="infrastructure/keycloak/realm-export.json"

if [ ! -f "${REALM_FILE}" ]; then
  echo "ERROR: Realm file not found at ${REALM_FILE}"
  echo "Run this script from the repository root."
  exit 1
fi

# ── Get admin token ───────────────────────────────────────────────────────────
echo "Authenticating with Keycloak at ${KEYCLOAK_URL}..."
TOKEN=$(curl -sf -X POST \
  "${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=${KEYCLOAK_ADMIN}" \
  -d "password=${KEYCLOAK_ADMIN_PASSWORD}" \
  -d "grant_type=password" \
  -d "client_id=admin-cli" | jq -r '.access_token')

if [ -z "${TOKEN}" ] || [ "${TOKEN}" = "null" ]; then
  echo "ERROR: Failed to authenticate with Keycloak admin API."
  echo "  URL: ${KEYCLOAK_URL}"
  echo "  User: ${KEYCLOAK_ADMIN}"
  echo "Check that Keycloak is running and credentials are correct."
  exit 1
fi

echo "  Authenticated successfully."

# ── Check if realm already exists ────────────────────────────────────────────
echo "Checking if realm 'terroir-ma' already exists..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer ${TOKEN}" \
  "${KEYCLOAK_URL}/admin/realms/terroir-ma")

if [ "${HTTP_STATUS}" = "200" ]; then
  echo "  Realm 'terroir-ma' already exists (HTTP ${HTTP_STATUS}). Skipping import."
  echo ""
  echo "  To reimport, delete the realm first via the Keycloak admin console:"
  echo "    ${KEYCLOAK_URL}/admin/master/console/#/terroir-ma"
else
  echo "  Realm not found (HTTP ${HTTP_STATUS}). Importing..."
  IMPORT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST \
    "${KEYCLOAK_URL}/admin/realms" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d @"${REALM_FILE}")

  if [ "${IMPORT_STATUS}" = "201" ]; then
    echo "  Realm imported successfully (HTTP ${IMPORT_STATUS})."
  else
    echo "  ERROR: Import failed with HTTP status ${IMPORT_STATUS}"
    exit 1
  fi
fi

# ── Verify realm ──────────────────────────────────────────────────────────────
echo ""
echo "Verifying imported realm..."
REALM_NAME=$(curl -sf \
  -H "Authorization: Bearer ${TOKEN}" \
  "${KEYCLOAK_URL}/admin/realms/terroir-ma" | jq -r '.realm')

if [ "${REALM_NAME}" = "terroir-ma" ]; then
  echo "  Realm verified: ${REALM_NAME}"
else
  echo "  WARNING: Realm verification returned unexpected value: ${REALM_NAME}"
fi

echo ""
echo "Keycloak admin console: ${KEYCLOAK_URL}/admin/master/console/#/terroir-ma"
echo "=== Keycloak import complete ==="
