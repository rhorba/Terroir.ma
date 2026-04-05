# ADR-009: Certification Number Format TERROIR-{type}-{region}-{year}-{seq}

Date: 2026-03-30

## Status

Accepted

## Context

Certification numbers issued by the platform must satisfy several stakeholder requirements:

- **Human-readable:** Numbers appear on physical product labels, customs documents, and SDOQ administrative filings. They must be legible and meaningful to human readers without decoding.
- **Encode certification type and region:** Inspectors, customs agents, and consumers benefit from being able to determine the certification type (IGP, AOP, Label Agricole) and the region of origin from the number itself.
- **Globally unique within the platform:** Duplicate certification numbers are not acceptable — they would create ambiguity in customs systems and consumer verification.
- **Align with SDOQ conventions:** Morocco's Système de Désignation de l'Origine et de la Qualité uses administrative numbering that includes type codes and region codes. The platform's format should be compatible.
- **Agricultural year, not calendar year:** Morocco's agricultural campaigns run October–September. A certification issued in November 2025 belongs to the 2025–26 campaign and should reference year 2025 (the start year).

Auto-increment database IDs and UUIDs were rejected as they are not human-readable and carry no semantic information.

## Decision

**Format:**

```
TERROIR-{TYPE}-{REGION_CODE}-{YEAR}-{SEQ}
```

**Component definitions:**

| Component | Values | Example |
|---|---|---|
| `TYPE` | `IGP` (Indication Géographique Protégée), `AOP` (Appellation d'Origine Protégée), `LA` (Label Agricole) | `AOP` |
| `REGION_CODE` | 3-letter uppercase code from the `certification.region` lookup table | `MRR` (Marrakech-Safi) |
| `YEAR` | 4-digit start year of the agricultural campaign | `2025` |
| `SEQ` | Zero-padded 3-digit sequence number, scoped to type + region + year | `001` |

**Full example:** `TERROIR-AOP-MRR-2025-001`

**Agricultural year calculation:**

```typescript
function getCampaignYear(date: Date): number {
  // Campaign starts in October (month index 9)
  return date.getMonth() >= 9 ? date.getFullYear() : date.getFullYear() - 1;
}
```

**Sequence number generation:**

Sequence numbers are maintained in a `certification.sequence_counter` table:

```sql
certification_sequence_counter (
  type         varchar,
  region_code  varchar,
  year         integer,
  last_seq     integer DEFAULT 0,
  PRIMARY KEY (type, region_code, year)
)
```

Generation is performed within a database transaction using a pessimistic lock:

```sql
BEGIN;
SELECT last_seq FROM certification.sequence_counter
  WHERE type = $1 AND region_code = $2 AND year = $3
  FOR UPDATE;
-- increment and update
UPDATE certification.sequence_counter
  SET last_seq = last_seq + 1
  WHERE type = $1 AND region_code = $2 AND year = $3;
COMMIT;
```

`FOR UPDATE` prevents duplicate sequence numbers under concurrent certification grant requests for the same type + region + year combination. The application retries on deadlock (max 3 attempts).

**SEQ overflow:** At SEQ 999, a new sequence cannot be issued. This is an intentional hard limit; if a region + type combination approaches 999 certifications in a single campaign year, the sequence table design must be revisited (Phase 2: extend to 4 digits).

## Consequences

**Positive:**
- Certification numbers are immediately interpretable by humans: type, region, year, and sequence are all visible.
- Format aligns with SDOQ administrative conventions, reducing friction in regulatory filings.
- `FOR UPDATE` locking guarantees uniqueness without application-level retries in the common case.
- Agricultural year calculation correctly handles cross-year certifications.

**Negative / Risks:**
- **Pessimistic locking creates a serialization bottleneck** for concurrent certifications of the same type + region + year. In practice, simultaneous certification grants for the same region are rare, so this is not a performance concern for v1.
- **SEQ is capped at 999:** Regions with very high certification volumes may hit this limit. Monitor via a daily alert when `last_seq > 900` for any active counter.
- Region codes must be pre-populated in the `certification.region` table before certifications can be issued for that region. Missing region codes will cause a validation error.
