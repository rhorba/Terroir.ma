# /keycloak-setup

**Description:** Import Keycloak realm configuration and verify all roles and clients are set up correctly.

**Steps:**
1. Ensure Keycloak is running: `curl -s http://localhost:8443/health/ready`
2. Run import script: `bash infrastructure/scripts/keycloak-import.sh`
3. Verify realm "terroir-ma" exists: `curl -s http://localhost:8443/admin/realms/terroir-ma`
4. Verify all 9 roles: super-admin, cooperative-admin, cooperative-member, lab-technician, inspector, certification-body, customs-agent, consumer, service-account
5. Verify all 5 clients: web-portal, inspector-app, consumer-app, api-client, admin-console
6. Test token generation: get client credentials token for api-client

**Example:** `/keycloak-setup`

**Error Handling:**
- If Keycloak is not ready: wait for startup (can take up to 60s on first boot).
- If realm already exists: the import script should update, not create duplicate.
- If role is missing: manually add via Keycloak Admin UI or re-import realm.
