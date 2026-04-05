# Localization — Trilingual Support (ar-MA, fr-MA, zgh)

## Supported Languages

| Code | Language | Script | Direction | Default |
|------|----------|--------|-----------|---------|
| `fr-MA` | Français (Maroc) | Latin | LTR | **Yes** |
| `ar-MA` | العربية (المغرب) | Arabic | RTL | No |
| `zgh` | ⵜⴰⵎⴰⵣⵉⵖⵜ (Tamazight) | Tifinagh | LTR | No |

## RTL Implementation (ar-MA)

HTML email templates for Arabic must include:
```html
<html lang="ar" dir="rtl">
<body style="direction: rtl; text-align: right;">
  <!-- Callout boxes: border-right instead of border-left -->
  <p style="border-right: 4px solid #1565c0; padding-right: 12px;">
    ...
  </p>
</body>
```

CSS rules that change with RTL:
- `text-align: left` → `text-align: right`
- `border-left` → `border-right`
- `padding-left` → `padding-right`
- `margin-left` → `margin-right`
- `float: left` → `float: right`

## Font Stack

```css
/* Arabic */
font-family: 'Segoe UI', Tahoma, Arial, sans-serif;

/* Tifinagh (Amazigh) */
font-family: 'Tifinagh', 'Segoe UI', Arial, sans-serif;

/* French (default) */
font-family: Arial, sans-serif;
```

## API Language Header

Clients can request responses in a specific language:
```
Accept-Language: fr-MA
Accept-Language: ar-MA
Accept-Language: zgh
```

If the header is absent or the language is unsupported, `fr-MA` is used.

## Notification Template Resolution

```
1. Look up template: code + channel + requested_language
2. If not found: fall back to code + channel + 'fr-MA'
3. If still not found: log warning and skip notification
```

## Reference Data Columns

All reference data tables store multilingual names as separate columns:
```sql
name_fr VARCHAR(255),
name_ar VARCHAR(255),
name_zgh VARCHAR(255)
```

Example (Morocco regions):
```json
{
  "code": "SFI",
  "name_fr": "Souss-Massa",
  "name_ar": "سوس-ماسة",
  "name_zgh": "Suss-Massa"
}
```

## Morocco Timezone

- **Timezone ID**: `Africa/Casablanca`
- **UTC offset**: UTC+1 (permanent since 2018 — Ramadan exception applies)
- **No DST** since 2018 (except during Ramadan when clocks go back to UTC+0)
- Store all timestamps in UTC; convert to `Africa/Casablanca` for display

## Date & Currency Formats

| Locale | Date Format | Currency |
|--------|-------------|----------|
| fr-MA | DD/MM/YYYY | 1 234,56 MAD |
| ar-MA | DD/MM/YYYY | ١ ٢٣٤٫٥٦ د.م. |
| zgh | DD/MM/YYYY | 1 234,56 MAD |
