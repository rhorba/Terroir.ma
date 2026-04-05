---
name: terroir-domain
description: Domain knowledge for Terroir.ma — Morocco's terroir product certification chain. Law 25-06 (SDOQ), certification types (IGP/AOP/Label Agricole), the 12-step workflow, entity relationships, product-specific lab parameters, QR architecture, export documentation.
---

# Terroir Domain Knowledge — Terroir.ma

## What Is a Terroir Product?
A terroir product is tied to a specific geographic origin — its quality, reputation, and characteristics are essentially attributable to that place. Morocco protects these under **Law 25-06 (SDOQ)** — Signes Distinctifs d'Origine et de Qualité.

## Certification Types
| Type | French | Arabic | Rule |
|------|--------|--------|------|
| IGP | Indication Géographique Protégée | مؤشر جغرافي محمي | At least ONE step in the defined area |
| AOP | Appellation d'Origine Protégée | تسمية المنشأ المحمية | ALL steps in the defined area |
| Label Agricole | Label Agricole | الملصق الفلاحي | Quality standard, no geographic tie |

Valid for 3 years (IGP/AOP) or 2 years (Label Agricole). Renewable.

## The 12-Step Certification Workflow
```
Step 1:  Cooperative registers               → cooperative.registration.submitted
Step 2:  Authority verifies cooperative      → cooperative.registration.verified
Step 3:  Member logs harvest                 → product.harvest.logged
Step 4:  Production batch created            → product.batch.created
Step 5:  Lab sample submitted                → lab.test.submitted
Step 6:  Lab returns results (PASS/FAIL)     → lab.test.completed
Step 7:  Certification requested (if passed) → certification.request.submitted
Step 8:  Inspection scheduled                → certification.inspection.scheduled
Step 9:  Inspector visits, files report      → certification.inspection.completed
Step 10: Certification body grants or denies → certification.decision.granted / denied
Step 11: QR code generated                   → verification.qr.generated
Step 12: Consumer scans QR                   → verification.qr.scanned
```
Each step produces an immutable Kafka event. The chain is append-only.

## Entity Relationships
```
Cooperative (1) ──── (many) Member
Cooperative (1) ──── (many) Farm [PostGIS GPS]
Farm        (1) ──── (many) Harvest
Harvest  (many) ──── (1)   ProductionBatch
ProductionBatch (1) ─ (many) LabTest
LabTest     (1) ──── (many) LabTestResult [JSONB per ProductType]
ProductionBatch (1) ─ (1)   Certification
Certification (1) ── (many) Inspection
Certification (1) ── (1)   QRCode [HMAC-SHA256]
Certification (1) ── (many) ExportDocument
```

## Product-Specific Lab Parameters

### Argan Oil (IGP — Souss-Massa)
- Acidity: ≤0.8% (oleic acid)
- Peroxide Index: ≤15 meq O₂/kg
- UV Absorption K232: ≤2.50
- UV Absorption K270: ≤0.25
- Tocopherol Content: ≥600 mg/kg

### Saffron of Taliouine (AOP — Souss-Massa)
- Crocin (E1%₁cm at 440 nm): ≥190
- Picrocrocin (E1%₁cm at 257 nm): ≥70
- Safranal (E1%₁cm at 330 nm): 20–50
- Moisture: ≤12%
- ISO 3632 Grade: I, II, or III

### Olive Oil Extra Virgin (multiple IGP regions)
- Acidity: ≤0.8% (extra virgin) / ≤2% (virgin)
- Peroxide Index: ≤20 meq O₂/kg
- Polyphenols: ≥100 mg/kg
- Organoleptic Score: ≥6.5/10

### Honey (IGP — Ida Ou Tanane, Zendaz)
- Moisture: ≤20%
- HMF: ≤40 mg/kg
- Diastase Activity: ≥8 DN
- Sucrose: ≤5%

### Dates Mejhoul (IGP — Drâa-Tafilalet)
- Moisture: ≤26%
- Total Sugars: ≥70%
- Size: Extra Large (>45 g), Large (33–45 g)

### Rose Products (IGP — Kelaat M'Gouna)
- Essential Oil Yield: ≥0.025%
- Geraniol Content: ≥65%
- Citronellol Content: ≥15%

## QR Code Architecture
- Every **granted** certification gets a QR code
- QR encodes: `https://terroir.ma/verify/{certificationUUID}`
- HMAC-SHA256 signature: `HMAC(QR_HMAC_SECRET, certificationUUID + issuedAt)`
- Verification API (public): `GET /api/v1/verify/:uuid`
  - Validates HMAC, returns full chain
  - Redis-cached for < 200 ms
  - Publishes `verification.qr.scanned` event

## Certification Number Format
`TERROIR-{TYPE}-{REGION_CODE}-{YEAR}-{SEQ}`

Examples:
- `TERROIR-IGP-SOUSS_MASSA-2025-0001`
- `TERROIR-AOP-SOUSS_MASSA-2025-0042`
- `TERROIR-LA-FES_MEKNES-2025-0007`

## Morocco's Key SDOQ Products
| Product | Type | Region |
|---------|------|--------|
| Argan Oil | IGP | Souss-Massa |
| Saffron of Taliouine | AOP | Souss-Massa |
| Olive Oil of Meknès | IGP | Fès-Meknès |
| Clementine of Berkane | IGP | Oriental |
| Dates Mejhoul of Errachidia | IGP | Drâa-Tafilalet |
| Rose of Kelaat M'Gouna | IGP | Drâa-Tafilalet |
| Honey of Ida Ou Tanane | IGP | Souss-Massa |
| Almonds of Tafraout | IGP | Souss-Massa |
| Figs of Ouezzane | IGP | Tanger-Tétouan |
| Pomegranates of Sefrou | IGP | Fès-Meknès |
| Capers of Safi | IGP | Marrakech-Safi |
