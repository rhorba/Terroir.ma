import { faker } from '@faker-js/faker';

export interface ProductBatchOverrides {
  id?: string;
  cooperativeId?: string;
  productTypeCode?: string;
  batchReference?: string;
  quantityKg?: number;
  harvestDate?: Date;
  campaignYear?: string;
  harvestId?: string;
}

export function buildProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: faker.string.uuid(),
    cooperativeId: faker.string.uuid(),
    productTypeCode: faker.helpers.arrayElement(['ARGAN_OIL', 'SAFFRON', 'OLIVE_OIL_PICHOLINE', 'MEDJOOL_DATES', 'ROSE_DADES']),
    name: faker.helpers.arrayElement(["Huile d'Argan", 'Safran de Taliouine', "Huile d'Olive Picholine"]),
    regionCode: faker.helpers.arrayElement(['MRR', 'SFI', 'DKH', 'FES']),
    sdoqSpecificationRef: `SPEC-${faker.string.alphanumeric(6).toUpperCase()}`,
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...overrides,
  };
}

export function buildProductBatch(opts: { overrides?: ProductBatchOverrides } = {}) {
  const harvestDate = faker.date.between({ from: '2025-10-01', to: '2026-05-31' });

  // Campaign year: Oct–Sep
  const month = harvestDate.getMonth();
  const year = harvestDate.getFullYear();
  const campaignStart = month >= 9 ? year : year - 1;
  const campaignYear = `${campaignStart}-${campaignStart + 1}`;

  return {
    id: faker.string.uuid(),
    cooperativeId: faker.string.uuid(),
    productTypeCode: faker.helpers.arrayElement(['ARGAN_OIL', 'SAFFRON', 'OLIVE_OIL_PICHOLINE']),
    batchReference: `BATCH-${faker.string.alphanumeric(8).toUpperCase()}`,
    quantityKg: faker.number.float({ min: 10, max: 5000, fractionDigits: 2 }),
    harvestDate,
    campaignYear,
    harvestId: faker.string.uuid(),
    status: 'created',
    createdAt: faker.date.past(),
    ...opts.overrides,
  };
}
