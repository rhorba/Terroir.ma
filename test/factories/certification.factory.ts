import { faker } from '@faker-js/faker';

export function buildCertificationRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: faker.string.uuid(),
    cooperativeId: faker.string.uuid(),
    batchId: faker.string.uuid(),
    certificationTypeCode: faker.helpers.arrayElement(['AOP', 'IGP', 'LA']),
    productTypeCode: faker.helpers.arrayElement(['ARGAN_OIL', 'SAFFRON', 'OLIVE_OIL_PICHOLINE']),
    regionCode: faker.helpers.arrayElement(['MRR', 'SFI', 'DKH']),
    status: 'pending',
    certificationNumber: null,
    requestedAt: faker.date.past(),
    createdAt: faker.date.past(),
    ...overrides,
  };
}

export function buildGrantedCertification(overrides: Record<string, unknown> = {}) {
  const year = 2025;
  const seq = faker.number.int({ min: 1, max: 999 });
  const type = faker.helpers.arrayElement(['AOP', 'IGP', 'LA']);
  const region = faker.helpers.arrayElement(['MRR', 'SFI', 'DKH']);

  return buildCertificationRequest({
    status: 'granted',
    certificationNumber: `TERROIR-${type}-${region}-${year}-${String(seq).padStart(3, '0')}`,
    grantedAt: faker.date.recent(),
    ...overrides,
  });
}
