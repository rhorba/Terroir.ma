# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| main    | Yes       |
| < main  | No        |

## Reporting a Vulnerability

**Do NOT open a public GitHub issue for security vulnerabilities.**

Report vulnerabilities by emailing **security@terroir.ma** with:

1. Description of the vulnerability
2. Steps to reproduce
3. Affected component(s)
4. Potential impact
5. (Optional) Suggested fix

You will receive an acknowledgement within **48 hours** and a full response within **7 business days**.

## Security Considerations

### Data Privacy (CNDP)
Terroir.ma processes personal data of cooperative members, lab technicians, and inspectors under Moroccan Law 09-08. Key obligations:
- No PII stored in logs (Pino redaction configured for `email`, `phone`, `cin`)
- Data retention: cooperative member data for 5 years post-membership
- Right to erasure honored within 30 days of request

### Authentication
- All API endpoints require a valid Keycloak JWT except `GET /verify/:uuid` (QR scan, public)
- Tokens expire in 5 minutes (access) / 30 minutes (refresh)
- Service accounts use client credentials flow

### QR Code Signing
- QR codes are HMAC-SHA256 signed with a secret stored in Vault (not in .env in production)
- The `QR_HMAC_SECRET` must be rotated if compromised — invalidates all existing QR codes

### Injection Prevention
- All user input validated with class-validator before use
- TypeORM parameterized queries for all database operations
- No raw SQL with user-supplied values

### Rate Limiting
- `GET /verify/:uuid` — 100 req/s per IP (protect against enumeration)
- `POST /certifications/request` — 10 req/min per cooperative
