/**
 * Scenario 1 — Super-Admin: Platform Setup & Oversight (Khalid)
 * Covers: dashboard, audit logs, DLQ stats, campaign settings, lab lifecycle.
 * Maps to USER-MANUAL-TEST-SCENARIOS.md Steps 1.2–1.8.
 */
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp, buildMockJwt, bearerHeader } from '../helpers/app.helper';
import { buildJwtPayload } from '../factories/user.factory';

const S1_COOP_ID = 'a1000000-0000-4000-8000-000000000001';
const S1_USER_ID = 'a1000000-0000-4000-8000-000000000099';

describe('Scenario 1 — Super-Admin: Platform Setup & Oversight (e2e)', () => {
  let app: INestApplication;
  let superAdminToken: string;
  let cooperativeAdminToken: string;
  let ds: DataSource;

  beforeAll(async () => {
    app = await createTestApp();
    ds = app.get(DataSource);

    superAdminToken = buildMockJwt(buildJwtPayload('super-admin', { sub: S1_USER_ID }));
    cooperativeAdminToken = buildMockJwt(
      buildJwtPayload('cooperative-admin', { sub: S1_USER_ID, cooperative_id: S1_COOP_ID }),
    );

    // Seed a pending cooperative for the verify test
    await ds.query(
      `INSERT INTO cooperative.cooperative
       (id, name, ice, email, phone, region_code, city, president_name, president_cin, president_phone, status, product_types, created_by)
       VALUES ($1,'Coopérative Test S1','001111111111111','s1@coop.ma','+212660000001','SOUSS_MASSA','Agadir','Test President','A123456','+212660000002','pending','["SAFFRON"]',$2)
       ON CONFLICT DO NOTHING`,
      [S1_COOP_ID, S1_USER_ID],
    );
  });

  afterAll(async () => {
    await ds.query(`DELETE FROM cooperative.cooperative WHERE id = $1`, [S1_COOP_ID]);
    await app.close();
  });

  // ─── Step 1.2: Platform Dashboard ─────────────────────────────────────────

  describe('Step 1.2 — GET /admin/dashboard', () => {
    it('returns platform metrics for super-admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/dashboard')
        .set(bearerHeader(superAdminToken));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('cooperatives');
      expect(res.body.data).toHaveProperty('certifications');
    });

    it('returns 403 for cooperative-admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/dashboard')
        .set(bearerHeader(cooperativeAdminToken));

      expect(res.status).toBe(403);
    });

    it('returns 401 without token', async () => {
      await request(app.getHttpServer()).get('/admin/dashboard').expect(401);
    });
  });

  // ─── Step 1.4: Verify Cooperative ────────────────────────────────────────

  describe('Step 1.4 — PATCH /cooperatives/:id/verify', () => {
    it('sets cooperative status to active', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/cooperatives/${S1_COOP_ID}/verify`)
        .set(bearerHeader(superAdminToken));

      expect(res.status).toBe(200);
      const body = res.body?.data ?? res.body;
      expect(body?.status).toBe('active');
    });

    it('returns 403 when cooperative-admin calls verify', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/cooperatives/${S1_COOP_ID}/verify`)
        .set(bearerHeader(cooperativeAdminToken));

      expect(res.status).toBe(403);
    });
  });

  // ─── Step 1.5: Lab Lifecycle ──────────────────────────────────────────────

  describe('Step 1.5 — POST /labs + POST /labs/:id/accredit', () => {
    let labId: string;

    it('creates a laboratory (201)', async () => {
      const res = await request(app.getHttpServer())
        .post('/labs')
        .set(bearerHeader(superAdminToken))
        .send({
          name: 'Laboratoire ONSSA Agadir S1',
          onssaAccreditationNumber: 'ONSSA-LAB-S1-001',
        });

      expect(res.status).toBe(201);
      const body = res.body?.data ?? res.body;
      expect(body?.id).toBeTruthy();
      labId = body.id as string;
    });

    it('accredits the laboratory (200)', async () => {
      if (!labId) return;
      const res = await request(app.getHttpServer())
        .post(`/labs/${labId}/accredit`)
        .set(bearerHeader(superAdminToken));

      expect(res.status).toBe(200);
      const body = res.body?.data ?? res.body;
      expect(body?.isAccredited).toBe(true);
    });

    it('revokes accreditation (200)', async () => {
      if (!labId) return;
      const res = await request(app.getHttpServer())
        .post(`/labs/${labId}/revoke`)
        .set(bearerHeader(superAdminToken));

      expect(res.status).toBe(200);
      const body = res.body?.data ?? res.body;
      expect(body?.isAccredited).toBe(false);
    });

    it('returns 403 when cooperative-admin lists labs', async () => {
      const res = await request(app.getHttpServer())
        .get('/labs')
        .set(bearerHeader(cooperativeAdminToken));
      expect(res.status).toBe(403);
    });
  });

  // ─── Step 1.6: Campaign Settings ─────────────────────────────────────────

  describe('Step 1.6 — PATCH /admin/settings/campaign', () => {
    it('reads current campaign settings (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/settings/campaign')
        .set(bearerHeader(superAdminToken));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('updates campaign settings and reads back (200)', async () => {
      const res = await request(app.getHttpServer())
        .patch('/admin/settings/campaign')
        .set(bearerHeader(superAdminToken))
        .send({ currentCampaignYear: '2025/2026', campaignStartMonth: 10, campaignEndMonth: 9 });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      const data = res.body?.data ?? {};
      expect(data?.currentCampaignYear).toBe('2025/2026');
    });
  });

  // ─── Step 1.7: Audit Logs ────────────────────────────────────────────────

  describe('Step 1.7 — GET /admin/audit-logs', () => {
    it('returns paginated audit log (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/audit-logs')
        .query({ page: 1, limit: 5 })
        .set(bearerHeader(superAdminToken));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
      expect(res.body.meta).toHaveProperty('total');
    });

    it('returns 403 for non-super-admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/audit-logs')
        .set(bearerHeader(cooperativeAdminToken));
      expect(res.status).toBe(403);
    });
  });

  // ─── Step 1.8: Kafka DLQ Stats ───────────────────────────────────────────

  describe('Step 1.8 — GET /admin/kafka/dlq-stats', () => {
    it('returns DLQ stats array (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/kafka/dlq-stats')
        .set(bearerHeader(superAdminToken));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
