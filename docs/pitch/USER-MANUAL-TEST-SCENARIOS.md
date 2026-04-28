# Terroir.ma — User Manual & Test Scenarios

### Complete How-To Guide · Presentation Edition · April 2026

> **Purpose:** This document provides structured test user scenarios for every role in the Terroir.ma platform. Each scenario is self-contained, presentation-ready, and covers one complete user journey end-to-end. Scenarios can be run independently or chained together as a full live demonstration.

---

## Platform Overview

**Terroir.ma** digitizes Morocco's SDOQ (Signes Distinctifs d'Origine et de Qualité) certification chain under Law 25-06. The platform connects 9 types of actors in a 12-step workflow from cooperative registration through QR-verified export.

| Layer      | Technology                              |
| ---------- | --------------------------------------- |
| API        | NestJS 10 · TypeScript 5.4 strict       |
| Database   | PostgreSQL 16 + PostGIS 3.4             |
| Events     | Redpanda (Kafka-compatible) · 18 events |
| Auth       | Keycloak 24 · 9 roles · JWT             |
| Cache      | Redis 7 · QR < 200ms                    |
| QR Signing | HMAC-SHA256                             |
| Languages  | fr-MA · ar-MA · zgh (Tifinagh)          |

**Base URL (local dev):** `http://localhost:3000`
**Auth:** Bearer token from Keycloak (`POST /realms/terroir/protocol/openid-connect/token`)

---

## Persona Reference

| Persona       | Role                 | Context                                             |
| ------------- | -------------------- | --------------------------------------------------- |
| **Khalid**    | `super-admin`        | Platform administrator, MAPMDREF oversight          |
| **Fatima**    | `cooperative-admin`  | President, 28-member saffron cooperative, Taliouine |
| **Hassan**    | `cooperative-member` | Field farmer, Fatima's cooperative                  |
| **Dr. Amina** | `lab-technician`     | ONSSA-accredited lab chemist, Agadir                |
| **Youssef**   | `inspector`          | Senior field inspector, MAPMDREF appointed          |
| **Omar**      | `certification-body` | Certification officer, Direction SDOQ               |
| **Leila**     | `customs-agent`      | EACCE customs officer, Casablanca Port              |
| **Yuki**      | `consumer`           | EU sourcing manager, Paris — no account required    |

---

## Certification Number Format

```
TERROIR-{TYPE}-{REGION_CODE}-{YEAR}-{SEQ}

Examples:
  TERROIR-IGP-DRAA_TAFILALET-2025-0001
  TERROIR-AOP-SOUSS_MASSA-2025-0047
  TERROIR-LABEL_AGRICOLE-FES_MEKNES-2025-0012
```

---

## Response Envelope (all endpoints)

```json
{
  "success": true,
  "data": {},
  "meta": { "page": 1, "limit": 20, "total": 100 }
}
```

---

---

# SCENARIO 1 — SUPER-ADMIN: Platform Setup & Oversight

**Persona:** Khalid · Role: `super-admin`
**Goal:** Bootstrap the platform — verify a cooperative, accredit a lab, manage platform settings, inspect the dashboard.
**Pre-condition:** Keycloak token with `super-admin` role.

---

## Step 1.1 — Authenticate

```http
POST /realms/terroir/protocol/openid-connect/token
Content-Type: application/x-www-form-urlencoded

grant_type=password&client_id=terroir-api&username=khalid&password=***
```

**Response:** `access_token` (JWT). Use as `Authorization: Bearer {token}` for all subsequent calls.

---

## Step 1.2 — View Platform Dashboard

```http
GET /admin/dashboard
Authorization: Bearer {khalid_token}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "cooperatives": { "total": 12, "pending": 3, "active": 8, "suspended": 1 },
    "certifications": { "total": 47, "granted": 31, "pending": 9, "denied": 5, "revoked": 2 },
    "qrScans": { "total": 1248, "last30Days": 234 },
    "labTests": { "total": 54, "passed": 46, "failed": 8 },
    "exportDocuments": { "total": 18, "approved": 15 }
  }
}
```

> **Cached:** 300 seconds in Redis. Reflects aggregate platform state in real time.

---

## Step 1.3 — Review a Pending Cooperative

```http
GET /cooperatives?status=pending
Authorization: Bearer {khalid_token}
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "coop-uuid-001",
      "name": "Coopérative Safran Taliouine",
      "nameAr": "تعاونية زعفران تالوين",
      "ice": "002154789012345",
      "regionCode": "DRAA_TAFILALET",
      "presidentName": "Fatima Ait Brahim",
      "status": "pending",
      "createdAt": "2025-11-02T09:14:00Z"
    }
  ]
}
```

---

## Step 1.4 — Verify the Cooperative

```http
PATCH /cooperatives/coop-uuid-001/verify
Authorization: Bearer {khalid_token}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "coop-uuid-001",
    "status": "active",
    "verifiedAt": "2025-11-03T10:00:00Z",
    "verifiedBy": "khalid-user-uuid"
  }
}
```

> **Kafka event fired:** `cooperative.registration.verified`
> **Notification sent:** Fatima receives email + SMS: _"Votre coopérative a été vérifiée et activée."_

---

## Step 1.5 — Accredit a Laboratory

```http
POST /labs
Authorization: Bearer {khalid_token}
Content-Type: application/json

{
  "name": "Laboratoire ONSSA Agadir",
  "onssaAccreditationNumber": "ONSSA-LAB-2025-AGD-007"
}
```

Then grant accreditation:

```http
POST /labs/{labId}/accredit
Authorization: Bearer {khalid_token}
```

**Response:** `{ "isAccredited": true, "accreditedAt": "2025-11-03T..." }`

---

## Step 1.6 — Update Campaign Settings

```http
PATCH /admin/settings/campaign
Authorization: Bearer {khalid_token}
Content-Type: application/json

{
  "currentCampaignYear": "2025/2026",
  "campaignStartMonth": 10,
  "campaignStartDay": 1
}
```

---

## Step 1.7 — View Audit Logs

```http
GET /admin/audit-logs?page=1&limit=20&from=2025-11-01
Authorization: Bearer {khalid_token}
```

**Response:** Paginated log of every user action — userId, action, resource type, resource ID, timestamp.

---

## Step 1.8 — View Kafka DLQ Stats

```http
GET /admin/kafka/dlq-stats
Authorization: Bearer {khalid_token}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "cooperative.registration.submitted.dlq": 0,
    "lab.test.completed.dlq": 1,
    "certification.decision.granted.dlq": 0
  }
}
```

> Non-zero DLQ counts require manual investigation. Events in DLQ have exceeded retry threshold and require re-processing.

---

**Scenario 1 Complete — Khalid has:** verified a cooperative, accredited a lab, configured campaign settings, reviewed platform health.

---

---

# SCENARIO 2 — COOPERATIVE-ADMIN: Full Cooperative Setup

**Persona:** Fatima · Role: `cooperative-admin`
**Goal:** Register cooperative, add members, register farms, log platform profile.
**Pre-condition:** Khalid has verified the cooperative (Scenario 1). Fatima has Keycloak token with `cooperative-admin` role and `cooperative_id: coop-uuid-001` in JWT.

---

## Step 2.1 — View My Cooperative Profile

```http
GET /cooperatives/coop-uuid-001
Authorization: Bearer {fatima_token}
```

**Response:**

```json
{
  "id": "coop-uuid-001",
  "name": "Coopérative Safran Taliouine",
  "nameAr": "تعاونية زعفران تالوين",
  "ice": "002154789012345",
  "ifNumber": "12345678",
  "rcNumber": "RC/TLN/2020/0042",
  "email": "contact@coop-safran-taliouine.ma",
  "phone": "+212661234567",
  "regionCode": "DRAA_TAFILALET",
  "city": "Taliouine",
  "presidentName": "Fatima Ait Brahim",
  "status": "active",
  "productTypes": ["SAFFRON"]
}
```

---

## Step 2.2 — Add a Member

```http
POST /cooperatives/coop-uuid-001/members
Authorization: Bearer {fatima_token}
Content-Type: application/json

{
  "fullName": "Hassan Oubella",
  "fullNameAr": "حسن أوبيلة",
  "cin": "J123456",
  "phone": "+212662345678",
  "email": "hassan@coop-safran.ma",
  "role": "member"
}
```

**Response:** Member entity with `id: member-uuid-hassan`.

> **Kafka event fired:** `cooperative.member.added`

---

## Step 2.3 — Register a Farm (with GPS)

```http
POST /cooperatives/coop-uuid-001/farms
Authorization: Bearer {fatima_token}
Content-Type: application/json

{
  "name": "Parcelle Nord Taliouine — Lot 3",
  "areaHectares": 2.5,
  "cropTypes": ["SAFFRON"],
  "regionCode": "DRAA_TAFILALET",
  "commune": "Taliouine",
  "latitude": 30.5321,
  "longitude": -7.9241
}
```

**Response:**

```json
{
  "id": "farm-uuid-001",
  "name": "Parcelle Nord Taliouine — Lot 3",
  "location": "POINT(-7.9241 30.5321)",
  "areaHectares": "2.5000"
}
```

> GPS stored as PostGIS `geography(Point, 4326)`. Coordinates validated to fall within DRAA_TAFILALET region bounding box.

---

## Step 2.4 — Update Cooperative Profile

```http
PUT /cooperatives/coop-uuid-001
Authorization: Bearer {fatima_token}
Content-Type: application/json

{
  "email": "fatima@coop-safran-taliouine.ma",
  "phone": "+212661234567",
  "address": "Douar Ait Ouagane, Taliouine, Souss-Massa, 83300"
}
```

---

## Step 2.5 — View My Certifications

```http
GET /certifications/my
Authorization: Bearer {fatima_token}
```

**Response:** Paginated list of all certifications belonging to `coop-uuid-001`.

---

## Step 2.6 — Update Notification Preferences

```http
PUT /notifications/preferences/me
Authorization: Bearer {fatima_token}
Content-Type: application/json

{ "channel": "sms", "isEnabled": true }
```

---

**Scenario 2 Complete — Fatima has:** a verified cooperative profile, one registered member (Hassan), one GPS-mapped farm, SMS notifications enabled.

---

---

# SCENARIO 3 — COOPERATIVE-MEMBER: Harvest & Batch Logging

**Persona:** Hassan · Role: `cooperative-member`
**Goal:** Log a saffron harvest, create a production batch, add processing steps.
**Pre-condition:** Fatima has registered Hassan (Scenario 2). Farm `farm-uuid-001` exists.

---

## Step 3.1 — Log a Harvest

```http
POST /harvests
Authorization: Bearer {hassan_token}
Content-Type: application/json

{
  "farmId": "farm-uuid-001",
  "productTypeCode": "SAFFRON",
  "quantityKg": 12.5,
  "harvestDate": "2025-10-28",
  "campaignYear": "2025/2026",
  "method": "Cueillette manuelle des pistils — récolte à l'aube",
  "metadata": {
    "pickerCount": 8,
    "weatherCondition": "sunny",
    "altitudeM": 1650
  }
}
```

**Response:**

```json
{
  "id": "harvest-uuid-001",
  "farmId": "farm-uuid-001",
  "productTypeCode": "SAFFRON",
  "quantityKg": "12.50",
  "harvestDate": "2025-10-28",
  "campaignYear": "2025/2026",
  "method": "Cueillette manuelle des pistils — récolte à l'aube"
}
```

> **Campaign year** is auto-computed: harvest date October 28 → `2025/2026` (October = start of new campaign). Validated by `HarvestService.computeCampaignYear()`.

---

## Step 3.2 — Create a Production Batch

```http
POST /batches
Authorization: Bearer {hassan_token}
Content-Type: application/json

{
  "harvestIds": ["harvest-uuid-001"],
  "totalQuantityKg": 12.5
}
```

**Response:**

```json
{
  "id": "batch-uuid-001",
  "batchNumber": "BATCH-SAFFRON-2025-001",
  "cooperativeId": "coop-uuid-001",
  "productTypeCode": "SAFFRON",
  "totalQuantityKg": "12.50",
  "status": "created",
  "processingDate": "2025-10-29"
}
```

> **Kafka event fired:** `product.batch.created`

---

## Step 3.3 — Add Processing Steps

```http
POST /batches/batch-uuid-001/processing-steps
Authorization: Bearer {hassan_token}
Content-Type: application/json

{
  "stepType": "DRYING",
  "doneAt": "2025-10-29T08:00:00Z",
  "notes": "Séchage à l'ombre pendant 3 jours — humidité ambiante 42%"
}
```

Repeat for additional steps (SORTING, PACKAGING):

```http
POST /batches/batch-uuid-001/processing-steps
Authorization: Bearer {hassan_token}

{
  "stepType": "SORTING",
  "doneAt": "2025-11-01T09:00:00Z",
  "notes": "Tri manuel — sélection Grade 1 uniquement, couleur rouge >80%"
}
```

```http
POST /batches/batch-uuid-001/processing-steps
Authorization: Bearer {hassan_token}

{
  "stepType": "PACKAGING",
  "doneAt": "2025-11-02T14:00:00Z",
  "notes": "Conditionnement en sachets hermétiques 1g — ref PKG-SAF-001"
}
```

---

## Step 3.4 — View Processing History

```http
GET /batches/batch-uuid-001/processing-steps
Authorization: Bearer {hassan_token}
```

**Response:** Ordered append-only log of all steps. Steps are immutable — no update/delete.

---

**Scenario 3 Complete — Hassan has:** logged 12.5 kg saffron harvest with GPS-linked farm, created batch `BATCH-SAFFRON-2025-001`, documented 3 processing steps (DRYING → SORTING → PACKAGING).

---

---

# SCENARIO 4 — LAB TECHNICIAN: Lab Test Submission & Results

**Persona:** Dr. Amina · Role: `lab-technician`
**Goal:** Receive a lab test assignment, record ISO 3632 analysis results, upload PDF report.
**Pre-condition:** Batch `batch-uuid-001` exists. Lab `ONSSA-LAB-AGD-007` is accredited (Scenario 1). Fatima submitted the lab test (Step 4.1).

---

## Step 4.1 — Submit Lab Test (by Fatima, cooperative-admin)

```http
POST /lab-tests
Authorization: Bearer {fatima_token}
Content-Type: application/json

{
  "batchId": "batch-uuid-001",
  "laboratoryId": "lab-uuid-001",
  "expectedResultDate": "2025-11-15"
}
```

**Response:**

```json
{
  "id": "labtest-uuid-001",
  "batchId": "batch-uuid-001",
  "laboratoryId": "lab-uuid-001",
  "status": "submitted",
  "submittedAt": "2025-11-03T10:00:00Z",
  "expectedResultDate": "2025-11-15"
}
```

> **Kafka event fired:** `lab.test.submitted`
> **Notification sent:** Dr. Amina receives email: _"New lab test assignment — Batch BATCH-SAFFRON-2025-001."_

---

## Step 4.2 — View Assigned Tests (Dr. Amina)

```http
GET /lab-tests?laboratoryId=lab-uuid-001&status=submitted
Authorization: Bearer {amina_token}
```

**Response:** Paginated list of lab tests assigned to Dr. Amina's accredited lab.

---

## Step 4.3 — Record Lab Analysis Results

```http
POST /lab-tests/labtest-uuid-001/results
Authorization: Bearer {amina_token}
Content-Type: application/json

{
  "testValues": {
    "crocin_e440": 247,
    "safranal_e330": 34,
    "picrocrocin_e257": 82,
    "moisture_pct": 8.5,
    "ash_total_pct": 5.2
  },
  "technicianName": "Dr. Amina Benali"
}
```

**Response:**

```json
{
  "id": "labtestresult-uuid-001",
  "labTestId": "labtest-uuid-001",
  "passed": true,
  "testValues": {
    "crocin_e440": 247,
    "safranal_e330": 34,
    "picrocrocin_e257": 82,
    "moisture_pct": 8.5,
    "ash_total_pct": 5.2
  },
  "failedParameters": [],
  "completedAt": "2025-11-12T14:30:00Z"
}
```

> **Pass/fail evaluation (ISO 3632 thresholds for saffron):**
>
> - Crocin ≥ 190 → 247 ✅
> - Safranal 20–50 → 34 ✅
> - Picrocrocin ≥ 70 → 82 ✅
> - Moisture ≤ 12% → 8.5% ✅
> - Ash ≤ 8% → 5.2% ✅
>
> **All parameters pass → `passed: true`**
>
> **Kafka event fired:** `lab.test.completed`
> **Batch status updated:** `lab-passed`
> **Notification sent:** Fatima receives SMS + email: _"Résultats labo reçus — Lot BATCH-SAFFRON-2025-001 : CONFORME."_

---

## Step 4.4 — Upload PDF Lab Report

```http
POST /lab-tests/labtest-uuid-001/report
Authorization: Bearer {amina_token}
Content-Type: multipart/form-data

file=@ISO3632_analysis_BATCH_SAFFRON_2025_001.pdf
```

**Response:** `{ "reportS3Key": "lab-reports/2025/labtest-uuid-001.pdf", "reportFileName": "ISO3632_analysis..." }`

> Maximum file size: 20 MB. Stored in MinIO S3-compatible object storage.

---

## Step 4.5 — Download Report (verification)

```http
GET /lab-tests/labtest-uuid-001/report
Authorization: Bearer {amina_token}
```

**Response:** PDF file download (presigned URL redirect to MinIO).

---

**Scenario 4 Complete — Dr. Amina has:** confirmed receipt of the sample, recorded all 5 ISO 3632 parameters (all passing), uploaded the signed PDF lab report. Batch is now `lab-passed`.

---

---

# SCENARIO 5 — INSPECTOR: Field Inspection & Report

**Persona:** Youssef · Role: `inspector`
**Goal:** Accept field assignment, conduct inspection, file immutable report.
**Pre-condition:** Certification request submitted (Step 6.2). Omar assigned Youssef (Step 6.3). Inspection `insp-uuid-001` is in `scheduled` status.

---

## Step 5.1 — View My Assigned Inspections

```http
GET /inspections/my
Authorization: Bearer {youssef_token}
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "insp-uuid-001",
      "certificationId": "cert-uuid-001",
      "cooperativeId": "coop-uuid-001",
      "scheduledDate": "2025-11-20",
      "farmIds": ["farm-uuid-001"],
      "status": "scheduled",
      "cooperativeName": "Coopérative Safran Taliouine"
    }
  ]
}
```

---

## Step 5.2 — Start Field Visit

```http
POST /certifications/cert-uuid-001/start-inspection
Authorization: Bearer {youssef_token}
```

**Response:** Certification status advances to `INSPECTION_IN_PROGRESS`.

---

## Step 5.3 — File Inspection Report

```http
PATCH /inspections/insp-uuid-001/report
Authorization: Bearer {youssef_token}
Content-Type: application/json

{
  "passed": true,
  "summary": "Visite terrain effectuée le 20/11/2025. Parcelle Lot 3 conforme. Pratiques de cueillette respectent le cahier des charges IGP. Aucune non-conformité critique détectée.",
  "farmFindings": [
    {
      "farmId": "farm-uuid-001",
      "findings": "Zone de récolte délimitée, altitude 1650m conforme à la zone IGP Drâa-Tafilalet. Cueillette manuelle vérifiée — aucun équipement mécanique détecté.",
      "passed": true
    }
  ],
  "nonConformities": []
}
```

**Response:**

```json
{
  "id": "insp-report-uuid-001",
  "inspectionId": "insp-uuid-001",
  "passed": true,
  "summary": "Visite terrain effectuée...",
  "completedAt": "2025-11-20T16:45:00Z"
}
```

> **Report is immutable** — no update endpoint. UUID-timestamped and GPS-confirmed at submission.
> **Kafka event fired:** `certification.inspection.completed`
> **Certification status advances to:** `INSPECTION_COMPLETE`
> **Notification sent:** Omar (certification-body) receives email: _"Rapport d'inspection déposé — Dossier cert-uuid-001 : CONFORME."_

---

## Step 5.4 — View Inspection Details

```http
GET /inspections/insp-uuid-001
Authorization: Bearer {youssef_token}
```

**Response:** Full inspection with report, farm findings, non-conformities list, timestamps.

---

**Scenario 5 Complete — Youssef has:** confirmed his assignment, opened the field visit, filed a complete passing inspection report with farm-level findings. The report is permanently timestamped and cannot be altered.

---

---

# SCENARIO 6 — CERTIFICATION BODY: Full Decision Workflow

**Persona:** Omar · Role: `certification-body`
**Goal:** Process a certification from request through grant, generate QR code, issue certificate.
**Pre-condition:** Batch `batch-uuid-001` is `lab-passed`. Cooperative is `active`.

---

## Step 6.1 — Fatima Requests Certification

```http
POST /certifications/request
Authorization: Bearer {fatima_token}
Content-Type: application/json

{
  "batchId": "batch-uuid-001",
  "certificationType": "IGP"
}
```

**Response:**

```json
{
  "id": "cert-uuid-001",
  "cooperativeId": "coop-uuid-001",
  "batchId": "batch-uuid-001",
  "certificationType": "IGP",
  "currentStatus": "SUBMITTED",
  "requestedAt": "2025-11-13T09:00:00Z"
}
```

> **Kafka event fired:** `certification.requested`
> **Notification sent:** Omar receives email: _"Nouvelle demande de certification — Dossier cert-uuid-001."_

---

## Step 6.2 — Start Document Review

```http
POST /certifications/cert-uuid-001/start-review
Authorization: Bearer {omar_token}
```

**Response:** Status → `DOCUMENT_REVIEW`

---

## Step 6.3 — Schedule Inspection

```http
POST /certifications/cert-uuid-001/schedule-inspection
Authorization: Bearer {omar_token}
Content-Type: application/json

{
  "inspectorId": "youssef-user-uuid",
  "scheduledDate": "2025-11-20",
  "farmIds": ["farm-uuid-001"]
}
```

**Response:** Creates `insp-uuid-001`. Status → `INSPECTION_SCHEDULED`.

> **Kafka event fired:** `certification.inspection.scheduled`
> **Notifications sent:** Youssef (inspector) + Fatima (cooperative-admin) receive SMS + email with date and address.

---

## Step 6.4 — Request Lab Testing (if not yet done)

```http
POST /certifications/cert-uuid-001/request-lab
Authorization: Bearer {omar_token}
```

**Response:** Status → `LAB_TESTING`

---

## Step 6.5 — Start Final Review (after inspection + lab both complete)

```http
POST /certifications/cert-uuid-001/start-final-review
Authorization: Bearer {omar_token}
```

**Response:** Status → `UNDER_REVIEW`

---

## Step 6.6 — Grant Certification

```http
PATCH /certifications/cert-uuid-001/grant
Authorization: Bearer {omar_token}
Content-Type: application/json

{
  "validityDays": 365
}
```

**Response:**

```json
{
  "id": "cert-uuid-001",
  "certificationNumber": "TERROIR-IGP-DRAA_TAFILALET-2025-0001",
  "currentStatus": "GRANTED",
  "grantedAt": "2025-11-25T11:00:00Z",
  "validFrom": "2025-11-25",
  "validUntil": "2026-11-25"
}
```

> **Sequential number** generated atomically via `certification_seq` table (`UPDATE … RETURNING`). No two certifications ever share a number.
> **QR code auto-generated** (HMAC-SHA256 signed, `isActive: true`).
> **Kafka events fired:** `certification.decision.granted`, `certification.qrcode.generated`
> **Notifications:** Fatima receives SMS + email with certification number and QR download link.

---

## Step 6.7 — Download Trilingual PDF Certificate

```http
GET /certifications/cert-uuid-001/certificate.pdf
Authorization: Bearer {omar_token}
```

**Response:** PDF download containing:

- Certification number in header
- Cooperative details (name, ICE, region)
- Batch details (quantity, campaign year)
- Lab test summary (key parameters)
- Validity dates
- Official stamp area
- QR code embedded
- Full trilingual text: French · Arabic · Tifinagh

---

## Step 6.8 — Generate / Download QR Code

```http
GET /qr-codes/cert-uuid-001/download?format=png
Authorization: Bearer {fatima_token}
```

**Response:** PNG image (or SVG with `?format=svg`) — ready to print on label/packaging.

---

## Step 6.9 — View Certification Analytics

```http
GET /certifications/analytics?year=2025
Authorization: Bearer {omar_token}
```

**Response:** Certification counts grouped by region and product type.

---

## Step 6.10 — Deny a Certification (alternative flow)

```http
PATCH /certifications/cert-uuid-002/deny
Authorization: Bearer {omar_token}
Content-Type: application/json

{
  "reason": "Paramètre picrocrocine en dessous du seuil minimum IGP (valeur mesurée: 62, seuil: 70). Dossier incomplet — rapport d'inspection manquant pour la parcelle Sud."
}
```

> **Kafka event fired:** `certification.decision.denied`
> **Notification:** Fatima receives SMS + email with denial reason and instructions for resubmission.

---

## Step 6.11 — Revoke a Granted Certification

```http
PATCH /certifications/cert-uuid-003/revoke
Authorization: Bearer {omar_token}
Content-Type: application/json

{
  "reason": "Contrôle de marché : échantillon prélevé en distribution ne correspond pas aux paramètres certifiés. Fraude suspectée — ouverture d'enquête ONSSA."
}
```

> **QR code deactivated immediately** — `isActive: false`. All future scans of the QR return `valid: false`.
> **Kafka event fired:** `certification.revoked`
> **Notification:** Fatima receives urgent email + SMS.

---

**Scenario 6 Complete — Omar has:** processed a full certification lifecycle (submitted → review → inspection → lab → final review → grant), issued a sequential certification number, generated a QR-signed certificate, and downloaded the trilingual PDF.

---

---

# SCENARIO 7 — CUSTOMS AGENT: Export Documentation

**Persona:** Leila · Role: `customs-agent`
**Goal:** Process an export documentation request, validate clearance for EU shipment.
**Pre-condition:** Certification `cert-uuid-001` is `GRANTED`.

---

## Step 7.1 — Fatima Requests Export Document

```http
POST /export-documents
Authorization: Bearer {fatima_token}
Content-Type: application/json

{
  "certificationId": "cert-uuid-001",
  "destinationCountry": "DE",
  "hsCode": "09102000",
  "quantityKg": 10.0,
  "consigneeName": "Gewürzhaus GmbH",
  "consigneeCountry": "DE"
}
```

**Response:**

```json
{
  "id": "exportdoc-uuid-001",
  "certificationId": "cert-uuid-001",
  "destinationCountry": "DE",
  "hsCode": "09102000",
  "quantityKg": "10.00",
  "consigneeName": "Gewürzhaus GmbH",
  "status": "draft",
  "requestedAt": "2025-11-26T08:00:00Z"
}
```

> **Kafka event fired:** `export.document.requested`
> **Notification sent:** Leila receives email: _"Nouvelle demande de document d'export — Dossier exportdoc-uuid-001."_

---

## Step 7.2 — Leila Reviews Pending Documents

```http
GET /export-documents?status=draft
Authorization: Bearer {leila_token}
```

---

## Step 7.3 — View Export Document Details

```http
GET /export-documents/exportdoc-uuid-001
Authorization: Bearer {leila_token}
```

**Response:** Full export document with certification reference, HS code, destination, consignee, quantities.

---

## Step 7.4 — Validate Export Clearance

```http
POST /export-documents/exportdoc-uuid-001/validate
Authorization: Bearer {leila_token}
```

**Response:**

```json
{
  "id": "exportdoc-uuid-001",
  "status": "approved",
  "validUntil": "2026-01-26",
  "validatedAt": "2025-11-26T14:00:00Z"
}
```

> **Kafka event fired:** `export.document.validated`
> **Notification:** Fatima receives email: _"Document d'export approuvé — expédition autorisée vers l'Allemagne."_

---

## Step 7.5 — Download Export Certificate PDF

```http
GET /export-documents/exportdoc-uuid-001/certificate.pdf
Authorization: Bearer {leila_token}
```

**Response:** PDF export certificate including:

- Certification number
- HS code (09102000 — Saffron, not further worked)
- Destination and consignee
- Quantity (kg)
- Validity window
- Official certification authority stamp area

---

## Step 7.6 — View HS Codes

```http
GET /export-documents/hs-codes
Authorization: Bearer {leila_token}
```

**Response:** All HS codes mapped to product types (e.g., `09102000` → Saffron, `1515 30` → Argan oil).

---

## Step 7.7 — Export Clearances Report (CSV)

```http
GET /export-documents/clearances-report?from=2025-11-01&to=2025-11-30&destinationCountry=DE
Authorization: Bearer {leila_token}
```

**Response:** CSV file download:

```
certification_number,product_type,destination,quantity_kg,status,date
TERROIR-IGP-DRAA_TAFILALET-2025-0001,SAFFRON,DE,10.00,approved,2025-11-26
```

---

**Scenario 7 Complete — Leila has:** reviewed the export request, validated customs clearance for Germany, downloaded the official export certificate PDF, and generated a monthly CSV clearances report.

---

---

# SCENARIO 8 — CONSUMER: Public QR Verification

**Persona:** Yuki Tanaka · Role: none (public endpoint — no authentication)
**Goal:** Scan a QR code on a jar of saffron and verify its authenticity from Paris.
**Pre-condition:** QR code for `cert-uuid-001` is active. Yuki has no Terroir.ma account.

---

## Step 8.1 — Scan QR Code (simulated as HTTP call)

Yuki scans the QR code on the label. Her browser navigates to:

```http
GET /verify/hmac-signature-abc123def456...
```

No `Authorization` header needed.

---

## Step 8.2 — Default Response (French)

```json
{
  "valid": true,
  "certification": {
    "certificationNumber": "TERROIR-IGP-DRAA_TAFILALET-2025-0001",
    "productTypeCode": "SAFFRON",
    "cooperativeName": "Coopérative Safran Taliouine",
    "regionCode": "DRAA_TAFILALET",
    "currentStatus": "GRANTED",
    "certificationType": "IGP",
    "validFrom": "2025-11-25",
    "validUntil": "2026-11-25"
  },
  "qrCode": {
    "scansCount": 43,
    "issuedAt": "2025-11-25T11:00:00Z"
  },
  "message": "Certification valide",
  "lang": "fr",
  "rtl": false
}
```

---

## Step 8.3 — Request Arabic Response

```http
GET /verify/hmac-signature-abc123def456...?lang=ar
```

```json
{
  "valid": true,
  "message": "شهادة صحيحة",
  "lang": "ar",
  "rtl": true,
  "certification": { ... }
}
```

---

## Step 8.4 — Request Tifinagh Response

```http
GET /verify/hmac-signature-abc123def456...?lang=zgh
```

```json
{
  "valid": true,
  "message": "ⴰⵙⵖⵉⵡⵙ ⵉⵍⵉⵍⵍⵉ",
  "lang": "zgh",
  "rtl": false,
  "certification": { ... }
}
```

---

## Step 8.5 — What Happens if QR is Fake or Revoked

A counterfeit product with a fake QR code:

```http
GET /verify/fake-hmac-000000000000...
```

```json
{
  "valid": false,
  "message": "Certification introuvable ou non valide",
  "lang": "fr"
}
```

> HTTP status: **404**. No certification data returned for invalid/revoked QR codes.

---

## Step 8.6 — Performance Guarantee

> QR verification response time: **< 200ms p99** (Redis-cached result, language-neutral key, i18n applied after retrieval).

---

**Scenario 8 Complete — Yuki has:** verified the saffron QR in 1.8 seconds from Paris, seen the cooperative name, IGP certification number, and validity date — in French. Same scan, three languages available instantly. Fake QRs return 404.

---

---

# SCENARIO 9 — END-TO-END: Full Certification Journey

**Goal:** Run the complete 12-step chain in one presentation sequence. All personas participate.

| Step | Actor     | Action                                         | Result                                                            |
| ---- | --------- | ---------------------------------------------- | ----------------------------------------------------------------- |
| 1    | Khalid    | `PATCH /cooperatives/:id/verify`               | Cooperative → `active`                                            |
| 2    | Khalid    | `POST /labs/:id/accredit`                      | Lab → `isAccredited: true`                                        |
| 3    | Fatima    | `POST /cooperatives/:id/farms`                 | Farm registered with GPS                                          |
| 4    | Fatima    | `POST /cooperatives/:id/members`               | Hassan added                                                      |
| 5    | Hassan    | `POST /harvests`                               | 12.5 kg saffron logged, campaign 2025/2026                        |
| 6    | Hassan    | `POST /batches`                                | `BATCH-SAFFRON-2025-001` created → `created`                      |
| 7    | Hassan    | `POST /batches/:id/processing-steps` ×3        | DRYING → SORTING → PACKAGING                                      |
| 8    | Fatima    | `POST /lab-tests`                              | Lab test assigned to Dr. Amina                                    |
| 9    | Dr. Amina | `POST /lab-tests/:id/results`                  | All 5 ISO 3632 params pass → `lab-passed`                         |
| 10   | Dr. Amina | `POST /lab-tests/:id/report`                   | PDF report uploaded                                               |
| 11   | Fatima    | `POST /certifications/request`                 | Cert → `SUBMITTED`                                                |
| 12   | Omar      | `POST /certifications/:id/start-review`        | Cert → `DOCUMENT_REVIEW`                                          |
| 13   | Omar      | `POST /certifications/:id/schedule-inspection` | Inspection created → `INSPECTION_SCHEDULED`                       |
| 14   | Youssef   | `POST /certifications/:id/start-inspection`    | Cert → `INSPECTION_IN_PROGRESS`                                   |
| 15   | Youssef   | `PATCH /inspections/:id/report`                | Report filed → `INSPECTION_COMPLETE`                              |
| 16   | Omar      | `POST /certifications/:id/start-final-review`  | Cert → `UNDER_REVIEW`                                             |
| 17   | Omar      | `PATCH /certifications/:id/grant`              | Cert → `GRANTED` · Number: `TERROIR-IGP-DRAA_TAFILALET-2025-0001` |
| 18   | Fatima    | `GET /qr-codes/:certId/download?format=png`    | QR code PNG printed on label                                      |
| 19   | Fatima    | `POST /export-documents`                       | Export doc → `draft`                                              |
| 20   | Leila     | `POST /export-documents/:id/validate`          | Export doc → `approved`                                           |
| 21   | Yuki      | `GET /verify/:hmac`                            | QR verified in < 2 seconds from Paris                             |

**Total Kafka events fired:** 17 across the full chain.
**Total notifications sent:** ~12 (email + SMS to relevant actors at each transition).

---

---

# SCENARIO 10 — NOTIFICATION MANAGEMENT (Super-Admin)

**Persona:** Khalid · Role: `super-admin`
**Goal:** Inspect notification delivery stats, create a trilingual template, seed templates from files.

---

## Step 10.1 — View Notification Stats

```http
GET /notifications/stats
Authorization: Bearer {khalid_token}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "total": 148,
    "sent": 141,
    "failed": 7,
    "byChannel": { "email": 120, "sms": 28 },
    "byLanguage": { "fr-MA": 95, "ar-MA": 40, "zgh": 13 }
  }
}
```

---

## Step 10.2 — List All Templates

```http
GET /notification-templates?channel=email&language=fr-MA
Authorization: Bearer {khalid_token}
```

**Response:** Paginated list of all email templates in French.

---

## Step 10.3 — Create a New Template (Arabic)

```http
POST /notification-templates
Authorization: Bearer {khalid_token}
Content-Type: application/json

{
  "code": "certification-granted",
  "channel": "email",
  "language": "ar-MA",
  "subjectTemplate": "مبروك! شهادتك TERROIR رقم {{certificationNumber}} جاهزة",
  "bodyTemplate": "مرحبًا {{cooperativeName}}،\n\nشهادة SDOQ الخاصة بك تم منحها رسميًا.\n\nرقم الشهادة: {{certificationNumber}}\nنوع الشهادة: {{certificationType}}\nتاريخ الانتهاء: {{validUntil}}\n\nيمكنك تنزيل رمز QR من حسابك.\n\nفريق Terroir.ma",
  "isActive": true
}
```

---

## Step 10.4 — Update a Template

```http
PUT /notification-templates/{templateId}
Authorization: Bearer {khalid_token}
Content-Type: application/json

{
  "bodyTemplate": "... updated content ...",
  "isActive": true
}
```

> Redis cache for this template code is invalidated immediately on update.

---

## Step 10.5 — Seed Templates from HBS Files

```http
POST /notification-templates/seed
Authorization: Bearer {khalid_token}
```

> Reads all `.hbs` template files bundled with the application and upserts them into the `NotificationTemplate` table. Safe to re-run — idempotent.

---

## Step 10.6 — User Views Their Notification History

```http
GET /notifications/history?page=1&limit=10
Authorization: Bearer {fatima_token}
```

**Response:** Paginated list of all notifications sent to Fatima — channel, subject, status, timestamp.

---

---

# SCENARIO 11 — ADMIN REPORTS & EXPORTS (Super-Admin + Certification Body)

**Goal:** Generate all available reports for MAPMDREF, EU compliance, and operational oversight.

---

## Step 11.1 — Certification Statistics

```http
GET /certifications/stats?year=2025
Authorization: Bearer {khalid_token}
```

**Response:** Counts by status (GRANTED, DENIED, REVOKED, PENDING) for the year.

---

## Step 11.2 — Analytics by Region and Product Type

```http
GET /certifications/analytics?year=2025
Authorization: Bearer {omar_token}
```

**Response:** Matrix of certification counts grouped by region × product type.

---

## Step 11.3 — Compliance Report (per cooperative)

```http
GET /certifications/compliance-report
Authorization: Bearer {omar_token}
```

**Response:** Per-cooperative summary — total certs, granted rate, average cycle time.

---

## Step 11.4 — ONSSA Active Certifications Report

```http
GET /certifications/onssa-report
Authorization: Bearer {khalid_token}
```

**Response:** All currently `GRANTED` or `RENEWED` certifications with validity dates — ready for ONSSA submission.

---

## Step 11.5 — Export Full Certification Registry (JSON for MAPMDREF)

```http
GET /certifications/export
Authorization: Bearer {khalid_token}
```

**Response:** JSON download of all certifications — structured for MAPMDREF official records.

---

## Step 11.6 — Export Compliance Report (CSV)

```http
GET /certifications/compliance-export
Authorization: Bearer {omar_token}
```

**Response:** CSV file — one row per cooperative, columns: name, region, total_certs, granted, denied, revoked, avg_days_to_decision.

---

## Step 11.7 — Export Product Registry (CSV)

```http
GET /products/export
Authorization: Bearer {khalid_token}
```

**Response:** CSV of all registered products with cooperative, product type, region, registration date.

---

## Step 11.8 — QR Scan Statistics per Certification

```http
GET /certifications/cert-uuid-001/scan-stats
Authorization: Bearer {khalid_token}
```

**Response:**

```json
{
  "certificationNumber": "TERROIR-IGP-DRAA_TAFILALET-2025-0001",
  "totalScans": 47,
  "scansLast30Days": 12,
  "firstScan": "2025-11-25T15:00:00Z",
  "lastScan": "2025-12-18T09:45:00Z"
}
```

---

---

# SCENARIO 12 — HEALTH & MONITORING

**Goal:** Validate platform operational status, Prometheus metrics, readiness.

---

## Step 12.1 — Liveness Check

```http
GET /health
```

```json
{ "status": "ok" }
```

> No authentication required. Returns `200 OK` if process is alive. Used by container orchestration for restart decisions.

---

## Step 12.2 — Readiness Check (includes DB)

```http
GET /ready
```

```json
{
  "status": "ok",
  "checks": {
    "postgresql": { "status": "up" }
  }
}
```

> Returns `503 Service Unavailable` if PostgreSQL is unreachable. Used by load balancers to gate traffic.

---

## Step 12.3 — Prometheus Metrics

```http
GET /metrics
```

> Returns Prometheus text format exposition — includes:
>
> - HTTP request duration histograms
> - QR verification latency (p50, p95, p99)
> - Active database connections
> - Kafka consumer lag
> - Custom business counters: `certifications_granted_total`, `qr_scans_total`, `lab_tests_completed_total`
>
> IP-gated — accessible only from monitoring network.

---

---

# QUICK REFERENCE — ALL ENDPOINTS BY ROLE

## super-admin

| Method | Endpoint                       | Purpose                                    |
| ------ | ------------------------------ | ------------------------------------------ |
| GET    | /admin/dashboard               | Platform metrics                           |
| GET    | /admin/audit-logs              | User activity log                          |
| GET    | /admin/kafka/dlq-stats         | Dead letter queue health                   |
| PATCH  | /admin/settings/\*             | Campaign, certification, platform settings |
| PATCH  | /cooperatives/:id/verify       | Approve cooperative                        |
| PUT    | /cooperatives/:id/deactivate   | Suspend cooperative                        |
| GET    | /cooperatives                  | List all cooperatives                      |
| POST   | /labs                          | Create lab                                 |
| POST   | /labs/:id/accredit             | Accredit lab                               |
| POST   | /labs/:id/revoke               | Revoke accreditation                       |
| POST   | /product-types                 | Create SDOQ product type                   |
| PUT    | /product-types/:id             | Update product type                        |
| DELETE | /product-types/:id             | Deactivate product type                    |
| PATCH  | /certifications/:id/revoke     | Revoke certification                       |
| GET    | /certifications/stats          | Certification statistics                   |
| GET    | /certifications/onssa-report   | ONSSA active certs                         |
| GET    | /certifications/export         | Full JSON export                           |
| GET    | /certifications/:id/scan-stats | QR scan stats                              |
| GET    | /notifications/stats           | Notification delivery                      |
| POST   | /notification-templates        | Create template                            |
| PUT    | /notification-templates/:id    | Update template                            |
| POST   | /notification-templates/seed   | Seed templates                             |

## cooperative-admin

| Method | Endpoint                   | Purpose               |
| ------ | -------------------------- | --------------------- |
| POST   | /cooperatives              | Register cooperative  |
| PUT    | /cooperatives/:id          | Update profile        |
| POST   | /cooperatives/:id/members  | Add member            |
| GET    | /cooperatives/:id/members  | List members          |
| POST   | /cooperatives/:id/farms    | Register farm         |
| GET    | /cooperatives/:id/farms    | List farms            |
| POST   | /lab-tests                 | Submit lab test       |
| POST   | /certifications/request    | Request certification |
| GET    | /certifications/my         | My certifications     |
| POST   | /export-documents          | Request export doc    |
| GET    | /export-documents/my       | My export docs        |
| GET    | /qr-codes/:certId/download | Download QR PNG/SVG   |

## cooperative-member

| Method | Endpoint                            | Purpose              |
| ------ | ----------------------------------- | -------------------- |
| POST   | /harvests                           | Log harvest          |
| GET    | /harvests/farm/:farmId              | Farm harvest history |
| POST   | /batches                            | Create batch         |
| GET    | /batches/:id                        | View batch           |
| POST   | /batches/:id/processing-steps       | Add step             |
| GET    | /batches/:id/processing-steps       | View steps           |
| PATCH  | /cooperatives/:id/members/:memberId | Update own profile   |

## lab-technician

| Method | Endpoint               | Purpose             |
| ------ | ---------------------- | ------------------- |
| GET    | /lab-tests             | View assigned tests |
| GET    | /lab-tests/:id         | Test details        |
| POST   | /lab-tests/:id/results | Record analysis     |
| GET    | /lab-tests/:id/result  | View result         |
| POST   | /lab-tests/:id/report  | Upload PDF report   |
| GET    | /lab-tests/:id/report  | Download PDF        |

## inspector

| Method | Endpoint                                | Purpose            |
| ------ | --------------------------------------- | ------------------ |
| GET    | /inspections/my                         | My assignments     |
| GET    | /inspections/:id                        | Inspection details |
| PATCH  | /inspections/:id/report                 | File report        |
| POST   | /certifications/:id/start-inspection    | Start field visit  |
| POST   | /certifications/:id/complete-inspection | Complete visit     |

## certification-body

| Method | Endpoint                                | Purpose             |
| ------ | --------------------------------------- | ------------------- |
| GET    | /certifications/pending                 | Pending queue       |
| GET    | /certifications                         | All certifications  |
| GET    | /certifications/analytics               | Analytics dashboard |
| GET    | /certifications/compliance-report       | Compliance data     |
| POST   | /certifications/:id/start-review        | Begin review        |
| POST   | /certifications/:id/schedule-inspection | Schedule inspection |
| POST   | /certifications/:id/request-lab         | Request lab         |
| POST   | /certifications/:id/start-final-review  | Final review        |
| PATCH  | /certifications/:id/grant               | Grant decision      |
| PATCH  | /certifications/:id/deny                | Deny decision       |
| PATCH  | /certifications/:id/revoke              | Revoke              |
| GET    | /certifications/:id/certificate.pdf     | Download PDF cert   |
| POST   | /qr-codes/:certId                       | Generate QR         |
| GET    | /qr-codes/:certId/download              | Download QR         |

## customs-agent

| Method | Endpoint                              | Purpose            |
| ------ | ------------------------------------- | ------------------ |
| GET    | /export-documents                     | All export docs    |
| GET    | /export-documents/:id                 | Document details   |
| POST   | /export-documents/:id/validate        | Validate clearance |
| GET    | /export-documents/:id/certificate.pdf | Download cert      |
| GET    | /export-documents/clearances-report   | CSV report         |
| GET    | /export-documents/hs-codes            | HS code list       |

## consumer (public — no auth)

| Method | Endpoint               | Purpose               |
| ------ | ---------------------- | --------------------- |
| GET    | /verify/:hmac          | QR verification       |
| GET    | /verify/:hmac?lang=ar  | Arabic verification   |
| GET    | /verify/:hmac?lang=zgh | Tifinagh verification |

## all authenticated users

| Method | Endpoint                      | Purpose              |
| ------ | ----------------------------- | -------------------- |
| GET    | /users/me                     | My profile           |
| GET    | /users/me/roles               | My Keycloak roles    |
| GET    | /notifications                | My notifications     |
| GET    | /notifications/history        | Notification history |
| GET    | /notifications/preferences/me | My preferences       |
| PUT    | /notifications/preferences/me | Update preferences   |
| GET    | /health                       | Liveness             |
| GET    | /ready                        | Readiness            |

---

## Lab Test Parameter Reference

### Saffron (SAFFRON) — IGP — Drâa-Tafilalet

| Parameter                 | Unit | Threshold |
| ------------------------- | ---- | --------- |
| Crocin (E1% @ 440nm)      | E1%  | ≥ 190     |
| Safranal (E1% @ 330nm)    | E1%  | 20 – 50   |
| Picrocrocin (E1% @ 257nm) | E1%  | ≥ 70      |
| Moisture                  | %    | ≤ 12.0    |
| Total ash                 | %    | ≤ 8.0     |

### Argan Oil — AOP — Souss-Massa

| Parameter              | Unit      | Threshold   |
| ---------------------- | --------- | ----------- |
| Acidity (% oleic acid) | %         | ≤ 4.0       |
| Peroxide value         | meq O₂/kg | ≤ 20.0      |
| Moisture               | %         | ≤ 0.2       |
| Oleic acid (C18:1)     | %         | 43.0 – 49.9 |
| Total tocopherols      | mg/kg     | 600 – 900   |

### Olive Oil (Picholine) — AOP — Multiple regions

| Parameter         | Unit      | Threshold |
| ----------------- | --------- | --------- |
| Acidity           | %         | ≤ 0.8     |
| Peroxide value    | meq O₂/kg | ≤ 20.0    |
| Total polyphenols | mg/kg     | ≥ 100     |
| K232              | abs       | ≤ 2.50    |
| K270              | abs       | ≤ 0.22    |

### Honey (Euphorbe de Jebli) — IGP — Tanger-Tétouan

| Parameter          | Unit         | Threshold |
| ------------------ | ------------ | --------- |
| Moisture           | %            | ≤ 20.0    |
| HMF                | mg/kg        | ≤ 40      |
| Diastase activity  | Schade units | ≥ 8       |
| Sucrose            | %            | ≤ 5.0     |
| Fructose + Glucose | %            | ≥ 60.0    |

### Medjoul Dates — AOP — Drâa-Tafilalet

| Parameter            | Unit | Threshold |
| -------------------- | ---- | --------- |
| Moisture             | %    | ≤ 25.0    |
| Total sugars         | %    | ≥ 55.0    |
| Flesh-to-seed ratio  | —    | ≥ 9.0     |
| Average fruit weight | g    | ≥ 18.0    |

### Dades Rose — IGP — Drâa-Tafilalet

| Parameter                     | Unit     | Threshold       |
| ----------------------------- | -------- | --------------- |
| Geraniol (% essential oil)    | %        | ≥ 10.0          |
| Citronellol (% essential oil) | %        | ≥ 18.0          |
| Nonadecane                    | presence | must be present |
| Moisture (dried petals)       | %        | ≤ 12.0          |

---

## Certification State Machine

```
DRAFT
  └─→ SUBMITTED
        └─→ DOCUMENT_REVIEW
              ├─→ INSPECTION_SCHEDULED
              │     └─→ INSPECTION_IN_PROGRESS
              │           └─→ INSPECTION_COMPLETE
              ├─→ LAB_TESTING
              │     └─→ LAB_RESULTS_RECEIVED
              └─→ UNDER_REVIEW
                    ├─→ GRANTED ──→ RENEWED
                    ├─→ DENIED
                    └─→ REVOKED
```

---

## Kafka Events Reference

| Event                              | Fired by             | Consumed by           | Payload highlights                  |
| ---------------------------------- | -------------------- | --------------------- | ----------------------------------- |
| cooperative.registration.submitted | Cooperative          | Notification          | cooperativeId, name                 |
| cooperative.registration.verified  | Super-admin          | Notification          | cooperativeId, verifiedAt           |
| cooperative.registration.rejected  | Super-admin          | Notification          | cooperativeId, reason               |
| cooperative.member.added           | Cooperative-admin    | Notification          | cooperativeId, memberId             |
| product.registered                 | Cooperative-admin    | —                     | productId, cooperativeId            |
| product.batch.created              | Cooperative-member   | —                     | batchId, productTypeCode            |
| lab.test.submitted                 | Cooperative-admin    | Notification          | labTestId, batchId                  |
| lab.test.completed                 | Lab-technician       | Product, Notification | labTestId, passed, parameters       |
| certification.requested            | Cooperative-admin    | Notification          | certificationId, batchId            |
| certification.inspection.scheduled | Certification-body   | Notification          | inspectionId, inspectorId, date     |
| certification.inspection.completed | Inspector            | Notification          | inspectionId, passed                |
| certification.decision.granted     | Certification-body   | QrCode, Notification  | certificationId, number, validUntil |
| certification.decision.denied      | Certification-body   | Notification          | certificationId, reason             |
| certification.revoked              | Certification-body   | QrCode, Notification  | certificationId, reason             |
| certification.qrcode.generated     | QrCode service       | Notification          | certificationId, verifyUrl          |
| export.document.requested          | Cooperative-admin    | Notification          | exportDocId, destination            |
| export.document.validated          | Customs-agent        | Notification          | exportDocId, validUntil             |
| notification.sent                  | Notification service | —                     | notificationId, channel (no PII)    |

> All events carry: `eventId` (UUID), `correlationId` (UUID), `version`, `timestamp` (ISO 8601).
> No PII (names, emails, phone numbers, CIN) in any Kafka payload.

---

_Terroir.ma · User Manual v1.0 · April 2026 · Sprint 1 + 2 Complete_
_104 endpoints · 9 roles · 12-step workflow · 18 Kafka events · 22 entity types_
