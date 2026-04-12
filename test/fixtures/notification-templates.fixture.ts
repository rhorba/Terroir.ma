/**
 * Seed fixture for notification templates.
 * Used by integration tests to populate the notification.notification_template table.
 * Keys must match the DB column names (snake_case).
 */
export const NOTIFICATION_TEMPLATE_FIXTURES = [
  {
    code: 'certification-granted',
    channel: 'email',
    language: 'fr-MA',
    subject_template: 'Certification {{certificationNumber}} accordée — Terroir.ma',
    body_template:
      '<p>Félicitations {{cooperativeName}}, votre certification {{certificationNumber}} a été accordée le {{grantedAt}}.</p>',
    is_active: true,
  },
  {
    code: 'certification-granted',
    channel: 'email',
    language: 'ar-MA',
    subject_template: 'تم منح الشهادة {{certificationNumber}} — Terroir.ma',
    body_template:
      '<p dir="rtl">تهانينا {{cooperativeName}}، تم منح شهادتكم {{certificationNumber}} بتاريخ {{grantedAt}}.</p>',
    is_active: true,
  },
  {
    code: 'lab-test-completed',
    channel: 'email',
    language: 'fr-MA',
    subject_template: "Résultats d'analyses — Lot {{batchReference}}",
    body_template:
      '<p>Les analyses du lot {{batchReference}} sont terminées. Résultat: {{#if passed}}Conforme{{else}}Non conforme{{/if}}.</p>',
    is_active: true,
  },
  {
    code: 'inspection-scheduled',
    channel: 'email',
    language: 'fr-MA',
    subject_template: 'Inspection programmée le {{scheduledDate}}',
    body_template:
      '<p>Une inspection est prévue le {{scheduledDate}} à {{location}} par {{inspectorName}}.</p>',
    is_active: true,
  },
];
