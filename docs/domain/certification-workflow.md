# Certification Workflow — Morocco Law 25-06 (SDOQ)

## Overview

Morocco's Law 25-06 (Loi n° 25-06 relative aux signes distinctifs d'origine et de qualité des denrées alimentaires et des produits agricoles et halieutiques) establishes the legal framework for protected designations of origin and quality labels for Moroccan food, agricultural, and fishery products.

### Certification Types

| Type | Full Name | Description |
|------|-----------|-------------|
| AOP | Appellation d'Origine Protégée | All production, processing, and preparation steps must occur in the defined geographical region. The product's quality and characteristics are essentially or exclusively linked to that geographical environment. |
| IGP | Indication Géographique Protégée | At least one production, processing, or preparation step must occur in the defined region. The product possesses a quality, reputation, or other characteristic attributable to that geographical origin. |
| Label Agricole (LA) | Label Agricole | Certifies that a product has a set of specific characteristics establishing a higher quality level than comparable standard products, regardless of geographical origin. |

### Governing Bodies

- **MAPMDREF** — Ministère de l'Agriculture, de la Pêche Maritime, du Développement Rural et des Eaux et Forêts. Acts as the central ministry responsible for SDOQ policy, product specification approval, and oversight of the certification chain.
- **ONSSA** — Office National de la Sécurité Sanitaire des Produits Alimentaires. Responsible for food safety enforcement, accreditation of testing laboratories, and oversight of lab analysis results.
- **EACCE** — Etablissement Autonome de Contrôle et de Coordination des Exportations. Handles export clearance and validation of export documents for SDOQ-certified products.

---

## The 12-Step Certification Workflow

### Step 1 — Cooperative Registration and Verification

A cooperative administrator submits the cooperative's legal registration details via the platform. The submission triggers:

- Creation of a `Cooperative` entity with status `pending`
- Kafka event: `cooperative.registration.submitted`

A `super-admin` user reviews the submitted documentation and either verifies or rejects the registration. Verification moves the cooperative to `verified` status and emits `cooperative.registration.verified`. Rejection emits `cooperative.registration.rejected` with a reason.

**Kafka events emitted:**
- `cooperative.registration.submitted` (on submit)
- `cooperative.registration.verified` (on approve)
- `cooperative.registration.rejected` (on reject)

---

### Step 2 — Product Registration with SDOQ Specification

A `cooperative-admin` registers a product by selecting a product type (e.g., Huile d'Argan, Safran de Taliouine) and linking it to an SDOQ product specification (`ProductSpecification`). The specification defines the required lab parameters, geographic delimitation (cahier des charges), and applicable certification type (AOP/IGP/LA).

**Kafka event emitted:**
- `product.registered`

---

### Step 3 — Harvest Logging

A `cooperative-member` logs a harvest for a specific farm within the cooperative. Each harvest record captures:

- **Farm GPS coordinates** — latitude/longitude recorded for traceability and geographic compliance (AOP requires all steps within the delimited zone)
- **Campaign year** — Morocco's agricultural year runs October to September (e.g., 2024-2025)
- **Harvest date** — ISO 8601 date of harvest

The Farm entity is associated with its parent Cooperative. The system validates that the farm's GPS coordinates fall within the SDOQ-designated geographic zone for the registered product.

---

### Step 4 — Batch Creation

Following harvest logging, the cooperative member or admin creates a `Batch` record. A batch represents a discrete, traceable unit of product output and captures:

- **Quantity** — weight (kg) or volume (litres) harvested
- **Harvest date** — linked to the harvest log from Step 3
- **Farm association** — UUID reference to the originating farm
- **Campaign year** — inherited from the harvest

The batch receives a system-generated batch code and status `pending-lab`.

**Kafka event emitted:**
- `product.batch.created`

---

### Step 5 — Lab Sample Submission

The cooperative admin or lab technician submits a physical sample from the batch to an ONSSA-accredited laboratory. On the platform, a `LabTestSubmission` record is created referencing the batch UUID. The submission event notifies the assigned laboratory.

**Kafka event emitted:**
- `lab.test.submitted`

---

### Step 6 — Lab Analysis

The ONSSA-accredited laboratory performs chemical and physical analysis on the submitted sample. Required parameters vary by product type (see `docs/domain/lab-parameters.md`):

| Product | Key Parameters |
|---------|----------------|
| Argan Oil | Acidity (% oleic acid), peroxide value, moisture, oleic acid content, tocopherols |
| Saffron | Crocin (E1% ≥ 190), safranal (E1% 20–50), picrocrocin (E1% ≥ 70), moisture, ash |
| Olive Oil Picholine | Acidity, peroxide value, polyphenols, K232, K270 |
| Honey | Moisture, HMF, diastase, sucrose, fructose+glucose |
| Medjoul Dates | Moisture, sugars, flesh-to-seed ratio, average weight |
| Dades Rose | Geraniol, citronellol, nonadecane (GC-MS), moisture |

The lab technician records the measured values against each required parameter in the system.

---

### Step 7 — Lab Test Result Event Published

Once the lab technician submits the analysis results, the platform evaluates each parameter against its defined min/max thresholds. The system emits:

**Kafka event emitted:**
- `lab.test.completed`

Payload includes: `batchId`, `labSubmissionId`, `passed` (boolean), `results` (array of parameter name + measured value), `timestamp`.

The certification module consumes this event. If all parameters pass, the batch status advances to `lab-passed`. If any parameter fails, the batch is flagged `lab-failed` and the cooperative is notified.

---

### Step 8 — Certification Request

A `cooperative-admin` submits a formal certification request for a batch that has achieved `lab-passed` status. The request references:

- `batchId`
- `cooperativeId`
- `productSpecificationId`
- Desired certification type (AOP/IGP/LA)

A `Certification` entity is created with status `pending`.

**Kafka event emitted:**
- `certification.requested`

---

### Step 9 — Inspection Scheduling

The `certification-body` role reviews the certification request and assigns an inspector. The system records:

- Inspector user UUID
- Scheduled date and time
- Location / farm GPS reference

The `Certification` status advances to `inspection-scheduled`. The inspector and cooperative admin are notified.

**Kafka event emitted:**
- `certification.inspection.scheduled`

---

### Step 10 — On-Site Inspection and Report Filing

The assigned inspector visits the farm and production facilities. After the inspection, the inspector files an `InspectionReport` on the platform:

- **Result**: `passed` or `failed`
- **Report summary**: minimum 20 characters, capturing key findings
- **Attachments**: optional photo/document references

The `Certification` status advances to `under-review`.

**Kafka event emitted:**
- `certification.inspection.completed`

---

### Step 11 — Certification Body Decision

A `certification-body` user reviews the full dossier (lab results + inspection report) and issues a decision:

- **Grant** — certification is approved; status moves to `granted`
- **Deny** — certification is rejected; status moves to `denied` with a stated reason
- **Revoke** — an already-granted certification is withdrawn; status moves to `revoked`

**Kafka events emitted:**
- `certification.decision.granted`
- `certification.decision.denied`
- `certification.revoked` (when revoking a previously granted certification)

---

### Step 12 — QR Code Generation and Cooperative Notification

Upon a `granted` decision, the platform automatically generates a `QrCode` entity linked to the `Certification`. The QR code encodes a public URL pointing to the verification endpoint (`GET /verify/:uuid`), which requires no authentication and returns the certification's public details.

The cooperative admin receives a notification with the certification number and QR code download link.

**Kafka event emitted:**
- `certification.qrcode.generated`

---

## State Machine

```
                    ┌─────────────┐
                    │   pending   │  ◄── Certification request submitted (Step 8)
                    └──────┬──────┘
                           │ Inspection scheduled (Step 9)
                           ▼
               ┌───────────────────────┐
               │  inspection-scheduled │
               └───────────┬───────────┘
                           │ Inspection completed (Step 10)
                           ▼
                   ┌──────────────┐
                   │ under-review │  ◄── Dossier review by certification body
                   └──────┬───────┘
              ┌───────────┴────────────┐
              │ Grant (Step 11)        │ Deny (Step 11)
              ▼                        ▼
         ┌─────────┐             ┌─────────┐
         │ granted │             │ denied  │
         └────┬────┘             └─────────┘
              │ Revoke (Step 11)
              ▼
         ┌─────────┐
         │ revoked │
         └─────────┘
```

Valid transitions:

| From | To | Trigger |
|------|----|---------|
| `pending` | `inspection-scheduled` | Certification body schedules inspection |
| `inspection-scheduled` | `under-review` | Inspector files report |
| `under-review` | `granted` | Certification body grants |
| `under-review` | `denied` | Certification body denies |
| `granted` | `revoked` | Certification body revokes |

---

## Certification Number Format

Every granted certification receives a unique, human-readable certification number:

```
TERROIR-{TYPE}-{REGION_CODE}-{YEAR}-{SEQ}
```

| Component | Description | Example |
|-----------|-------------|---------|
| `TERROIR` | Platform prefix (fixed) | `TERROIR` |
| `{TYPE}` | Certification type | `AOP`, `IGP`, or `LA` |
| `{REGION_CODE}` | ISO-inspired Moroccan region code | `SMA` (Souss-Massa), `DRT` (Drâa-Tafilalet), `ORI` (Oriental) |
| `{YEAR}` | 4-digit calendar year of grant | `2025` |
| `{SEQ}` | Zero-padded 4-digit sequential number within the year | `0001` |

**Examples:**
- `TERROIR-AOP-SMA-2025-0001` — First AOP granted in Souss-Massa in 2025
- `TERROIR-IGP-DRT-2025-0003` — Third IGP granted in Drâa-Tafilalet in 2025
- `TERROIR-LA-TTA-2025-0001` — First Label Agricole in Tanger-Tétouan in 2025

---

## Kafka Events Summary (by Step)

| Step | Event | Producer | Consumers |
|------|-------|----------|-----------|
| 1 | `cooperative.registration.submitted` | cooperative | certification, notification |
| 1 | `cooperative.registration.verified` | cooperative | certification, product |
| 1 | `cooperative.registration.rejected` | cooperative | notification |
| 2 | `product.registered` | product | certification |
| 4 | `product.batch.created` | product | certification |
| 5 | `lab.test.submitted` | product | notification |
| 7 | `lab.test.completed` | product | certification, notification |
| 8 | `certification.requested` | certification | notification |
| 9 | `certification.inspection.scheduled` | certification | notification |
| 10 | `certification.inspection.completed` | certification | notification |
| 11 | `certification.decision.granted` | certification | notification, product |
| 11 | `certification.decision.denied` | certification | notification |
| 11 | `certification.revoked` | certification | notification, product |
| 12 | `certification.qrcode.generated` | certification | audit |
