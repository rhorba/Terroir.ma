import { faker } from '@faker-js/faker';
import { CertificationStatus } from '../../src/modules/certification/entities/certification.entity';
import { CertificationType } from '../../src/common/interfaces/morocco.interface';

export function buildCertificationRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: faker.string.uuid(),
    cooperativeId: faker.string.uuid(),
    cooperativeName: faker.company.name(),
    batchId: faker.string.uuid(),
    certificationType: faker.helpers.arrayElement([
      'AOP',
      'IGP',
      'LABEL_AGRICOLE',
    ]) as CertificationType,
    productTypeCode: faker.helpers.arrayElement(['ARGAN_OIL', 'SAFFRON', 'OLIVE_OIL_PICHOLINE']),
    regionCode: faker.helpers.arrayElement(['MRR', 'SFI', 'DKH']),
    status: 'pending' as CertificationStatus,
    certificationNumber: null,
    requestedBy: faker.string.uuid(),
    requestedAt: faker.date.past(),
    grantedBy: null,
    grantedAt: null,
    validFrom: null,
    validUntil: null,
    deniedBy: null,
    deniedAt: null,
    denialReason: null,
    revokedBy: null,
    revokedAt: null,
    revocationReason: null,
    renewedFromId: null,
    createdBy: faker.string.uuid(),
    createdAt: faker.date.past(),
    deletedAt: null,
    ...overrides,
  };
}

export function buildGrantedCertification(overrides: Record<string, unknown> = {}) {
  const year = 2025;
  const seq = faker.number.int({ min: 1, max: 999 });
  const type = faker.helpers.arrayElement(['AOP', 'IGP', 'LA']);
  const region = faker.helpers.arrayElement(['MRR', 'SFI', 'DKH']);

  return buildCertificationRequest({
    status: 'granted' as CertificationStatus,
    certificationNumber: `TERROIR-${type}-${region}-${year}-${String(seq).padStart(3, '0')}`,
    grantedAt: faker.date.recent(),
    grantedBy: faker.string.uuid(),
    validFrom: '2025-01-01',
    validUntil: '2026-01-01',
    ...overrides,
  });
}
