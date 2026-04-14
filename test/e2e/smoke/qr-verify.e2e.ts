/**
 * E2E smoke test: QR verification + scan-stats flow (US-058).
 * Verifies the verify endpoint is publicly reachable and scan-stats is role-protected.
 *
 * Requires docker-compose.test.yml to be running.
 * Run with: npm run test:e2e
 */
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, buildMockJwt, bearerHeader } from '../../helpers/app.helper';
import { buildJwtPayload } from '../../factories/user.factory';

describe('QR Verify + Scan Stats Smoke (e2e)', () => {
  let app: INestApplication;
  let superAdminToken: string;
  let cooperativeAdminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    superAdminToken = buildMockJwt(buildJwtPayload('super-admin'));
    cooperativeAdminToken = buildMockJwt(buildJwtPayload('cooperative-admin'));
  });

  afterAll(async () => {
    await app.close();
  });

  it('should reach the verify endpoint without authentication', async () => {
    const res = await request(app.getHttpServer()).get(
      '/verify/000000000000000000000000000000000000000000000000000000000000abcd',
    );
    // Must not 401 — endpoint is public
    expect(res.status).not.toBe(401);
    expect([200, 404]).toContain(res.status);
  });

  it('should return 404 for a non-existent HMAC signature', async () => {
    const res = await request(app.getHttpServer()).get(
      '/verify/0000000000000000000000000000000000000000000000000000000000000000',
    );
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body?.data?.valid).toBe(false);
    }
  });

  it('should require super-admin or certification-body for scan-stats', async () => {
    const certId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01';

    // cooperative-admin should be forbidden
    const forbiddenRes = await request(app.getHttpServer())
      .get(`/certifications/${certId}/scan-stats`)
      .set(bearerHeader(cooperativeAdminToken));
    expect([403, 404]).toContain(forbiddenRes.status);

    // super-admin should be allowed (404 if cert doesn't exist, but not 403)
    const allowedRes = await request(app.getHttpServer())
      .get(`/certifications/${certId}/scan-stats`)
      .set(bearerHeader(superAdminToken));
    expect([200, 404]).toContain(allowedRes.status);
  });
});
