import { faker } from '@faker-js/faker';

export function buildHarvest(overrides: Record<string, unknown> = {}) {
  return {
    id: faker.string.uuid(),
    cooperativeId: faker.string.uuid(),
    farmId: faker.string.uuid(),
    productTypeCode: faker.helpers.arrayElement(['ARGAN_OIL', 'SAFFRON', 'OLIVE_OIL_PICHOLINE', 'MEDJOOL_DATES']),
    harvestDate: faker.date.between({ from: '2025-10-01', to: '2026-04-30' }),
    quantityKg: faker.number.float({ min: 5, max: 2000, fractionDigits: 1 }),
    method: faker.helpers.arrayElement(['manual', 'semi-mechanical', 'mechanical']),
    notes: faker.lorem.sentence(),
    harvestedBy: faker.string.uuid(),
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
      harvestId: harvest.id,
      cooperativeId: harvest.cooperativeId,
      productTypeCode: harvest.productTypeCode,
      batchReference: `BATCH-${faker.string.alphanumeric(8).toUpperCase()}`,
      quantityKg: harvest.quantityKg,
    },
  };
}
