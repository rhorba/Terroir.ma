/**
 * Seed fixture for notification templates.
 * Used by integration tests to populate the notification.notification_template table.
 */
export const NOTIFICATION_TEMPLATE_FIXTURES = [
  {
    code: 'certification-granted',
    channel: 'email',
    language: 'fr-MA',
    subjectTemplate: 'Certification {{certificationNumber}} accordée — Terroir.ma',
    bodyTemplate: '<p>Félicitations {{cooperativeName}}, votre certification {{certificationNumber}} a été accordée le {{grantedAt}}.</p>',
    isActive: true,
  },
  {
    code: 'certification-granted',
    channel: 'email',
    language: 'ar-MA',
    subjectTemplate: 'تم منح الشهادة {{certificationNumber}} — Terroir.ma',
    bodyTemplate: '<p dir="rtl">تهانينا {{cooperativeName}}، تم منح شهادتكم {{certificationNumber}} بتاريخ {{grantedAt}}.</p>',
    isActive: true,
  },
  {
    code: 'lab-test-completed',
    channel: 'email',
    language: 'fr-MA',
    subjectTemplate: 'Résultats d\'analyses — Lot {{batchReference}}',
    bodyTemplate: '<p>Les analyses du lot {{batchReference}} sont terminées. Résultat: {{#if passed}}Conforme{{else}}Non conforme{{/if}}.</p>',
    isActive: true,
  },
  {
    code: 'inspection-scheduled',
    channel: 'email',
    language: 'fr-MA',
    subjectTemplate: 'Inspection programmée le {{scheduledDate}}',
    bodyTemplate: '<p>Une inspection est prévue le {{scheduledDate}} à {{location}} par {{inspectorName}}.</p>',
    isActive: true,
  },
];
