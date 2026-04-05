# CNDP Compliance

## Legal Basis

Moroccan **Law 09-08** on the protection of individuals with regard to the processing of personal data, administered by the **Commission Nationale de contrôle de la Protection des Données à caractère Personnel (CNDP)**.

## Data Controller vs. Data Processor

| Role | Entity | Justification |
|------|--------|---------------|
| **Data Controller** | MAPMDREF (Ministère de l'Agriculture) | Determines purposes and means of processing certification data |
| **Data Processor** | Terroir.ma platform | Processes data on behalf of MAPMDREF |

A Data Processing Agreement (DPA) must be signed between MAPMDREF and the platform operator before go-live.

## PII Categories in the System

| Category | Fields | Module | Retention |
|----------|--------|--------|-----------|
| Cooperative member identity | name, CIN, phone, email | cooperative | 5 years post-membership |
| Inspector identity | name, professional ID | certification | 5 years post-inspection |
| Lab technician identity | name, professional ID | product | 5 years post-test |
| Certification body staff | name, email | certification | 5 years |
| Consumer QR scan logs | IP address (if logged) | certification | 90 days |

## Technical Measures

### Log Redaction (Pino)
```typescript
// logger.config.ts
redact: ['email', 'phone', '*.email', '*.phone', '*.cin',
         '*.recipientEmail', '*.recipientPhone', 'req.headers.authorization']
```

### Kafka Events — No PII in Payloads
All Kafka events use **UUIDs** to reference entities, never PII directly:
```json
// Correct ✓
{ "cooperativeId": "uuid-here", "eventId": "uuid-here" }

// Incorrect ✗
{ "memberName": "Hassan Ait...", "memberPhone": "+212612..." }
```

### HTTPS Enforcement
All API traffic in production must use HTTPS. HTTP redirects to HTTPS at the load balancer.

### Data Minimization
- QR verification (`GET /verify/:uuid`) returns only what consumers need: certification number, product type, cooperative name, granted date
- No PII in QR verification responses

## CNDP Declaration

Before processing personal data, a declaration must be filed with CNDP:

1. **Declaration type**: Declaration normale (standard declaration)
2. **Processing purpose**: Certification of agricultural origin and quality products (Law 25-06)
3. **Data categories**: Professional identity data (CIN, professional ID, contact)
4. **Retention**: 5 years maximum
5. **Security measures**: HTTPS, access control (Keycloak roles), encryption at rest (PostgreSQL TDE)
6. **Right to access**: Via cooperative-admin role; deletion requests handled within 30 days

## Data Subject Rights

| Right | How Handled | SLA |
|-------|-------------|-----|
| Right of access | cooperative-admin exports member data | 15 business days |
| Right of rectification | cooperative-admin updates member profile | 15 business days |
| Right of erasure | Manual deletion by super-admin after verification | 30 days |
| Right to object | Contact super-admin | 15 business days |

## Incident Response

If a personal data breach occurs:
1. Notify CNDP within **72 hours** of discovery
2. Notify affected data subjects if high risk
3. Log incident in `.sessions/` (date, scope, remediation)
4. Update security controls to prevent recurrence
