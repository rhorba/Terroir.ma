import { faker } from '@faker-js/faker';

export interface CooperativeFactoryOptions {
  overrides?: Partial<{
    id: string;
    name: string;
    nameAr: string | null;
    ice: string;
    ifNumber: string | null;
    email: string;
    phone: string;
    regionCode: string;
    city: string;
    presidentName: string;
    presidentCin: string;
    presidentPhone: string;
    createdBy: string;
    verifiedAt: Date | null;
  }>;
}

export function buildCooperative(opts: CooperativeFactoryOptions = {}) {
  return {
    id: faker.string.uuid(),
    name: `Coopérative ${faker.company.name()}`,
    nameAr: null,
    ice: faker.string.numeric(15),
    ifNumber: faker.string.numeric(8),
    rcNumber: null,
    email: faker.internet.email(),
    phone: '+212' + faker.string.numeric(9),
    address: null,
    regionCode: faker.helpers.arrayElement(['MRR', 'SFI', 'DKH', 'FES', 'TNG']),
    city: faker.location.city(),
    presidentName: faker.person.fullName(),
    presidentCin: faker.helpers.arrayElement(['AB', 'CD', 'EF']) + faker.string.numeric(5),
    presidentPhone: '+212' + faker.string.numeric(9),
    status: 'pending' as const,
    productTypes: [] as string[],
    verifiedAt: null,
    verifiedBy: null,
    createdBy: faker.string.uuid(),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    members: [],
    farms: [],
    ...opts.overrides,
  };
}

export function buildVerifiedCooperative(opts: CooperativeFactoryOptions = {}) {
  return buildCooperative({ overrides: { verifiedAt: new Date(), ...opts.overrides } });
}
