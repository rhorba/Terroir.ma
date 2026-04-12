/**
 * E2E test: Certification API endpoints.
 * Requires docker-compose.test.yml to be running (PostgreSQL + Keycloak + Redpanda).
 * Run with: docker-compose -f docker-compose.test.yml up -d && npm run test:e2e
 */
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, buildMockJwt, bearerHeader } from '../../helpers/app.helper';
import { buildCooperativeAdminJwt } from '../../factories/user.factory';

describe('Certification API (e2e)', () => {
  let app: INestApplication;
  let cooperativeAdminToken: string;

  beforeAll(async () => {
    app = await createTestApp();

    cooperativeAdminToken = buildMockJwt(buildCooperativeAdminJwt());
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /certifications/request', () => {
    it('should require authentication', async () => {
      await request(app.getHttpServer()).post('/certifications/request').send({}).expect(401);
    });

    it('should return 400 for missing required fields', async () => {
      await request(app.getHttpServer())
        .post('/certifications/request')
        .set(bearerHeader(cooperativeAdminToken))
        .send({})
        .expect(400);
    });
  });

  describe('GET /verify/:uuid', () => {
    it('should be publicly accessible without authentication', async () => {
      // QR verification endpoint must be public
      const response = await request(app.getHttpServer())
        .get('/verify/00000000-0000-0000-0000-000000000000')
        .expect((res) => {
          // 404 is acceptable (QR not found), but 401 is not
          expect(res.status).not.toBe(401);
        });

      expect([200, 404]).toContain(response.status);
    });
  });
});
