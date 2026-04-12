import { faker } from '@faker-js/faker';

type TerroirRole =
  | 'super-admin'
  | 'cooperative-admin'
  | 'cooperative-member'
  | 'lab-technician'
  | 'inspector'
  | 'certification-body'
  | 'customs-agent'
  | 'consumer'
  | 'service-account';

export interface MockJwtPayload {
  [key: string]: unknown;
  sub: string;
  email: string;
  realm_access: { roles: TerroirRole[] };
  resource_access: Record<string, { roles: string[] }>;
  name: string;
  preferred_username: string;
  cooperativeId?: string;
}

export function buildJwtPayload(
  role: TerroirRole,
  overrides: Partial<MockJwtPayload> = {},
): MockJwtPayload {
  return {
    sub: faker.string.uuid(),
    email: faker.internet.email(),
    name: faker.person.fullName(),
    preferred_username: faker.internet.userName(),
    realm_access: { roles: [role] },
    resource_access: { 'terroir-ma': { roles: [role] } },
    ...overrides,
  };
}

export function buildCooperativeAdminJwt(cooperativeId?: string): MockJwtPayload {
  return buildJwtPayload('cooperative-admin', {
    cooperativeId: cooperativeId ?? faker.string.uuid(),
  });
}

export function buildCertificationBodyJwt(): MockJwtPayload {
  return buildJwtPayload('certification-body');
}

export function buildInspectorJwt(): MockJwtPayload {
  return buildJwtPayload('inspector');
}
