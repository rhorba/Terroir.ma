import { faker } from '@faker-js/faker';

export function buildScheduleInspectionDto(overrides: Record<string, unknown> = {}) {
  const scheduledDate = faker.date.future();
  return {
    certificationId: faker.string.uuid(),
    inspectorId: faker.string.uuid(),
    scheduledDate: scheduledDate.toISOString().split('T')[0],
    location: faker.helpers.arrayElement([
      'Ferme Coopérative Taliouine',
      'Arganier de Souss-Massa',
      'Palmeraie de Zagora',
    ]),
    notes: faker.lorem.sentence(),
    ...overrides,
  };
}

export function buildFileInspectionReportDto(overrides: Record<string, unknown> = {}) {
  return {
    passed: faker.datatype.boolean(),
    reportSummary: faker.lorem.sentence(5), // ensures >= 20 chars in practice
    detailedObservations: faker.lorem.paragraph(),
    nonConformities: faker.datatype.boolean() ? faker.lorem.sentence() : undefined,
    ...overrides,
  };
}
