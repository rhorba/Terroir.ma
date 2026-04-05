import { faker } from '@faker-js/faker';
import type { SendNotificationOptions } from '../../src/modules/notification/services/notification.service';

export function buildSendNotificationOptions(
  overrides: Partial<SendNotificationOptions> = {},
): SendNotificationOptions {
  return {
    recipientId: faker.string.uuid(),
    recipientEmail: faker.internet.email(),
    channel: 'email',
    templateCode: 'certification-granted',
    language: faker.helpers.arrayElement(['fr-MA', 'ar-MA', 'zgh']),
    context: {
      certificationNumber: `TERROIR-AOP-MRR-2025-${String(faker.number.int({ min: 1, max: 999 })).padStart(3, '0')}`,
      cooperativeName: `Coopérative ${faker.company.name()}`,
      productName: faker.helpers.arrayElement(['Huile d\'Argan', 'Safran', 'Dattes Medjoul']),
      grantedAt: faker.date.recent().toISOString(),
    },
    triggerEventId: faker.string.uuid(),
    correlationId: faker.string.uuid(),
    ...overrides,
  };
}

export function buildNotificationTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: faker.string.uuid(),
    code: 'certification-granted',
    channel: 'email',
    language: 'fr-MA',
    subjectTemplate: 'Certification {{certificationNumber}} accordée',
    bodyTemplate: '<p>Félicitations {{cooperativeName}}</p>',
    isActive: true,
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...overrides,
  };
}
