# Kafka Events Reference

This document catalogues all 18 Kafka events emitted by the Terroir.ma platform. Every event shares a common base envelope before its domain-specific payload.

## Base Envelope Fields

All events include the following fields regardless of topic:

| Field | Type | Description |
|-------|------|-------------|
| `eventId` | UUID (v4) | Unique identifier for this specific event occurrence |
| `correlationId` | UUID (v4) | Shared identifier linking all events in a single business transaction or request chain |
| `version` | string | Schema version of the event (e.g., `"1.0"`) — used for consumer compatibility checks |
| `timestamp` | ISO 8601 | UTC datetime when the event was emitted (e.g., `"2025-03-30T14:22:00.000Z"`) |

---

## Event Catalogue

### Cooperative Module Events

| Topic | Producer Module | Consumer Modules | Payload Fields | Description |
|-------|-----------------|------------------|----------------|-------------|
| `cooperative.registration.submitted` | cooperative | certification, notification | `cooperativeId`, `name`, `legalForm`, `registrationNumber`, `adminUserId`, `submittedAt` | Emitted when a cooperative admin submits the cooperative's registration dossier for review. Triggers a notification to super-admins and places the certification module on standby for the cooperative. |
| `cooperative.registration.verified` | cooperative | certification, product | `cooperativeId`, `name`, `verifiedAt`, `verifiedByUserId` | Emitted when a super-admin approves the cooperative registration. Allows the certification and product modules to accept future requests from this cooperative. |
| `cooperative.registration.rejected` | cooperative | notification | `cooperativeId`, `rejectedAt`, `rejectedByUserId`, `reason` | Emitted when a super-admin rejects the cooperative registration. The notification module sends a rejection notice with the stated reason to the cooperative admin. |
| `cooperative.member.added` | cooperative | (internal) | `cooperativeId`, `memberId`, `userId`, `role`, `addedAt` | Emitted when a new member is added to a verified cooperative. Consumed internally for audit logging; no cross-module side effects in the current version. |

---

### Product Module Events

| Topic | Producer Module | Consumer Modules | Payload Fields | Description |
|-------|-----------------|------------------|----------------|-------------|
| `product.registered` | product | certification | `productSpecificationId`, `cooperativeId`, `productType`, `certificationTypeRequested`, `registeredAt` | Emitted when a cooperative admin registers a product against an SDOQ product specification. Notifies the certification module to prepare a certification dossier template. |
| `product.batch.created` | product | certification | `batchId`, `cooperativeId`, `farmId`, `productSpecificationId`, `quantity`, `unit`, `harvestDate`, `campaignYear`, `createdAt` | Emitted when a batch is created following a harvest log. Consumed by the certification module to track batch lifecycle. |
| `lab.test.submitted` | product | notification | `labSubmissionId`, `batchId`, `cooperativeId`, `labId`, `submittedAt` | Emitted when a lab sample submission is recorded. Notifies the cooperative admin and the assigned lab that samples are pending analysis. |
| `lab.test.completed` | product | certification, notification | `labSubmissionId`, `batchId`, `cooperativeId`, `labId`, `passed`, `results` (array of `{ parameter, measuredValue, unit, withinThreshold }`), `completedAt` | Emitted when a lab technician submits final analysis results. The certification module updates the batch status (`lab-passed` or `lab-failed`). The notification module alerts the cooperative of the outcome. |

---

### Certification Module Events

| Topic | Producer Module | Consumer Modules | Payload Fields | Description |
|-------|-----------------|------------------|----------------|-------------|
| `certification.requested` | certification | notification | `certificationId`, `batchId`, `cooperativeId`, `productSpecificationId`, `certificationTypeRequested`, `requestedByUserId`, `requestedAt` | Emitted when a cooperative admin formally requests certification for a lab-passed batch. Triggers a notification to the certification body. |
| `certification.inspection.scheduled` | certification | notification | `certificationId`, `inspectorUserId`, `scheduledDate`, `farmId`, `scheduledByUserId`, `scheduledAt` | Emitted when the certification body assigns an inspector and sets an inspection date. Notifies both the inspector and the cooperative admin. |
| `certification.inspection.completed` | certification | notification | `certificationId`, `inspectionId`, `inspectorUserId`, `result` (`passed`\|`failed`), `reportSummary`, `completedAt` | Emitted when an inspector files the inspection report. Moves the certification to `under-review` and notifies the certification body for final decision. |
| `certification.decision.granted` | certification | notification, product | `certificationId`, `certificationNumber`, `batchId`, `cooperativeId`, `certificationTypeGranted`, `grantedByUserId`, `validUntil`, `grantedAt` | Emitted when the certification body grants the certification. The product module marks the batch as certified. The notification module informs the cooperative admin. |
| `certification.decision.denied` | certification | notification | `certificationId`, `batchId`, `cooperativeId`, `deniedByUserId`, `reason`, `deniedAt` | Emitted when the certification body denies the request. The cooperative admin receives a notification with the stated reason. |
| `certification.revoked` | certification | notification, product | `certificationId`, `certificationNumber`, `batchId`, `cooperativeId`, `revokedByUserId`, `reason`, `revokedAt` | Emitted when a previously granted certification is revoked. The product module updates the batch status to reflect revocation. The cooperative admin is notified immediately. |
| `certification.qrcode.generated` | certification | (audit) | `certificationId`, `certificationNumber`, `qrCodeId`, `verifyUrl`, `generatedAt` | Emitted when the QR code is generated following a grant decision. The verify URL points to the public `GET /verify/:uuid` endpoint. Consumed by the audit log. |
| `export.document.requested` | certification | (audit) | `exportDocumentId`, `certificationId`, `certificationNumber`, `requestedByUserId`, `hsCode`, `destinationCountry`, `requestedAt` | Emitted when a cooperative admin requests an export clearance document. Logged to the audit trail awaiting customs-agent validation. |
| `export.document.validated` | certification | notification | `exportDocumentId`, `certificationId`, `validatedByUserId`, `validatedAt` | Emitted when a customs-agent validates the export document. Triggers a notification to the cooperative admin confirming export clearance. |

---

### Notification Module Events

| Topic | Producer Module | Consumer Modules | Payload Fields | Description |
|-------|-----------------|------------------|----------------|-------------|
| `notification.sent` | notification | (audit) | `notificationId`, `recipientUserId`, `channel` (`email`\|`sms`\|`push`), `templateKey`, `language` (`fr-MA`\|`ar-MA`\|`zgh`), `sentAt` | Emitted after every successful notification delivery. Consumed only by the audit log. No PII (message body, recipient address) is included in this event — only references and metadata. |

---

## Event Schema Versioning

Event schemas follow semantic versioning in the `version` field:

- **Minor bumps** (e.g., `1.0` → `1.1`): additive changes (new optional fields). Consumers must tolerate unknown fields.
- **Major bumps** (e.g., `1.x` → `2.0`): breaking changes. A new Kafka topic suffix (e.g., `.v2`) is introduced during the migration window to allow parallel consumption.

## Notes on Payload Design

- **No PII in event payloads.** Names, email addresses, phone numbers, and CIN numbers are never included. Consumers resolve user details from the cooperative service using the UUID references.
- **No cross-schema foreign key values.** `cooperativeId`, `batchId`, `farmId`, etc. are plain UUID strings. Consumers store these as reference columns without enforced FK constraints.
- **Idempotency.** All consumers must handle duplicate delivery of the same `eventId` gracefully. The `eventId` field is the idempotency key.
