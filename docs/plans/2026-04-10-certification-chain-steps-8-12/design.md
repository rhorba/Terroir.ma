# Design: Certification Chain Steps 8–12

**Date:** 2026-04-10
**Sprint:** 3
**Story Points:** 21

## Context

Sprint 2 delivered Steps 1–7 (DRAFT → LAB_RESULTS_RECEIVED) with an append-only
`CertificationEvent` ledger and CQRS-lite `currentStatus` materialized column.

Sprint 3 completes the 12-step chain by adding:

- Step 8: LAB_RESULTS_RECEIVED → UNDER_REVIEW (`startFinalReview`)
- Step 9: UNDER_REVIEW → GRANTED (`grantCertification` — refactored)
- Step 10: UNDER_REVIEW → DENIED (`denyCertification` — refactored)
- Step 11: GRANTED → REVOKED (`revokeCertification` — refactored)
- Step 12: GRANTED → RENEWED + new DRAFT (`renewCertification` — new)

The 3 existing terminal methods (grant/deny/revoke) are refactored to go through
`applyTransition()` so they append a `CertificationEvent` row, completing the
immutable audit trail required by Law 25-06.

---

## Full 12-Step State Machine

```
DRAFT
  → (Step 1: submitRequest)         SUBMITTED
  → (Step 2: startReview)           DOCUMENT_REVIEW
  → (Step 3: scheduleInspection)    INSPECTION_SCHEDULED
  → (Step 4: startInspection)       INSPECTION_IN_PROGRESS
  → (Step 5: completeInspection)    INSPECTION_COMPLETE
  → (Step 6: requestLab)            LAB_TESTING
  → (Step 7: receiveLabResults)     LAB_RESULTS_RECEIVED  [Kafka-only]
  → (Step 8: startFinalReview)      UNDER_REVIEW
  → (Step 9: grantCertification)    GRANTED
  → (Step 10: denyCertification)    DENIED
GRANTED
  → (Step 11: revokeCertification)  REVOKED
  → (Step 12: renewCertification)   RENEWED  +  new DRAFT cert (renewedFromId = old id)
```

---

## Section 1 — Enum Changes

### `CertificationStatus` (13 values, up from 12)

```ts
RENEWED = 'RENEWED'; // old cert superseded by a renewal
```

### `CertificationEventType` (12 values, up from 10)

```ts
FINAL_REVIEW_STARTED = 'FINAL_REVIEW_STARTED'; // Step 8
CERTIFICATE_RENEWED = 'CERTIFICATE_RENEWED'; // Step 12 (on old cert)
```

### Entity columns

No new columns required. All audit fields already exist:
`renewedFromId`, `validFrom`, `validUntil`, `grantedBy`, `grantedAt`,
`deniedBy`, `deniedAt`, `denialReason`, `revokedBy`, `revokedAt`, `revocationReason`.

### Migration

No DDL changes needed — `current_status` is `varchar(30)`, no DB-level enum constraint.
A comment migration (`1700000000006-AddRenewedStatus.ts`) documents the change for
the audit log.

---

## Section 2 — Service Methods

### Step 8 — `startFinalReview` (new)

```
Actor:      certification-body
Guard:      currentStatus === LAB_RESULTS_RECEIVED
Transition: LAB_RESULTS_RECEIVED → UNDER_REVIEW
Event type: FINAL_REVIEW_STARTED
Kafka:      certification.review.final-started
```

### Step 9 — `grantCertification` (refactored)

```
Actor:      certification-body
Guard:      currentStatus === UNDER_REVIEW  (strict — was LAB_RESULTS_RECEIVED | UNDER_REVIEW)
Transition: UNDER_REVIEW → GRANTED
Event type: DECISION_GRANTED
Payload:    { certificationNumber, validFrom, validUntil }
Post:       certRepo.update() for typed audit columns
Post:       qrCodeService.generateQrCode()
Kafka:      certification.decision.granted
```

### Step 10 — `denyCertification` (refactored)

```
Actor:      certification-body
Guard:      currentStatus === UNDER_REVIEW  (strict)
Transition: UNDER_REVIEW → DENIED
Event type: DECISION_DENIED
Payload:    { reason }
Post:       certRepo.update() for deniedBy, deniedAt, denialReason
Kafka:      certification.decision.denied
```

### Step 11 — `revokeCertification` (refactored)

```
Actor:      certification-body | super-admin
Guard:      currentStatus === GRANTED
Transition: GRANTED → REVOKED
Event type: CERTIFICATE_REVOKED
Payload:    { reason }
Post:       certRepo.update() for revokedBy, revokedAt, revocationReason
Post:       qrCodeService.deactivateByCertificationId()
Kafka:      certification.revoked
```

### Step 12 — `renewCertification` (new)

```
Actor:      cooperative-admin
Guard:      currentStatus === GRANTED
Steps:
  1. applyTransition(oldCert, CERTIFICATE_RENEWED, RENEWED, actorId, actorRole, null, correlationId)
  2. certRepo.create({ cooperativeId, batchId, productTypeCode, certificationType,
                       regionCode, requestedBy, requestedAt, createdBy,
                       cooperativeName, currentStatus: DRAFT, renewedFromId: oldCert.id })
  3. certRepo.save(newCert)
  4. publishCertificationRenewed(oldCert, newCert.id, actorId, correlationId)
Returns: new DRAFT Certification
NOTE: QR on RENEWED cert stays active (returns "superseded" response)
```

---

## Section 3 — QR Verification Update

`QrVerificationResult` interface gains one optional field:

```ts
newCertificationNumber?: string | null
```

`verifyQrCode()` updated:

```ts
// After finding certification:
if (certification.currentStatus === CertificationStatus.RENEWED) {
  const successor = await certRepo.findOne({ where: { renewedFromId: certification.id } });
  await qrCodeRepo.increment({ id: qrCode.id }, 'scansCount', 1);
  return {
    valid: false,
    certification,
    qrCode,
    newCertificationNumber: successor?.certificationNumber ?? null,
    message: successor?.certificationNumber
      ? `Certificate renewed. New certificate: ${successor.certificationNumber}`
      : 'Certificate has been renewed. New certificate pending issuance.',
  };
}
```

The `isActive: true` filter is kept — QR codes on RENEWED certs are NOT deactivated.

---

## Section 4 — Kafka Events

### New interfaces (`src/common/interfaces/events/certification.events.ts`)

```ts
CertificationFinalReviewStartedEvent {
  eventId: string        // UUID
  correlationId: string
  timestamp: string      // ISO 8601
  version: 1
  certificationId: string
  cooperativeId: string
  actorId: string
}

CertificationRenewedEvent {
  eventId: string
  correlationId: string
  timestamp: string
  version: 1
  oldCertificationId: string
  newCertificationId: string
  cooperativeId: string
  renewedBy: string
}
```

### New producer methods (`CertificationProducer`)

```
publishFinalReviewStarted(cert, actorId, correlationId)
  topic: certification.review.final-started

publishCertificationRenewed(oldCert, newCertId, actorId, correlationId)
  topic: certification.renewed
```

### New topic table

| Topic                                | Producer      | Consumer group     | Notification                     |
| ------------------------------------ | ------------- | ------------------ | -------------------------------- |
| `certification.review.final-started` | certification | notification-group | Email: "File under final review" |
| `certification.renewed`              | certification | notification-group | Email: "Renewal submitted"       |

---

## Section 5 — Controller Endpoints

### New endpoints

| Method | Path                                     | Role                 | Step |
| ------ | ---------------------------------------- | -------------------- | ---- |
| `POST` | `/certifications/:id/start-final-review` | `certification-body` | 8    |
| `POST` | `/certifications/:id/renew`              | `cooperative-admin`  | 12   |

Existing endpoints (`grant`, `deny`, `revoke`) keep their URLs — only the service
implementation changes.

---

## Section 6 — Test Plan

### Unit tests

- State machine guard: `startFinalReview` throws when not `LAB_RESULTS_RECEIVED`
- State machine guard: `grantCertification` throws when not `UNDER_REVIEW`
- State machine guard: `denyCertification` throws when not `UNDER_REVIEW`
- State machine guard: `renewCertification` throws when not `GRANTED`
- `verifyQrCode` returns `superseded` + `newCertificationNumber` for `RENEWED` cert
- `verifyQrCode` returns `valid: true` for `GRANTED` cert (regression)

### Integration tests

- Full 12-step chain: Steps 8–12 extending existing chain test
- `renewCertification` creates new DRAFT with correct `renewedFromId`
- `revokeCertification` deactivates QR code

### E2E tests

- `POST /certifications/:id/start-final-review` → 200 `UNDER_REVIEW` (certification-body)
- `POST /certifications/:id/grant` → 200 `GRANTED` (certification-body)
- `POST /certifications/:id/renew` → 200 new DRAFT (cooperative-admin)
- Wrong-role guard: cooperative-admin calling `start-final-review` → 403
- Out-of-order: `grant` before `start-final-review` → 400

---

## Decisions

| Decision                                                       | Rationale                                                                       |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `RENEWED` as 13th status (not reuse `REVOKED`)                 | Semantically distinct — renewal is legitimate, revocation is punitive           |
| QR on RENEWED stays active                                     | Consumer gets "superseded" info, not a broken link                              |
| Grant guard strict to `UNDER_REVIEW` only                      | Closes the LAB_RESULTS_RECEIVED → GRANTED shortcut that existed in Sprint 2     |
| Refactor grant/deny/revoke through `applyTransition`           | Law 25-06 requires complete audit trail — all transitions must be in the ledger |
| `renewedFromId` chain instead of renewal suffix in cert number | Clean numbers, full traceability via data model                                 |
| `startFinalReview` publishes Kafka event                       | Cooperative-admin gets "under final review" notification — better UX            |
