/**
 * Static cooperative fixtures for integration/e2e tests.
 * These have stable UUIDs so foreign-key references are predictable.
 */
export const COOPERATIVE_FIXTURES = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Coopérative Féminine Tissadert',
    registrationNumber: 'RC-12345',
    iceNumber: '001234567890001',
    ifNumber: '12345678',
    regionCode: 'SFI',
    adminUserId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    isVerified: true,
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Coopérative Safran Taliouine',
    registrationNumber: 'RC-67890',
    iceNumber: '009876543210009',
    ifNumber: '87654321',
    regionCode: 'SFI',
    adminUserId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    isVerified: true,
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Coopérative Dattes Erfoud',
    registrationNumber: 'RC-11111',
    iceNumber: '005555555555555',
    ifNumber: '55555555',
    regionCode: 'DKH',
    adminUserId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    isVerified: false,
  },
];
