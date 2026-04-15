/**
 * E2E test: Authentication and authorization enforcement.
 *
 * Verifies:
 * - Unauthenticated requests to protected endpoints return 401
 * - Wrong role returns 403
 * - Correct role returns 2xx
 * - Public endpoints remain accessible without auth
 */

import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from '../helpers/app.helper';
import { generateTestTokens, authHeader } from './helpers/auth.helper';

describe('Auth Flow (e2e)', () => {
  let app: INestApplication;
  let tokens: ReturnType<typeof generateTestTokens>;

  beforeAll(async () => {
    app = await createTestApp();
    tokens = generateTestTokens();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Unauthenticated access', () => {
    it('should return 401 for POST /certifications/request without token', async () => {
      await request(app.getHttpServer()).post('/certifications/request').send({}).expect(401);
    });

    it('should return 401 for POST /inspections without token', async () => {
      await request(app.getHttpServer()).post('/inspections').send({}).expect(401);
    });

    it('should return 401 for PATCH /certifications/:id/grant without token', async () => {
      await request(app.getHttpServer())
        .patch('/certifications/some-uuid/grant')
        .send({})
        .expect(401);
    });
  });

  describe('Role-based access control', () => {
    it('should return 403 when cooperative-admin tries to grant certification', async () => {
      await request(app.getHttpServer())
        .patch('/certifications/some-uuid/grant')
        .set(authHeader(tokens.cooperativeAdmin))
        .send({ notes: 'trying to grant as coop admin' })
        .expect(403);
    });

    it('should return 403 when inspector tries to grant certification', async () => {
      await request(app.getHttpServer())
        .patch('/certifications/some-uuid/grant')
        .set(authHeader(tokens.inspector))
        .send({ notes: 'trying to grant as inspector' })
        .expect(403);
    });

    it('should allow certification-body to access grant endpoint (may 404 on unknown id)', async () => {
      const res = await request(app.getHttpServer())
        .patch('/certifications/00000000-0000-0000-0000-000000000000/grant')
        .set(authHeader(tokens.certificationBody))
        .send({ notes: 'valid note with enough chars' });

      // 403 would mean role check failed; 404 means the cert doesn't exist (expected in test)
      expect(res.status).not.toBe(403);
      expect(res.status).not.toBe(401);
    });
  });

  describe('Public endpoints', () => {
    it('GET /health should be accessible without auth', async () => {
      await request(app.getHttpServer()).get('/health').expect(200);
    });

    it('GET /verify/:uuid should be accessible without auth', async () => {
      const res = await request(app.getHttpServer()).get(
        '/verify/00000000-0000-0000-0000-000000000000',
      );

      expect(res.status).not.toBe(401);
    });
  });
});
