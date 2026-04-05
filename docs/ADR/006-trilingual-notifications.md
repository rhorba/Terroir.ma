# ADR-006: Handlebars Templates for Trilingual Notifications

Date: 2026-03-30

## Status

Accepted

## Context

Morocco's three official languages — French (fr-MA), Arabic (ar-MA), and Amazigh (zgh, written in Tifinagh script) — are all used by cooperative stakeholders. Notification content must therefore be available in all three languages. Additional constraints:

- **Arabic requires RTL layout:** Email HTML must use `dir="rtl"` and appropriate CSS for right-to-left reading flow.
- **Tifinagh script:** Amazigh notifications require a web-safe font stack that includes Tifinagh-capable fonts (Ebrima, Noto Sans Tifinagh).
- **Non-developer content management:** Template operators (community managers, SDOQ liaison staff) must be able to update notification text without a code deployment.
- **Multiple channels:** Notifications are sent via email and SMS. SMS templates must be plain text; email templates may be HTML.

Hardcoding notification strings in code violates the non-developer management requirement. A file-based i18n approach (JSON/YAML locale files) requires a code deployment for every content update.

## Decision

Notification templates are stored in the `notification.notification_template` database table with the following schema:

```
notification_template
  id              uuid PRIMARY KEY
  code            varchar   -- e.g. 'certification.granted'
  channel         varchar   -- 'email' | 'sms'
  language        varchar   -- 'fr-MA' | 'ar-MA' | 'zgh'
  subject         varchar   -- email subject (nullable for SMS)
  body_template   text      -- Handlebars template string
  is_active       boolean
  updated_at      timestamptz
  updated_by      uuid      -- references the operator who last modified
```

**Template engine:** Handlebars 4.x. Templates are compiled at render time using `Handlebars.compile()` and populated with a context object specific to the notification type.

**Per-notification template set:** Each notification type requires up to 6 records (2 channels × 3 languages). Example for `certification.granted`:
- `certification.granted` / `email` / `fr-MA`
- `certification.granted` / `email` / `ar-MA` (includes `dir="rtl"` in HTML)
- `certification.granted` / `email` / `zgh`
- `certification.granted` / `sms` / `fr-MA`
- `certification.granted` / `sms` / `ar-MA`
- `certification.granted` / `sms` / `zgh`

**Language selection:** The recipient's preferred language is stored in their user profile (cooperative module). If no preference is set, `fr-MA` is used.

**Fallback:** If a template for the requested language is not found (e.g., a `zgh` SMS template has not yet been authored), the `fr-MA` variant is used and a warning log entry is emitted.

**Template error handling:** Handlebars render errors are caught per notification send attempt. The error is logged with the template code and language, an alert is triggered, and the notification is written to the DLQ. This prevents a broken template from silently swallowing notifications.

**Phase 2:** Build a template management UI for operators (accessible to `super-admin` and `cooperative-admin` roles) so that templates can be edited without direct database access.

## Consequences

**Positive:**
- Template updates are live immediately after a database write — no deployment required.
- Handlebars is a well-understood, logic-minimal template language that reduces the risk of operators introducing security issues (no `eval`, limited helpers).
- RTL and Tifinagh support is handled at the template level, not in application code.
- Fallback to `fr-MA` prevents silent failures for languages where templates are not yet authored.

**Negative / Risks:**
- **Template errors are runtime errors, not compile-time errors:** A syntax error in a template is only discovered when that notification type is triggered. The monitoring alert partially compensates, but a broken template will cause at least one delivery failure before the alert fires.
- **DB access required for template management in v1:** Before the Phase 2 admin UI exists, operators must use a database client, which requires technical training and carries data risk.
- Template version history is not tracked in v1 (no audit table for template edits). Phase 2 should add a `notification_template_history` table.
