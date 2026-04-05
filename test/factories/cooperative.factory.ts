import { faker } from '@faker-js/faker';

export interface CooperativeFactoryOptions {
  overrides?: Partial<{
    id: string;
    name: string;
    registrationNumber: string;
    iceNumber: string;
    ifNumber: string;
    regionCode: string;
    adminUserId: string;
    isVerified: boolean;
  }>;
}

export function buildCooperative(opts: CooperativeFactoryOptions = {}) {
  return {
    id: faker.string.uuid(),
    name: `Coopérative ${faker.company.name()}`,
    registrationNumber: `RC-${faker.number.int({ min: 10000, max: 99999 })}`,
    iceNumber: faker.string.numeric(15),
    ifNumber: faker.string.numeric(8),
    regionCode: faker.helpers.arrayElement(['MRR', 'SFI', 'DKH', 'FES', 'TNG']),
    adminUserId: faker.string.uuid(),
    isVerified: false,
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...opts.overrides,
  };
}

export function buildVerifiedCooperative(opts: CooperativeFactoryOptions = {}) {
  return buildCooperative({ overrides: { isVerified: true, ...opts.overrides } });
}
