import { faker } from '@faker-js/faker';
import { BatchStatus } from '../../src/modules/product/entities/production-batch.entity';

export interface ProductBatchOverrides {
  id?: string;
  cooperativeId?: string;
  productTypeCode?: string;
  batchNumber?: string;
  totalQuantityKg?: number;
  processingDate?: string;
  harvestIds?: string[];
  status?: BatchStatus;
  createdBy?: string;
}

export function buildProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: faker.string.uuid(),
    cooperativeId: faker.string.uuid(),
    productTypeCode: faker.helpers.arrayElement([
      'ARGAN_OIL',
      'SAFFRON',
      'OLIVE_OIL_PICHOLINE',
      'MEDJOOL_DATES',
      'ROSE_DADES',
    ]),
    name: faker.helpers.arrayElement([
      "Huile d'Argan",
      'Safran de Taliouine',
      "Huile d'Olive Picholine",
    ]),
    regionCode: faker.helpers.arrayElement(['MRR', 'SFI', 'DKH', 'FES']),
    sdoqSpecificationRef: `SPEC-${faker.string.alphanumeric(6).toUpperCase()}`,
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...overrides,
  };
}

export function buildProductBatch(opts: { overrides?: ProductBatchOverrides } = {}) {
  const processingDate = faker.date.between({ from: '2025-10-01', to: '2026-05-31' });

  return {
    id: faker.string.uuid(),
    cooperativeId: faker.string.uuid(),
    productTypeCode: faker.helpers.arrayElement(['ARGAN_OIL', 'SAFFRON', 'OLIVE_OIL_PICHOLINE']),
    batchNumber: `BATCH-${faker.string.alphanumeric(8).toUpperCase()}`,
    totalQuantityKg: faker.number.float({ min: 10, max: 5000, fractionDigits: 2 }),
    processingDate: processingDate.toISOString().split('T')[0]!,
    harvestIds: [faker.string.uuid()],
    status: 'created' as const,
    createdBy: faker.string.uuid(),
    createdAt: faker.date.past(),
    ...opts.overrides,
  };
}
