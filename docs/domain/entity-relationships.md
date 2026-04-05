# Entity Relationships

This document describes the data model for all four Terroir.ma modules. Each module owns its own PostgreSQL schema. There are no cross-schema foreign key constraints — inter-module references are stored as plain UUID columns.

---

## Architectural Principle: Schema Isolation

Each NestJS module maps to a dedicated PostgreSQL schema:

| Module | Schema |
|--------|--------|
| Cooperative | `cooperative` |
| Product | `product` |
| Certification | `certification` |
| Notification | `notification` |

Cross-module data needs are satisfied by **Kafka event-driven read copies** — not by cross-schema JOINs. When a module needs data owned by another module, it maintains a local denormalised copy that is updated when the relevant Kafka event arrives.

---

## Cooperative Schema

The cooperative schema models the cooperative entity, its members, its farms, and all harvest activity.

### Cooperative

Primary aggregate. Represents a legally registered agricultural cooperative.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | System-generated |
| `name_fr` | varchar | Name in French |
| `name_ar` | varchar | Name in Arabic |
| `name_zgh` | varchar | Name in Tifinagh (optional) |
| `legalForm` | enum | `SARL`, `SA`, `Cooperative` |
| `registrationNumber` | varchar | Official registration number (ICE/RC) |
| `status` | enum | `pending`, `verified`, `rejected`, `suspended` |
| `adminUserId` | UUID | Keycloak user UUID of cooperative admin |
| `regionCode` | varchar | SDOQ region code (e.g., `SMA`, `DRT`) |
| `createdAt` | timestamptz | |
| `updatedAt` | timestamptz | |

### CooperativeMember (1:N → Cooperative)

Each cooperative has one or more members. A member maps to a Keycloak user.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `cooperativeId` | UUID FK | References `cooperative.id` |
| `userId` | UUID | Keycloak user UUID |
| `role` | enum | `admin`, `member` |
| `joinedAt` | date | |
| `departedAt` | date | Null if still active |

**Relationship:** `Cooperative` 1 → N `CooperativeMember`

### Farm (1:N → Cooperative)

Each farm belongs to one cooperative. Farm GPS coordinates are used for geographic zone compliance.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `cooperativeId` | UUID FK | References `cooperative.id` |
| `name` | varchar | Farm name or plot identifier |
| `latitudeGps` | decimal(9,6) | WGS84 latitude |
| `longitudeGps` | decimal(9,6) | WGS84 longitude |
| `areaHectares` | decimal(8,2) | Surface area |
| `createdAt` | timestamptz | |

**Relationship:** `Cooperative` 1 → N `Farm`

### Harvest (1:N → Farm)

Records a single harvest event on a farm.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `farmId` | UUID FK | References `farm.id` |
| `cooperativeId` | UUID | Denormalised for query convenience |
| `harvestDate` | date | Actual date of harvest |
| `campaignYear` | varchar | e.g., `2024-2025` (Oct–Sep) |
| `notes` | text | Optional field observations |
| `loggedByUserId` | UUID | Keycloak user UUID of member who logged it |
| `createdAt` | timestamptz | |

**Relationship:** `Farm` 1 → N `Harvest`

### Batch (1:N → Harvest)

A discrete, traceable product batch created from a harvest.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `harvestId` | UUID FK | References `harvest.id` |
| `farmId` | UUID | Denormalised |
| `cooperativeId` | UUID | Denormalised |
| `batchCode` | varchar | System-generated unique code |
| `quantity` | decimal(10,2) | |
| `unit` | enum | `kg`, `litre`, `unit` |
| `campaignYear` | varchar | Inherited from harvest |
| `status` | enum | `pending-lab`, `lab-passed`, `lab-failed`, `certified`, `revoked` |
| `createdAt` | timestamptz | |

**Relationship:** `Harvest` 1 → N `Batch`

---

## Product Schema

The product schema owns product specifications and maintains a read copy of batch data for product-level tracking.

### ProductSpecification

Defines the SDOQ specification (cahier des charges) for a product type.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `productType` | varchar | e.g., `argan-oil`, `saffron`, `medjoul-dates` |
| `certificationTypeAllowed` | enum | `AOP`, `IGP`, `LA` |
| `name_fr` | varchar | |
| `name_ar` | varchar | |
| `name_zgh` | varchar | |
| `geographicZone` | varchar | SDOQ-defined region description |
| `regionCode` | varchar | Platform region code |
| `labParametersRef` | varchar | Reference key into `lab-test-parameters.json` |
| `isActive` | boolean | |
| `createdAt` | timestamptz | |

### Batch (read copy)

A local read copy of batch data, updated by consuming `product.batch.created` and `certification.decision.*` Kafka events. This copy is used by the product module for batch status display without querying the cooperative schema.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Same UUID as cooperative schema batch |
| `cooperativeId` | UUID | Plain UUID, no FK |
| `farmId` | UUID | Plain UUID, no FK |
| `productSpecificationId` | UUID FK | References `product.productspecification.id` |
| `quantity` | decimal(10,2) | |
| `unit` | enum | |
| `harvestDate` | date | |
| `campaignYear` | varchar | |
| `status` | enum | Mirrors cooperative schema batch status |
| `lastUpdatedFromEvent` | timestamptz | Tracks event-driven sync |

---

## Certification Schema

The certification schema owns the full certification lifecycle, inspection records, QR codes, and export documents.

### Certification

Primary aggregate for the certification module.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `batchId` | UUID | Plain UUID — no FK to cooperative schema |
| `cooperativeId` | UUID | Plain UUID — no FK to cooperative schema |
| `productSpecificationId` | UUID | Plain UUID reference |
| `certificationTypeRequested` | enum | `AOP`, `IGP`, `LA` |
| `certificationTypeGranted` | enum | Null until granted |
| `certificationNumber` | varchar | e.g., `TERROIR-AOP-SMA-2025-0001`; null until granted |
| `status` | enum | `pending`, `inspection-scheduled`, `under-review`, `granted`, `denied`, `revoked` |
| `requestedByUserId` | UUID | |
| `requestedAt` | timestamptz | |
| `decisionByUserId` | UUID | |
| `decisionAt` | timestamptz | |
| `validUntil` | date | Null until granted |
| `revocationReason` | text | Null unless revoked |

### Inspection (1:1 → Certification)

Each certification has at most one scheduled inspection.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `certificationId` | UUID FK | References `certification.certification.id` |
| `inspectorUserId` | UUID | Keycloak user UUID |
| `scheduledDate` | date | |
| `scheduledByUserId` | UUID | |
| `scheduledAt` | timestamptz | |

**Relationship:** `Certification` 1 → 1 `Inspection`

### InspectionReport (1:1 → Inspection)

Filed by the inspector after completing the on-site visit.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `inspectionId` | UUID FK | References `certification.inspection.id` |
| `result` | enum | `passed`, `failed` |
| `reportSummary` | text | Minimum 20 characters |
| `attachmentUrls` | text[] | Optional S3/object-store URLs |
| `filedByUserId` | UUID | Must match `inspection.inspectorUserId` |
| `filedAt` | timestamptz | |

**Relationship:** `Inspection` 1 → 1 `InspectionReport`

### QrCode (1:N → Certification)

A certification may have multiple QR codes over its lifetime (e.g., regeneration after revocation reinstatement).

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Also serves as the QR verify UUID |
| `certificationId` | UUID FK | References `certification.certification.id` |
| `certificationNumber` | varchar | Denormalised for fast verify lookups |
| `verifyUrl` | varchar | Public URL: `/verify/{id}` |
| `isActive` | boolean | Only one QR code active per certification at a time |
| `generatedByUserId` | UUID | |
| `generatedAt` | timestamptz | |

**Relationship:** `Certification` 1 → N `QrCode`

### ExportDocument (1:N → Certification)

Export clearance documents requested for a certified batch.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `certificationId` | UUID FK | References `certification.certification.id` |
| `certificationNumber` | varchar | Denormalised |
| `hsCode` | varchar | HS tariff code for the product |
| `destinationCountry` | varchar | ISO 3166-1 alpha-2 country code |
| `status` | enum | `requested`, `validated`, `rejected` |
| `requestedByUserId` | UUID | |
| `requestedAt` | timestamptz | |
| `validatedByUserId` | UUID | Customs-agent user UUID |
| `validatedAt` | timestamptz | |

**Relationship:** `Certification` 1 → N `ExportDocument`

---

## Notification Schema

The notification schema owns email/SMS/push templates and maintains an immutable log of all sent notifications.

### NotificationTemplate

Defines the content structure for each notification type in each supported language.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `templateKey` | varchar | e.g., `certification.decision.granted` |
| `channel` | enum | `email`, `sms`, `push` |
| `language` | enum | `fr-MA`, `ar-MA`, `zgh` |
| `subjectTemplate` | varchar | Mustache/Handlebars template string (email only) |
| `bodyTemplate` | text | Template string with variable placeholders |
| `isActive` | boolean | |
| `updatedAt` | timestamptz | |

Template resolution order: exact `(templateKey, channel, language)` match → fallback to `fr-MA` for the same `(templateKey, channel)`.

### Notification

Immutable audit log of every notification delivery attempt.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `recipientUserId` | UUID | Keycloak user UUID |
| `channel` | enum | `email`, `sms`, `push` |
| `templateKey` | varchar | |
| `language` | enum | |
| `correlationId` | UUID | Kafka event correlationId that triggered this notification |
| `status` | enum | `sent`, `failed`, `bounced` |
| `sentAt` | timestamptz | |
| `failureReason` | text | Null if successful |

Note: No message body or recipient address is stored in this table. The `notification.sent` Kafka event similarly omits PII. Addresses are resolved at send time from the user service (Keycloak) and are not persisted.

---

## Cross-Module Reference Summary

| Reference | Source Module | Target Module | Stored As |
|-----------|---------------|---------------|-----------|
| `cooperativeId` | certification | cooperative | Plain UUID column |
| `batchId` | certification | cooperative/product | Plain UUID column |
| `farmId` | certification | cooperative | Plain UUID column |
| `productSpecificationId` | certification | product | Plain UUID column |
| `batchId` | product (read copy) | cooperative | Plain UUID column |
| `cooperativeId` | product (read copy) | cooperative | Plain UUID column |

No cross-schema JOIN is ever executed. Each module's read copy is kept consistent via Kafka event consumers. If a consumer is temporarily offline, it replays events from its committed offset on restart.
