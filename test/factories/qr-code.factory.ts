import { faker } from '@faker-js/faker';
import * as crypto from 'crypto';

export function buildQrCode(overrides: Record<string, unknown> = {}) {
  return {
    id: faker.string.uuid(),
    certificationId: faker.string.uuid(),
    certificationNumber: `TERROIR-AOP-SFI-2025-${String(faker.number.int({ min: 1, max: 999 })).padStart(3, '0')}`,
    hmacSignature: faker.string.hexadecimal({ length: 64, casing: 'lower' }).replace('0x', ''),
    verifyUrl: `https://terroir.ma/verify/${faker.string.uuid()}`,
    generatedAt: faker.date.recent(),
    isActive: true,
    createdAt: faker.date.past(),
    ...overrides,
  };
}

/**
 * Build a QR verification payload with a real HMAC signature.
 * Used when testing the actual signature validation logic.
 */
export function buildVerifiedQrPayload(secret: string, certificationId: string) {
  const uuid = faker.string.uuid();
  const certificationNumber = `TERROIR-AOP-SFI-2025-001`;
  const data = `${uuid}:${certificationId}:${certificationNumber}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('hex');

  return {
    uuid,
    certificationId,
    certificationNumber,
    sig,
    verifyUrl: `https://terroir.ma/verify/${uuid}?sig=${sig}`,
  };
}
