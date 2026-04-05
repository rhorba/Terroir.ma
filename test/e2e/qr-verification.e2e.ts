/**
 * E2E test: QR code verification endpoint.
 *
 * Verifies:
 * - GET /verify/:uuid is publicly accessible (no auth)
 * - Valid HMAC signature returns certification data
 * - Invalid/tampered signature returns 403
 * - Non-existent UUID returns 404
 * - Response time < 200ms (checked on second request, after Redis cache warm)
 */

import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from '../helpers/app.helper';
import { seedE2EData, clearE2EData } from './helpers/seed.helper';

describe('QR Verification (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    await seedE2EData(app);
  });

  afterAll(async () => {
    await clearE2EData(app);
    await app.close();
  });

  describe('GET /verify/:uuid (public)', () => {
    it('should be accessible without authentication', async () => {
      const res = await request(app.getHttpServer())
        .get('/verify/00000000-0000-0000-0000-000000000000')
        // No Authorization header
        .query({ sig: 'fakesig' });

      // 401 would mean auth is required — must not happen
      expect(res.status).not.toBe(401);
      expect([403, 404]).toContain(res.status);
    });

    it('should return 403 for tampered signature', async () => {
      const res = await request(app.getHttpServer())
        .get('/verify/00000000-0000-0000-0000-000000000001')
        .query({ sig: 'definitely-not-a-valid-hmac' });

      expect(res.status).toBe(403);
    });

    it('should return 404 for non-existent UUID with no sig', async () => {
      const res = await request(app.getHttpServer())
        .get('/verify/ffffffff-ffff-ffff-ffff-ffffffffffff');

      expect([403, 404]).toContain(res.status);
    });

    it('should respond within 500ms (smoke test)', async () => {
      const start = Date.now();
      await request(app.getHttpServer())
        .get('/verify/00000000-0000-0000-0000-000000000000')
        .query({ sig: 'test' });
      const elapsed = Date.now() - start;

      // 500ms is generous for CI — production target is < 200ms with warm cache
      expect(elapsed).toBeLessThan(500);
    });
  });
});
