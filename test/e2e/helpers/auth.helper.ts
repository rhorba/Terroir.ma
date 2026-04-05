/**
 * E2E auth helper — builds mock JWT tokens for test requests.
 * In test environments, the JWT guard is replaced with TestAuthGuard
 * which accepts unsigned tokens with the correct payload structure.
 */

import { buildJwtPayload, buildCooperativeAdminJwt, buildCertificationBodyJwt, buildInspectorJwt } from '../../factories/user.factory';
import { buildMockJwt } from './../../helpers/app.helper';

export type Role =
  | 'super-admin'
  | 'cooperative-admin'
  | 'cooperative-member'
  | 'lab-technician'
  | 'inspector'
  | 'certification-body'
  | 'customs-agent'
  | 'consumer'
  | 'service-account';

export interface TestTokens {
  cooperativeAdmin: string;
  certificationBody: string;
  inspector: string;
  customsAgent: string;
  superAdmin: string;
  labTechnician: string;
}

/**
 * Generate a full set of test tokens for all roles used in E2E tests.
 */
export function generateTestTokens(): TestTokens {
  return {
    cooperativeAdmin: buildMockJwt(buildCooperativeAdminJwt()),
    certificationBody: buildMockJwt(buildCertificationBodyJwt()),
    inspector: buildMockJwt(buildInspectorJwt()),
    customsAgent: buildMockJwt(buildJwtPayload('customs-agent')),
    superAdmin: buildMockJwt(buildJwtPayload('super-admin')),
    labTechnician: buildMockJwt(buildJwtPayload('lab-technician')),
  };
}

/**
 * Authorization header for Supertest requests.
 */
export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}
