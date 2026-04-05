---
name: morocco-localization
description: Morocco-specific localization for Terroir.ma. Trilingual support (Arabic RTL, French, Amazigh), phone/CIN/ICE/IF/RC validators, MAD currency, DD/MM/YYYY dates, Africa/Casablanca timezone, CNDP compliance, agricultural campaign year.
---

# Morocco Localization — Terroir.ma

## Supported Languages
| Code | Name | Direction | Default |
|------|------|-----------|---------|
| ar-MA | العربية (Arabic/Darija) | RTL | Yes |
| fr-MA | Français | LTR | No |
| zgh | ⵜⴰⵎⴰⵣⵉⵖⵜ (Amazigh/Tifinagh) | LTR | No |

## i18n Key Naming
`<module>.<entity>.<field>` examples:
- `certification.status.granted` = "ممنوحة" / "Accordée" / "ⵉⵜⵜⵓⴼⴽⴰ"
- `product.type.argan_oil` = "زيت أرڭان" / "Huile d'Argan" / "ⴰⴷⵉ ⵏ ⴰⵔⴳⴰⵏ"

## Phone Number Validation
```typescript
// +212 followed by 9 digits (no leading zero)
const PHONE_REGEX = /^\+212[5-7]\d{8}$/;

// DTO validator:
@Matches(/^\+212[5-7]\d{8}$/, { message: 'Phone must be +212XXXXXXXXX format' })
phone: string;
```

## CIN/CNIE Validation
```typescript
// Format: 1-2 letters + 5-6 digits (e.g., AB123456, A123456)
const CIN_REGEX = /^[A-Z]{1,2}\d{5,6}$/;
```

## ICE (Identifiant Commun de l'Entreprise)
```typescript
// Exactly 15 digits
@Matches(/^\d{15}$/, { message: 'ICE must be exactly 15 digits' })
ice: string;
```

## IF (Identifiant Fiscal)
```typescript
// 7-8 digits
@Matches(/^\d{7,8}$/, { message: 'IF must be 7-8 digits' })
identifiantFiscal: string;
```

## RC (Registre de Commerce)
```typescript
// Format: digits optionally followed by letter (e.g., 12345, 12345A)
@Matches(/^\d{1,10}[A-Z]?$/, { message: 'Invalid RC format' })
registreCommerce: string;
```

## MAD Currency Format
Display: 1.234,56 MAD (period as thousands separator, comma as decimal)
```typescript
function formatMAD(amount: number): string {
  return new Intl.NumberFormat('fr-MA', {
    style: 'currency',
    currency: 'MAD',
    minimumFractionDigits: 2,
  }).format(amount);
}
```

## Date Format
DD/MM/YYYY — always use in user-facing output.
```typescript
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('fr-MA', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    timeZone: 'Africa/Casablanca',
  }).format(date);
}
```

## Timezone: Africa/Casablanca
UTC+1 permanently since 2018 (no daylight saving). All DB timestamps in UTC. All display in Africa/Casablanca.

## Agricultural Campaign Year
October → September (not calendar year). Campaign 2025/2026 = Oct 2025 → Sep 2026.
```typescript
function getCampaignYear(date: Date): string {
  const month = date.getMonth() + 1; // 1-12
  const year = date.getFullYear();
  if (month >= 10) return `${year}/${year + 1}`;
  return `${year - 1}/${year}`;
}
```

## CNDP Compliance (Moroccan Data Protection)
Required for all personal data (CIN, phone, email, GPS location):
1. Collect only what's necessary (data minimization)
2. Store encrypted at rest for PII fields
3. Provide export capability (JSON dump per user)
4. Provide deletion capability (soft delete + audit log)
5. Log all access to personal data
6. Never log PII in application logs (Pino PII redaction)
