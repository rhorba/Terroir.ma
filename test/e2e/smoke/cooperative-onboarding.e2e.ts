/**
 * E2E smoke test: Cooperative onboarding flow.
 * POST /cooperatives → GET /cooperatives/:id → PUT /cooperatives/:id/verify
 *
 * Requires docker-compose.test.yml to be running.
 * Run with: npm run test:e2e
 */
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, buildMockJwt, bearerHeader } from '../../helpers/app.helper';
import { buildJwtPayload } from '../../factories/user.factory';

describe('Cooperative Onboarding Smoke (e2e)', () => {
  let app: INestApplication;
  let superAdminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    superAdminToken = buildMockJwt(buildJwtPayload('super-admin'));
  });

  afterAll(async () => {
    await app.close();
  });

  it('should create, retrieve, and verify a cooperative', async () => {
    // Step 1: Create cooperative
    const createRes = await request(app.getHttpServer())
      .post('/cooperatives')
      .set(bearerHeader(superAdminToken))
      .send({
        name: 'Coopérative Smoke Argan',
        ice: '001234567000099',
        email: 'smoke@terroir.ma',
        phone: '+212612345699',
        regionCode: 'SOUSS_MASSA',
        city: 'Tiznit',
        presidentName: 'Fatima Zahra Ait Benhamed',
        presidentCin: 'AB123456',
        presidentPhone: '+212612345600',
        productTypes: ['ARGAN'],
      });

    expect(createRes.status).toBe(201);
    const cooperativeId = (createRes.body?.id ?? createRes.body?.data?.id) as string;
    expect(cooperativeId).toBeTruthy();

    // Step 2: Retrieve cooperative
    const getRes = await request(app.getHttpServer())
      .get(`/cooperatives/${cooperativeId}`)
      .set(bearerHeader(superAdminToken));

    expect(getRes.status).toBe(200);
    const getBody = getRes.body?.data ?? getRes.body;
    expect(getBody?.id).toBe(cooperativeId);
    expect(getBody?.name).toBe('Coopérative Smoke Argan');

    // Step 3: Verify cooperative
    const verifyRes = await request(app.getHttpServer())
      .patch(`/cooperatives/${cooperativeId}/verify`)
      .set(bearerHeader(superAdminToken));

    expect(verifyRes.status).toBe(200);
    const verifyBody = verifyRes.body?.data ?? verifyRes.body;
    expect(verifyBody?.status).toBe('active');
  });
});
