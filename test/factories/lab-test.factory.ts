import { faker } from '@faker-js/faker';

export function buildLabTestEvent(overrides: Record<string, unknown> = {}) {
  return {
    eventId: faker.string.uuid(),
    version: '1.0',
    timestamp: faker.date.recent().toISOString(),
    correlationId: faker.string.uuid(),
    batchId: faker.string.uuid(),
    batchReference: `BATCH-${faker.string.alphanumeric(8).toUpperCase()}`,
    cooperativeId: faker.string.uuid(),
    productName: faker.helpers.arrayElement([
      "Huile d'Argan",
      'Safran de Taliouine',
      "Huile d'Olive Picholine",
    ]),
    productTypeCode: faker.helpers.arrayElement(['ARGAN_OIL', 'SAFFRON', 'OLIVE_OIL_PICHOLINE']),
    passed: faker.datatype.boolean(),
    completedAt: faker.date.recent().toISOString(),
    labId: faker.string.uuid(),
    labName: faker.helpers.arrayElement([
      'Laboratoire Officiel ONSSA Agadir',
      'LCM Casablanca',
      'LPEE Marrakech',
    ]),
    parameters: {},
    ...overrides,
  };
}

export function buildPassingLabTestEvent(overrides: Record<string, unknown> = {}) {
  return buildLabTestEvent({ passed: true, ...overrides });
}

export function buildFailingLabTestEvent(overrides: Record<string, unknown> = {}) {
  return buildLabTestEvent({ passed: false, ...overrides });
}
