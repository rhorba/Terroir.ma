# Troubleshooting Guide

## Docker / Infrastructure

### Postgres won't start — "port 5432 already in use"
```bash
# Find the process using port 5432
netstat -ano | findstr :5432        # Windows
lsof -i :5432                       # macOS/Linux

# Kill it or change the port in docker-compose.yml
# Option: remap to 5433
ports: ["5433:5432"]
# Then update DATABASE_URL in .env to use port 5433
```

### Redpanda container exits immediately
```bash
docker compose logs redpanda
# Common causes:
# 1. Insufficient memory — ensure Docker Desktop has ≥ 4GB RAM allocated
# 2. Port 9092 in use by another Kafka instance — stop it first
# 3. Volume corruption — docker compose down -v && docker compose --profile core up -d
```

### Keycloak "realm not found" on first start
The realm import runs on container start. If it fails:
```bash
docker compose logs keycloak | grep -i error

# Re-import manually:
docker exec keycloak /opt/keycloak/bin/kc.sh import \
  --file /opt/keycloak/data/import/terroir-realm.json \
  --override true
```

### Mailpit not receiving emails
1. Check `SMTP_HOST=localhost` and `SMTP_PORT=1025` in `.env`
2. Verify Mailpit container is running: `docker ps | grep mailpit`
3. Check Mailpit UI at http://localhost:8025
4. Test SMTP directly: `curl smtp://localhost:1025` — should return `220 Mailpit ESMTP`

---

## NestJS API

### "Cannot find module '@common/...'" errors
The path aliases are defined in `tsconfig.json`. Make sure you're running via `npm run start:dev` (uses `ts-node` with `tsconfig-paths`), not `node dist/main.js` directly in development.

### TypeORM "relation does not exist" at startup
Migrations haven't run yet:
```bash
npm run migration:run
```
If that fails, check `DATABASE_URL` in `.env` points to the running Postgres container.

### "No metadata for entity" TypeORM error
The entity is not registered in the module's `TypeOrmModule.forFeature([...])`. Check the relevant `*.module.ts` file.

### Kafka consumer not receiving messages
1. Check the topic exists: `rpk topic list --brokers localhost:9092`
2. Check consumer group lag: `rpk group describe <module>-group --brokers localhost:9092`
3. Verify `KAFKA_BROKERS=localhost:9092` in `.env`
4. Check the `@EventPattern('topic.name')` decorator matches the producer's topic exactly

### JWT validation fails — "invalid token"
- Token may be expired (access tokens expire in 5 minutes). Refresh it.
- `KEYCLOAK_REALM_URL` in `.env` must match the Keycloak container's realm URL exactly.
- Check the `iss` claim in the JWT matches `http://localhost:8443/realms/terroir-ma`.

### QR verification returns 403 — "INVALID_SIGNATURE"
- The `QR_HMAC_SECRET` in `.env` may have changed since the QR was generated. All existing QR codes become invalid when the secret rotates.
- Regenerate the QR code after updating the secret.

---

## Tests

### Unit tests fail — "Cannot find module"
Run `npm install` first. Then verify path aliases in `jest.config.ts` `moduleNameMapper`.

### Integration tests timeout
- Docker must be running (Testcontainers pulls images automatically)
- Increase timeout: `testTimeout: 120000` in the relevant jest project config
- On first run, image pulls can take 2–5 minutes

### E2E tests fail — "ECONNREFUSED"
The API is not running. Start it first:
```bash
docker compose --profile full up -d
npm run start:dev
# In a separate terminal:
npm run test:e2e
```

---

## Windows-Specific Issues

### PostGIS extension not loading
Ensure you're using the `postgis/postgis:16-3.4` image (not plain `postgres:16`). Check `docker-compose.yml`.

### Line ending issues in shell scripts
```bash
# Fix CRLF → LF on script files
git config core.autocrlf input
git checkout -- infrastructure/scripts/
```

### WSL2 Docker socket issues
Ensure Docker Desktop → Settings → Resources → WSL Integration is enabled for your distro.
