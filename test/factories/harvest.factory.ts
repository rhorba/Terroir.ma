import { faker } from '@faker-js/faker';

export function buildHarvest(overrides: Record<string, unknown> = {}) {
  const harvestDate = faker.date.between({ from: '2025-10-01', to: '2026-04-30' });
  const month = harvestDate.getMonth();
  const year = harvestDate.getFullYear();
  const campaignStart = month >= 9 ? year : year - 1;
  const campaignYear = `${campaignStart}/${campaignStart + 1}`;

  return {
    id: faker.string.uuid(),
    cooperativeId: faker.string.uuid(),
    farmId: faker.string.uuid(),
    productTypeCode: faker.helpers.arrayElement([
      'ARGAN_OIL',
      'SAFFRON',
      'OLIVE_OIL_PICHOLINE',
      'MEDJOOL_DATES',
    ]),
    harvestDate: harvestDate.toISOString().split('T')[0]! as string,
    campaignYear,
    quantityKg: faker.number.float({ min: 5, max: 2000, fractionDigits: 1 }),
    method: faker.helpers.arrayElement(['manual', 'semi-mechanical', 'mechanical']),
    metadata: null,
    createdBy: faker.string.uuid(),
    createdAt: faker.date.past(),
    ...overrides,
  };
}

export function buildHarvestWithBatch(overrides: Record<string, unknown> = {}) {
  const harvest = buildHarvest(overrides);
  return {
    harvest,
    batch: {
      id: faker.string.uuid(),
      harvestIds: [harvest.id],
      cooperativeId: harvest.cooperativeId,
      productTypeCode: harvest.productTypeCode,
      batchNumber: `BATCH-${faker.string.alphanumeric(8).toUpperCase()}`,
      totalQuantityKg: harvest.quantityKg,
    },
  };
}
