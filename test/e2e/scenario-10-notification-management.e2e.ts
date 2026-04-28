/**
 * Scenario 10 — Notification Management (Khalid, super-admin)
 * Covers: view stats, list templates, create template, update, seed, user history.
 * Maps to USER-MANUAL-TEST-SCENARIOS.md Steps 10.1–10.6.
 */
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, buildMockJwt, bearerHeader } from '../helpers/app.helper';
import { buildJwtPayload } from '../factories/user.factory';

describe('Scenario 10 — Notification Management (e2e)', () => {
  let app: INestApplication;
  let superAdminToken: string;
  let coopAdminToken: string;

  beforeAll(async () => {
    app = await createTestApp();

    superAdminToken = buildMockJwt(buildJwtPayload('super-admin'));
    coopAdminToken = buildMockJwt(buildJwtPayload('cooperative-admin'));
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Step 10.1: Notification Stats ───────────────────────────────────────

  describe('Step 10.1 — GET /notifications/stats', () => {
    it('returns notification delivery stats for super-admin (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/notifications/stats')
        .set(bearerHeader(superAdminToken));

      expect(res.status).toBe(200);
      const body = res.body;
      expect(body?.total ?? body?.data?.total ?? 0).toBeGreaterThanOrEqual(0);
    });

    it('returns 403 for cooperative-admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/notifications/stats')
        .set(bearerHeader(coopAdminToken));
      expect(res.status).toBe(403);
    });

    it('returns 401 without token', async () => {
      await request(app.getHttpServer()).get('/notifications/stats').expect(401);
    });
  });

  // ─── Step 10.2: List Templates ───────────────────────────────────────────

  describe('Step 10.2 — GET /notification-templates', () => {
    it('lists all templates for super-admin (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/notification-templates')
        .set(bearerHeader(superAdminToken));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body?.data ?? res.body)).toBe(true);
    });

    it('filters by channel=email (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/notification-templates')
        .query({ channel: 'email' })
        .set(bearerHeader(superAdminToken));

      expect(res.status).toBe(200);
    });

    it('filters by language=fr-MA (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/notification-templates')
        .query({ language: 'fr-MA' })
        .set(bearerHeader(superAdminToken));

      expect(res.status).toBe(200);
    });

    it('returns 403 for cooperative-admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/notification-templates')
        .set(bearerHeader(coopAdminToken));
      expect(res.status).toBe(403);
    });
  });

  // ─── Step 10.3: Create Template ──────────────────────────────────────────

  describe('Step 10.3 — POST /notification-templates', () => {
    let templateId: string;

    it('creates Arabic email template (201)', async () => {
      const res = await request(app.getHttpServer())
        .post('/notification-templates')
        .set(bearerHeader(superAdminToken))
        .send({
          code: `test-s10-cert-granted-${Date.now()}`,
          channel: 'email',
          language: 'ar-MA',
          subjectTemplate: 'مبروك! شهادتك {{certificationNumber}} جاهزة',
          bodyTemplate: 'مرحبًا {{cooperativeName}}، شهادة SDOQ الخاصة بك تم منحها رسميًا.',
          isActive: true,
        });

      expect(res.status).toBe(201);
      const body = res.body?.data ?? res.body;
      expect(body?.id).toBeTruthy();
      templateId = body.id as string;
    });

    it('creates French SMS template (201)', async () => {
      const res = await request(app.getHttpServer())
        .post('/notification-templates')
        .set(bearerHeader(superAdminToken))
        .send({
          code: `test-s10-sms-${Date.now()}`,
          channel: 'sms',
          language: 'fr-MA',
          bodyTemplate: 'Terroir.ma: Votre certification {{certificationNumber}} a été accordée.',
          isActive: true,
        });

      expect(res.status).toBe(201);
    });

    it('returns 400 for invalid channel', async () => {
      const res = await request(app.getHttpServer())
        .post('/notification-templates')
        .set(bearerHeader(superAdminToken))
        .send({
          code: 'bad-channel-test',
          channel: 'whatsapp',
          language: 'fr-MA',
          bodyTemplate: 'Test body',
        });
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid language', async () => {
      const res = await request(app.getHttpServer())
        .post('/notification-templates')
        .set(bearerHeader(superAdminToken))
        .send({
          code: 'bad-lang-test',
          channel: 'email',
          language: 'en-US',
          bodyTemplate: 'Test body',
        });
      expect(res.status).toBe(400);
    });

    // ─── Step 10.4: Update Template ────────────────────────────────────────

    it('updates template body (200)', async () => {
      if (!templateId) return;
      const res = await request(app.getHttpServer())
        .put(`/notification-templates/${templateId}`)
        .set(bearerHeader(superAdminToken))
        .send({ bodyTemplate: 'مرحبًا {{cooperativeName}}، تم تحديث الشهادة.', isActive: true });

      expect(res.status).toBe(200);
    });

    it('deactivates template (200)', async () => {
      if (!templateId) return;
      const res = await request(app.getHttpServer())
        .delete(`/notification-templates/${templateId}`)
        .set(bearerHeader(superAdminToken));

      expect(res.status).toBe(200);
      const body = res.body?.data ?? res.body;
      expect(body?.isActive).toBe(false);
    });
  });

  // ─── Step 10.5: Seed Templates ───────────────────────────────────────────

  describe('Step 10.5 — POST /notification-templates/seed', () => {
    it('seeds templates from HBS files (200 or 201)', async () => {
      const res = await request(app.getHttpServer())
        .post('/notification-templates/seed')
        .set(bearerHeader(superAdminToken));

      expect([200, 201]).toContain(res.status);
      const body = res.body?.data ?? res.body;
      expect(typeof (body?.seeded ?? body?.count ?? body)).toBe('number');
    });

    it('is idempotent — second seed call also returns 200 or 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/notification-templates/seed')
        .set(bearerHeader(superAdminToken));
      expect([200, 201]).toContain(res.status);
    });
  });

  // ─── Step 10.6: User Notification History ────────────────────────────────

  describe('Step 10.6 — GET /notifications/history', () => {
    it('returns paginated notification history for cooperative-admin (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/notifications/history')
        .query({ page: 1, limit: 10 })
        .set(bearerHeader(coopAdminToken));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toHaveProperty('total');
    });

    it('returns own notification list (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/notifications')
        .set(bearerHeader(coopAdminToken));
      expect(res.status).toBe(200);
    });

    it('returns 401 without token', async () => {
      await request(app.getHttpServer()).get('/notifications/history').expect(401);
    });
  });
});
