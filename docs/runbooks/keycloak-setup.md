# Keycloak Setup Runbook

This runbook covers configuring, verifying, and maintaining the Keycloak identity provider for Terroir.ma in local development.

---

## Realm

**Realm name:** `terroir-ma`

All Terroir.ma users, roles, and clients are scoped to this realm. Do not use the `master` realm for application configuration.

---

## Importing the Realm

The realm definition (roles, client configuration, and test users) is exported as a JSON file and committed to the repository. Import it into a running Keycloak container:

```bash
docker exec keycloak /opt/keycloak/bin/kc.sh import --file /tmp/terroir-realm.json
```

> The `terroir-realm.json` file is mounted into the container via the `docker-compose.yml` volume definition. If the file is not found inside the container, check the volume mount configuration.

If the realm already exists, Keycloak skips the import silently. To re-import from scratch:

1. Log into the Keycloak Admin Console at http://localhost:8443
2. Select the `terroir-ma` realm
3. Go to **Realm Settings** → scroll to the bottom → **Delete realm**
4. Re-run the import command above

---

## Roles

The following 9 roles must exist in the `terroir-ma` realm. Verify them via **Realm Settings → Roles** in the Admin Console, or by decoding a user's JWT (see below).

| Role | Description |
|------|-------------|
| `super-admin` | Platform administrator — full access to all modules |
| `cooperative-admin` | Manages a cooperative's members, products, and certifications |
| `cooperative-member` | Read access to the cooperative's data |
| `lab-technician` | Submits and manages laboratory test results |
| `inspector` | Conducts and files field inspection reports |
| `certification-body` | Reviews certification requests, schedules inspections, grants/denies certifications |
| `customs-agent` | Verifies certifications at customs checkpoints |
| `consumer` | Public user — verifies QR codes, views certification status |
| `service-account` | Non-human service-to-service authentication (client credentials flow) |

---

## API Client

**Client ID:** `terroir-ma-api`
**Access type:** Confidential
**Client credentials (service account) enabled:** Yes

The `terroir-ma-api` client is used by:

- The NestJS API to validate inbound JWTs (realm public key)
- Service-account flows for internal microservice calls

### Finding the client secret

1. Open http://localhost:8443 → Admin Console
2. Navigate to **Clients** → `terroir-ma-api`
3. Open the **Credentials** tab
4. Copy the **Client secret** value into `KEYCLOAK_CLIENT_SECRET` in your `.env`

---

## Test Users (Dev Only)

One test user is created per role. These users exist only in the dev/test Keycloak instance and must never be created in production.

| Username | Role |
|----------|------|
| `superadmin@test.ma` | `super-admin` |
| `coopadmin@test.ma` | `cooperative-admin` |
| `coopmember@test.ma` | `cooperative-member` |
| `labtech@test.ma` | `lab-technician` |
| `inspector@test.ma` | `inspector` |
| `certbody@test.ma` | `certification-body` |
| `customs@test.ma` | `customs-agent` |
| `consumer@test.ma` | `consumer` |

**Password for all test users:** `Test@123`

---

## Getting a Test Token

Use `curl` to obtain a JWT for any test user via the Resource Owner Password Credentials flow:

```bash
curl -s -X POST \
  http://localhost:8443/realms/terroir-ma/protocol/openid-connect/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'grant_type=password' \
  -d 'client_id=terroir-ma-api' \
  -d 'username=certbody@test.ma' \
  -d 'password=Test@123'
```

The response contains an `access_token` (JWT) that you can use as a bearer token in API requests:

```bash
TOKEN=$(curl -s -X POST \
  http://localhost:8443/realms/terroir-ma/protocol/openid-connect/token \
  -d 'grant_type=password&client_id=terroir-ma-api&username=certbody@test.ma&password=Test@123' \
  | jq -r '.access_token')

curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/certifications
```

---

## Verifying a JWT

### Option 1 — jwt-cli

```bash
# Install once
npm install -g jwt-cli

# Decode (no signature verification)
jwt decode "$TOKEN"
```

Look for `realm_access.roles` in the decoded payload to confirm the user's roles.

### Option 2 — jwt.io

1. Open https://jwt.io
2. Paste the `access_token` value into the **Encoded** field
3. The **Payload** panel shows the decoded claims

Key claims to verify:

| Claim | Expected value |
|-------|---------------|
| `iss` | `http://localhost:8443/realms/terroir-ma` |
| `azp` | `terroir-ma-api` |
| `realm_access.roles` | Array containing the user's role(s) |
| `exp` | Unix timestamp in the future |

---

## Rotating the Client Secret

If the client secret is compromised or needs rotating:

1. Open http://localhost:8443 → Admin Console
2. Navigate to **Clients** → `terroir-ma-api` → **Credentials** tab
3. Click **Regenerate Secret**
4. Copy the new secret value
5. Update `KEYCLOAK_CLIENT_SECRET` in your `.env` (local) or the GitHub Actions / deployment secret store (CI/production)
6. Restart the NestJS API so it picks up the new secret:

   ```bash
   npm run start:dev
   # or in production:
   docker service update --force terroir-ma-api
   ```
