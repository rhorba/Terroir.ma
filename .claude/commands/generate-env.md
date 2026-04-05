# /generate-env

**Description:** Generate .env file from .env.example with customized values.

**Steps:**
1. Read .env.example to show all required variables.
2. Check if .env already exists — if so, ask user if they want to overwrite.
3. For each variable, use the .env.example default unless user provides a custom value.
4. Critical variables that MUST be changed:
   - QR_HMAC_SECRET: generate with `openssl rand -hex 32`
   - KEYCLOAK_CLIENT_SECRET: set to the actual Keycloak client secret
5. Write .env file (never commit this file — it's in .gitignore).
6. Confirm: "✅ .env created. Run `make docker-core && make dev` to start."

**Example:** `/generate-env`

**Error Handling:**
- If .env already exists: show diff and ask before overwriting.
- Never commit .env to git (verify .gitignore has it).
