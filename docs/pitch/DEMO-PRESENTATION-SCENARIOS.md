# Terroir.ma — Live Demo Script

### End-of-Pitch Presentation · Use-Case Walkthrough · April 2026

> **Purpose:** This is the live demonstration script to run at the end of the pitch presentation.
> It follows a single continuous story — from a cooperative's first registration to a buyer in Paris
> scanning a QR code in under 2 seconds. Each act is self-contained and can be shown individually
> or chained into one uninterrupted 8-minute demo.

---

## Demo Narrative in One Sentence

> _A saffron cooperative in Taliouine gets certified under Moroccan law, and a buyer in Paris
> verifies it — without making a single phone call — in 1.8 seconds._

---

## Pre-Demo Checklist

Before taking the stage, verify:

| #   | Check                                                            | Command                                                    |
| --- | ---------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | Docker stack running                                             | `docker compose --profile full up -d`                      |
| 2   | API healthy                                                      | `curl http://localhost:3000/health` → `{ "status": "ok" }` |
| 3   | Database migrations applied                                      | `npm run db:migrate`                                       |
| 4   | Keycloak realm imported                                          | `npm run keycloak:setup`                                   |
| 5   | Product types seeded                                             | `GET /product-types` → list not empty                      |
| 6   | REST Client open (VS Code or Insomnia)                           | `test/http/terroir-scenarios.http`                         |
| 7   | Phone or browser tab open at `http://localhost:3000/verify/{qr}` | —                                                          |

**Expected total demo time:** 7–10 minutes.
**Audience:** Investors · MAPMDREF officials · EU buyers · Technical partners.

---

## Cast of Characters

| Persona          | Role                  | What they represent                      |
| ---------------- | --------------------- | ---------------------------------------- |
| 🔑 **Khalid**    | `super-admin`         | Government oversight — MAPMDREF          |
| 🌿 **Fatima**    | `cooperative-admin`   | 28-member saffron cooperative, Taliouine |
| 🧑‍🌾 **Hassan**    | `cooperative-member`  | Field farmer, Fatima's cooperative       |
| 🔬 **Dr. Amina** | `lab-technician`      | ONSSA-accredited chemist, Agadir         |
| 📋 **Youssef**   | `inspector`           | MAPMDREF field inspector                 |
| ✅ **Omar**      | `certification-body`  | Direction SDOQ officer                   |
| 🛳️ **Leila**     | `customs-agent`       | EACCE officer, Casablanca Port           |
| 🌍 **Yuki**      | consumer (no account) | EU sourcing manager, Paris               |

---

---

# ACT 1 — THE PLATFORM IS READY

**Persona:** 🔑 Khalid — `super-admin`
**Duration:** ~90 seconds
**Message to audience:** _"The government has full visibility. Real-time. No spreadsheets."_

---

### Scene 1.1 — Khalid logs in and sees the platform dashboard

**What you do:**

```http
GET /admin/dashboard
Authorization: Bearer {khalid_token}
```

**What the audience sees:**

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

**What you say:**

> _"Before Terroir.ma, a ministry officer needed to call every cooperative, every lab,
> every inspector to get numbers like these. Now it's one API call. Cached every 5 minutes.
> MAPMDREF sees this on their dashboard before their morning coffee."_

---

### Scene 1.2 — Khalid sees Fatima's cooperative pending approval

**What you do:**

```http
GET /cooperatives?status=pending
Authorization: Bearer {khalid_token}
```

**What the audience sees:**

```json
{
  "data": [
    {
      "id": "coop-uuid-001",
      "name": "Coopérative Safran Taliouine",
      "nameAr": "تعاونية زعفران تالوين",
      "ice": "002154789012345",
      "regionCode": "DRAA_TAFILALET",
      "presidentName": "Fatima Ait Brahim",
      "presidentCin": "F123456",
      "status": "pending",
      "productTypes": ["SAFFRON"],
      "createdAt": "2025-11-02T09:14:00Z"
    }
  ]
}
```

**What you say:**

> _"Fatima registered this morning from her phone in Taliouine.
> Her cooperative's ICE number, her CIN, her product type — all validated on entry.
> No PDF. No office visit. 15 minutes to register a cooperative that used to take weeks."_

---

### Scene 1.3 — Khalid verifies the cooperative with one API call

**What you do:**

```http
PATCH /cooperatives/coop-uuid-001/verify
Authorization: Bearer {khalid_token}
```

**What the audience sees:**

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

**What you say:**

> _"One PATCH request. Fatima's cooperative is active.
> At this exact moment — right now, in the background — the platform fires a Kafka event.
> Fatima receives an SMS and an email simultaneously. In French. Or Arabic. Her preference."_

> **Point at the terminal where Kafka events are streaming:**
> `cooperative.registration.verified → notification-group → SMS + Email queued`

---

---

# ACT 2 — THE COOPERATIVE IN ACTION

**Personas:** 🌿 Fatima · 🧑‍🌾 Hassan
**Duration:** ~90 seconds
**Message to audience:** _"GPS-traced. Timestamped. Immutable from the first gram."_

---

### Scene 2.1 — Fatima maps a farm with GPS coordinates

**What you do:**

```http
POST /cooperatives/coop-uuid-001/farms
Authorization: Bearer {fatima_token}

{
  "name": "Parcelle Nord Taliouine — Lot 7",
  "areaHectares": 3.2,
  "cropTypes": ["SAFFRON"],
  "regionCode": "DRAA_TAFILALET",
  "commune": "Taliouine",
  "latitude": 30.5321,
  "longitude": -7.9241
}
```

**What the audience sees:**

```json
{
  "success": true,
  "data": {
    "id": "farm-uuid-001",
    "name": "Parcelle Nord Taliouine — Lot 7",
    "areaHectares": 3.2,
    "location": { "type": "Point", "coordinates": [-7.9241, 30.5321] },
    "regionCode": "DRAA_TAFILALET"
  }
}
```

**What you say:**

> _"This farm now has a GPS fingerprint in the database — PostGIS geography type, WGS 84.
> Every harvest from this farm carries these exact coordinates.
> An EU inspector sitting in Brussels can verify the origin of this saffron
> without ever visiting Morocco."_

---

### Scene 2.2 — Hassan logs the harvest

**What you do:**

```http
POST /harvests
Authorization: Bearer {hassan_token}

{
  "farmId": "farm-uuid-001",
  "cooperativeId": "coop-uuid-001",
  "productTypeCode": "SAFFRON",
  "quantityKg": 12.5,
  "harvestDate": "2025-10-28",
  "campaignYear": "2025/2026",
  "method": "Cueillette manuelle des pistils au lever du soleil",
  "metadata": {
    "pickerCount": 8,
    "weatherCondition": "sunny",
    "altitudeM": 1650
  }
}
```

**What the audience sees:**

```json
{
  "success": true,
  "data": {
    "id": "harvest-uuid-001",
    "quantityKg": "12.50",
    "productTypeCode": "SAFFRON",
    "campaignYear": "2025/2026",
    "farmId": "farm-uuid-001",
    "status": "logged",
    "createdAt": "2025-10-28T06:47:00Z"
  }
}
```

**What you say:**

> _"Hassan logged this from his phone in the field at sunrise.
> 12.5 kilograms, 8 pickers, altitude 1,650 metres.
> This is not just a number — it's a legally traceable chain link.
> This harvest ID will follow these stigmas through drying, sorting, packaging,
> lab testing, and certification. Every gram is accounted for."_

---

---

# ACT 3 — SCIENCE SPEAKS

**Persona:** 🔬 Dr. Amina — `lab-technician`
**Duration:** ~60 seconds
**Message to audience:** _"ISO 3632 parameters, digitally recorded, immutable."_

---

### Scene 3.1 — Dr. Amina submits ISO 3632 saffron analysis

**What you do:**

```http
POST /lab-tests/{labTestId}/results
Authorization: Bearer {amina_token}

{
  "testValues": {
    "crocin_e440":    247,
    "safranal_e330":  34,
    "picrocrocin_e257": 82,
    "moisture_pct":   8.5,
    "ash_total_pct":  5.2
  },
  "technicianName": "Dr. Amina Benali",
  "passedValidation": true
}
```

**What the audience sees:**

```json
{
  "success": true,
  "data": {
    "id": "result-uuid-001",
    "labTestId": "labtest-uuid-001",
    "passedValidation": true,
    "testValues": {
      "crocin_e440": 247,
      "safranal_e330": 34,
      "picrocrocin_e257": 82
    },
    "technicianName": "Dr. Amina Benali",
    "recordedAt": "2025-11-10T14:22:00Z"
  }
}
```

**What you say:**

> _"Crocin 247 — that's Grade I saffron by ISO 3632. That's the world's top classification.
> Dr. Amina just recorded this result digitally, signed it with her credentials.
> It is now permanently in the certification chain. It cannot be edited. It cannot be deleted.
> This is what 'immutable audit trail' means in practice."_

---

---

# ACT 4 — THE MOMENT OF CERTIFICATION

**Personas:** 📋 Youssef · ✅ Omar
**Duration:** ~90 seconds
**Message to audience:** _"One transaction. One QR code. Permanent."_

---

### Scene 4.1 — Youssef files the inspection report

**What you do:**

```http
POST /inspections/{inspectionId}/report
Authorization: Bearer {youssef_token}

{
  "findings": "Parcelle conforme IGP Drâa-Tafilalet. Culture biologique vérifiée sur place. Pistils Grade I. Traçabilité GPS validée.",
  "recommendation": "GRANT",
  "inspectedAt": "2025-11-12T09:30:00Z"
}
```

**What the audience sees:**

```json
{
  "success": true,
  "data": {
    "id": "inspection-uuid-001",
    "recommendation": "GRANT",
    "status": "COMPLETED",
    "findings": "Parcelle conforme IGP Drâa-Tafilalet...",
    "inspectedAt": "2025-11-12T09:30:00Z"
  }
}
```

**What you say:**

> _"Youssef visited the farm. His report is now in the system — recommendation: GRANT.
> The certification body has everything they need: GPS, harvest log, lab results, inspection report.
> This is the complete paper trail, except there is no paper."_

---

### Scene 4.2 — Omar grants the certification (the atomic moment)

**What you do:**

```http
POST /certifications/{certificationId}/grant
Authorization: Bearer {omar_token}

{
  "notes": "Dossier complet. IGP Drâa-Tafilalet confirmé. Valable 12 mois.",
  "validFrom": "2025-11-15",
  "validUntil": "2026-11-15"
}
```

**What the audience sees:**

```json
{
  "success": true,
  "data": {
    "id": "cert-uuid-001",
    "certificationNumber": "TERROIR-IGP-DRAA_TAFILALET-2025-0018",
    "currentStatus": "GRANTED",
    "cooperativeName": "Coopérative Safran Taliouine",
    "productTypeCode": "SAFFRON",
    "certificationType": "IGP",
    "qrCode": "data:image/png;base64,iVBORw0KGgo...",
    "qrSecret": "hmac_signed_payload_abc123",
    "validFrom": "2025-11-15",
    "validUntil": "2026-11-15",
    "grantedAt": "2025-11-15T11:00:00Z",
    "grantedBy": "omar-user-uuid"
  }
}
```

**What you say:**

> _"Omar just granted the certification. One atomic database transaction just created:_
>
> - _A certification number: TERROIR-IGP-DRAA_TAFILALET-2025-0018_
> - _A QR code signed with HMAC-SHA256 — mathematically unforgeable_
> - _An immutable event record with timestamp and officer ID_
> - _An automatic notification to Fatima, the lab, the inspector_
>
> _That QR code — right there in the response — is ready to be printed on every jar of saffron
> that leaves Taliouine. Let me show you what happens when someone scans it."_

---

---

# ACT 5 — THE QR MIRACLE

**Persona:** 🌍 Yuki — no account required, no login, any phone
**Duration:** ~60 seconds
**Message to audience:** _"1.8 seconds. Three languages. No intermediaries."_

---

### Scene 5.1 — Yuki scans the QR code (browser or API)

> **Option A — Browser demo (most visual):**
> Open `http://localhost:3000/verify/TERROIR-IGP-DRAA_TAFILALET-2025-0018` in browser.

> **Option B — API call:**

```http
GET /certifications/verify/TERROIR-IGP-DRAA_TAFILALET-2025-0018
Accept-Language: fr
```

**What the audience sees (French response):**

```json
{
  "valid": true,
  "certificationNumber": "TERROIR-IGP-DRAA_TAFILALET-2025-0018",
  "cooperative": {
    "name": "Coopérative Safran Taliouine",
    "region": "Drâa-Tafilalet",
    "certifiedSince": "2025-11-15"
  },
  "product": {
    "type": "Safran — IGP Drâa-Tafilalet",
    "grade": "Grade I ISO 3632",
    "campaignYear": "2025/2026"
  },
  "validUntil": "2026-11-15",
  "verifiedAt": "2026-04-28T10:31:42Z",
  "responseTimeMs": 18
}
```

---

### Scene 5.2 — Same QR, Arabic response

```http
GET /certifications/verify/TERROIR-IGP-DRAA_TAFILALET-2025-0018
Accept-Language: ar
```

**What the audience sees:**

```json
{
  "valid": true,
  "certificationNumber": "TERROIR-IGP-DRAA_TAFILALET-2025-0018",
  "cooperative": {
    "name": "تعاونية زعفران تالوين",
    "region": "درعة تافيلالت",
    "certifiedSince": "2025-11-15"
  },
  "product": {
    "type": "زعفران — IGP درعة تافيلالت",
    "grade": "الدرجة الأولى ISO 3632",
    "campaignYear": "2025/2026"
  },
  "validUntil": "2026-11-15",
  "verifiedAt": "2026-04-28T10:31:43Z",
  "responseTimeMs": 22
}
```

---

### Scene 5.3 — Same QR, Amazigh/Tifinagh response

```http
GET /certifications/verify/TERROIR-IGP-DRAA_TAFILALET-2025-0018
Accept-Language: zgh
```

**What the audience sees:**

```json
{
  "valid": true,
  "certificationNumber": "TERROIR-IGP-DRAA_TAFILALET-2025-0018",
  "cooperative": {
    "name": "ⵜⴰⵡⵓⵔⵉⵡⵉⵏ ⵏ ⵓⵣⴰⴼⵔⴰⵏ ⵏ ⵜⴰⵍⵡⵉⵏ",
    "region": "ⴷⵔⵄⴰ-ⵜⴰⴼⵉⵍⴰⵍⵜ",
    "certifiedSince": "2025-11-15"
  },
  "product": {
    "type": "ⵓⵣⴰⴼⵔⴰⵏ — IGP ⴷⵔⵄⴰ-ⵜⴰⴼⵉⵍⴰⵍⵜ",
    "grade": "ⴰⵡⵜⵜⴰ ⴰⵎⵣⵡⴰⵔⵓ ISO 3632",
    "campaignYear": "2025/2026"
  },
  "validUntil": "2026-11-15",
  "verifiedAt": "2026-04-28T10:31:44Z",
  "responseTimeMs": 19
}
```

**What you say:**

> _"French. Arabic. Tifinagh — the Amazigh script. The same QR. The same certification.
> Three languages. No code change. No separate deployment. Built in from line one._
>
> _Yuki is in Paris. She has no account. She doesn't need one.
> She scanned a jar of saffron at a trade fair in Cologne and in 1.8 seconds she saw
> exactly who grew it, where, when, and that it passed ISO 3632 Grade I.
> She is signing a €80,000 purchase order tonight._
>
> _This is what we built."_

---

---

# ACT 6 — EXPORT CLEARED

**Persona:** 🛳️ Leila — `customs-agent`
**Duration:** ~45 seconds
**Message to audience:** _"From certification to export clearance — fully automated."_

---

### Scene 6.1 — Leila validates the export document

**What you do:**

```http
POST /export-documents/{exportDocId}/validate
Authorization: Bearer {leila_token}
```

**What the audience sees:**

```json
{
  "success": true,
  "data": {
    "id": "export-doc-uuid-001",
    "certificationNumber": "TERROIR-IGP-DRAA_TAFILALET-2025-0018",
    "status": "approved",
    "destinationCountry": "DE",
    "hsCode": "09102000",
    "quantityKg": 10,
    "consigneeName": "Gewürzhaus GmbH, Frankfurt",
    "validatedBy": "leila-user-uuid",
    "validatedAt": "2025-11-16T08:15:00Z",
    "clearanceNumber": "EXP-2025-MA-04721"
  }
}
```

**What you say:**

> _"Leila at Casablanca Port validates the export in one request.
> The HS code — 0910.20.00, saffron — is already on the document.
> Clearance number issued. This shipment is legal, traceable, and digitally documented
> for EU customs from the moment it leaves Morocco._
>
> _Every step you just saw — registration, harvest, lab, inspection, certification,
> QR, export — is recorded, timestamped, immutable, and tied to a single audit trail.
> If anyone ever questions this jar of saffron anywhere in the world,
> the answer is 1.8 seconds away."_

---

---

# CLOSING — WHAT YOU JUST SAW

**Duration:** ~30 seconds

---

| Step                                               | Actor             | Time                         |
| -------------------------------------------------- | ----------------- | ---------------------------- |
| Cooperative registered & verified                  | Khalid + Fatima   | 15 min (simulated in 20 sec) |
| Farm GPS-mapped                                    | Fatima            | instant                      |
| Harvest logged (12.5 kg, Grade I, altitude 1,650m) | Hassan            | instant                      |
| ISO 3632 lab results recorded                      | Dr. Amina         | instant                      |
| Inspection report filed                            | Youssef           | instant                      |
| Certification granted, QR generated                | Omar              | **1 atomic transaction**     |
| QR verified in French / Arabic / Tifinagh          | Yuki (no account) | **1.8 seconds**              |
| Export document cleared                            | Leila             | instant                      |

---

> **From soil to QR. Every gram traced. Every step verified. Three languages. One platform.**
>
> _"De la terre au QR code. Prouvé."_
> _"من الأرض للكود. مثبت."_
> _"ⵙⴳ ⵜⴰⵍⵍⴰ ⵙ QR. ⵢⴻⵜⵜⵓⵙⵏⵎⵓⵔ."_

---

---

# APPENDIX A — Demo Cheat Sheet

## Quick Token Reference

```
Khalid     (super-admin)        → POST /token username=khalid
Fatima     (cooperative-admin)  → POST /token username=fatima
Hassan     (cooperative-member) → POST /token username=hassan
Dr. Amina  (lab-technician)     → POST /token username=amina
Youssef    (inspector)          → POST /token username=youssef
Omar       (certification-body) → POST /token username=omar
Leila      (customs-agent)      → POST /token username=leila
```

**Keycloak token endpoint:**

```http
POST http://localhost:8080/realms/terroir-ma/protocol/openid-connect/token
Content-Type: application/x-www-form-urlencoded

grant_type=password
&client_id=terroir-portal
&client_secret=terroir-portal-secret
&username={persona}
&password=Test1234!
```

## Seeded Demo IDs

| Entity               | ID / Value                             |
| -------------------- | -------------------------------------- |
| Fatima's cooperative | `coop-uuid-001`                        |
| Parcelle Nord farm   | `farm-uuid-001`                        |
| Saffron harvest      | `harvest-uuid-001`                     |
| Lab test             | `labtest-uuid-001`                     |
| Certification        | `cert-uuid-001`                        |
| Certification number | `TERROIR-IGP-DRAA_TAFILALET-2025-0018` |
| Export document      | `export-doc-uuid-001`                  |

## If Something Goes Wrong

| Symptom              | Fix                                                    |
| -------------------- | ------------------------------------------------------ |
| 401 Unauthorized     | Token expired — re-authenticate                        |
| 404 on cooperative   | Check ID — use seeded data                             |
| 500 on QR verify     | Redis not running — `docker compose up redis -d`       |
| Empty dashboard      | Migrations not applied — `npm run db:migrate`          |
| No Kafka event shown | Redpanda not running — `docker compose up redpanda -d` |

---

# APPENDIX B — Standalone Scene Cards

> Each card below can be printed and used as a presenter cue card for a specific role.

---

### CARD 1 — KHALID (Super-Admin)

```
1. GET /admin/dashboard            → "Government sees everything, real-time"
2. GET /cooperatives?status=pending → "Fatima registered this morning"
3. PATCH /cooperatives/:id/verify  → "Verified. Kafka fires. Fatima gets SMS."
4. POST /labs + POST /labs/:id/accredit → "Lab is now ONSSA-accredited in the system"
```

---

### CARD 2 — FATIMA + HASSAN (Cooperative)

```
1. POST /cooperatives/:id/farms    → "Farm is GPS-mapped. PostGIS. WGS 84."
2. POST /harvests                  → "Hassan logs 12.5 kg saffron at sunrise"
3. POST /batches                   → "Batch created. Lab test requested."
```

---

### CARD 3 — DR. AMINA (Lab)

```
1. GET /lab-tests                  → "Dr. Amina sees the test queue"
2. POST /lab-tests/:id/results     → "ISO 3632 Grade I — crocin 247, recorded forever"
```

---

### CARD 4 — YOUSSEF + OMAR (Inspection & Certification)

```
1. POST /inspections/:id/report    → "Youssef: recommendation GRANT"
2. POST /certifications/:id/grant  → "ATOMIC: cert number + QR + audit trail"
```

---

### CARD 5 — YUKI (QR Verification — the finale)

```
1. GET /certifications/verify/:number?lang=fr  → "French: 1.8s"
2. GET /certifications/verify/:number?lang=ar  → "Arabic: same QR"
3. GET /certifications/verify/:number?lang=zgh → "Tifinagh: world first"
```

---

### CARD 6 — LEILA (Customs / Export)

```
1. POST /export-documents          → "Fatima generates export doc (HS 09102000)"
2. POST /export-documents/:id/validate → "Leila clears. Shipment departs."
3. GET /certifications/export      → "Full compliance CSV for audit"
```

---

_Terroir.ma · Live Demo Script · Version 1.0 · April 2026_
_For: Investor presentations · Government briefings · EU buyer demos_
