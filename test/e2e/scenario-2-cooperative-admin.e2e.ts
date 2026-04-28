/**
 * Scenario 2 — Cooperative-Admin: Full Cooperative Setup (Fatima)
 * Covers: view profile, add member, register farm, update profile, view certs, notification prefs.
 * Maps to USER-MANUAL-TEST-SCENARIOS.md Steps 2.1–2.6.
 */
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp, buildMockJwt, bearerHeader } from '../helpers/app.helper';
import { buildJwtPayload } from '../factories/user.factory';

const S2_COOP_ID = 'a2000000-0000-4000-8000-000000000001';
const S2_USER_ID = 'a2000000-0000-4000-8000-000000000099';

describe('Scenario 2 — Cooperative-Admin: Full Cooperative Setup (e2e)', () => {
  let app: INestApplication;
  let coopAdminToken: string;
  let ds: DataSource;

  beforeAll(async () => {
    app = await createTestApp();
    ds = app.get(DataSource);

    coopAdminToken = buildMockJwt(
      buildJwtPayload('cooperative-admin', {
        sub: S2_USER_ID,
        cooperative_id: S2_COOP_ID,
      }),
    );

    // Clean up any leftover data from previous interrupted runs before seeding
    await ds.query(`DELETE FROM cooperative.farm WHERE cooperative_id = $1`, [S2_COOP_ID]);
    await ds.query(`DELETE FROM cooperative.member WHERE cooperative_id = $1`, [S2_COOP_ID]);
    await ds.query(`DELETE FROM cooperative.cooperative WHERE id = $1`, [S2_COOP_ID]);

    // Seed an active cooperative for Fatima
    await ds.query(
      `INSERT INTO cooperative.cooperative
       (id, name, ice, email, phone, region_code, city, president_name, president_cin, president_phone, status, product_types, created_by, verified_at)
       VALUES ($1,'Coopérative Safran Taliouine S2','002222222222222','safran-s2@coop.ma','+212660000010','DRAA_TAFILALET','Taliouine','Fatima Ait Brahim','F123456','+212660000011','active','["SAFFRON"]',$2,NOW())
       ON CONFLICT DO NOTHING`,
      [S2_COOP_ID, S2_USER_ID],
    );
  });

  afterAll(async () => {
    await ds.query(`DELETE FROM cooperative.farm WHERE cooperative_id = $1`, [S2_COOP_ID]);
    await ds.query(`DELETE FROM cooperative.member WHERE cooperative_id = $1`, [S2_COOP_ID]);
    await ds.query(`DELETE FROM cooperative.cooperative WHERE id = $1`, [S2_COOP_ID]);
    await app.close();
  });

  // ─── Step 2.1: View Cooperative Profile ──────────────────────────────────

  describe('Step 2.1 — GET /cooperatives/:id', () => {
    it('returns cooperative profile for cooperative-admin', async () => {
      const res = await request(app.getHttpServer())
        .get(`/cooperatives/${S2_COOP_ID}`)
        .set(bearerHeader(coopAdminToken));

      expect(res.status).toBe(200);
      const body = res.body?.data ?? res.body;
      expect(body?.id).toBe(S2_COOP_ID);
      expect(body?.name).toBe('Coopérative Safran Taliouine S2');
      expect(body?.status).toBe('active');
    });

    it('returns 404 for unknown cooperative ID', async () => {
      const res = await request(app.getHttpServer())
        .get('/cooperatives/00000000-0000-4000-8000-000000000000')
        .set(bearerHeader(coopAdminToken));
      expect([404, 400]).toContain(res.status);
    });
  });

  // ─── Step 2.2: Add Member ────────────────────────────────────────────────

  describe('Step 2.2 — POST /cooperatives/:id/members', () => {
    it('adds a member (201)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/cooperatives/${S2_COOP_ID}/members`)
        .set(bearerHeader(coopAdminToken))
        .send({
          fullName: 'Hassan Oubella',
          fullNameAr: 'حسن أوبيلة',
          cin: 'J123456',
          phone: '+212662345678',
          email: 'hassan-s2@coop-safran.ma',
          role: 'member',
        });

      expect([201, 200]).toContain(res.status);
    });

    it('returns 400 for invalid CIN', async () => {
      const res = await request(app.getHttpServer())
        .post(`/cooperatives/${S2_COOP_ID}/members`)
        .set(bearerHeader(coopAdminToken))
        .send({
          fullName: 'Invalid Member',
          cin: 'NOTVALID!!!',
          phone: '+212662345679',
          role: 'member',
        });

      expect(res.status).toBe(400);
    });

    it('returns 403 when non-cooperative-admin tries to add member', async () => {
      const memberToken = buildMockJwt(buildJwtPayload('cooperative-member'));
      const res = await request(app.getHttpServer())
        .post(`/cooperatives/${S2_COOP_ID}/members`)
        .set(bearerHeader(memberToken))
        .send({ fullName: 'Test', cin: 'A111111', phone: '+212661000001', role: 'member' });
      expect(res.status).toBe(403);
    });
  });

  // ─── Step 2.3: Register Farm ─────────────────────────────────────────────

  describe('Step 2.3 — POST /cooperatives/:id/farms', () => {
    it('registers a GPS farm (201)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/cooperatives/${S2_COOP_ID}/farms`)
        .set(bearerHeader(coopAdminToken))
        .send({
          name: 'Parcelle Nord Taliouine — Lot 3',
          areaHectares: 2.5,
          cropTypes: ['SAFFRON'],
          regionCode: 'DRAA_TAFILALET',
          commune: 'Taliouine',
          latitude: 30.5321,
          longitude: -7.9241,
        });

      expect([201, 200]).toContain(res.status);
    });

    it('returns 400 when cropTypes is missing', async () => {
      const res = await request(app.getHttpServer())
        .post(`/cooperatives/${S2_COOP_ID}/farms`)
        .set(bearerHeader(coopAdminToken))
        .send({ name: 'Bad Farm', areaHectares: 1, regionCode: 'DRAA_TAFILALET' });
      expect(res.status).toBe(400);
    });

    it('lists farms for the cooperative (200)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/cooperatives/${S2_COOP_ID}/farms`)
        .set(bearerHeader(coopAdminToken));
      expect(res.status).toBe(200);
    });
  });

  // ─── Step 2.4: Update Cooperative Profile ────────────────────────────────

  describe('Step 2.4 — PUT /cooperatives/:id', () => {
    it('updates cooperative profile (200)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/cooperatives/${S2_COOP_ID}`)
        .set(bearerHeader(coopAdminToken))
        .send({ email: 'fatima-updated@coop-safran.ma', phone: '+212661234567' });

      expect(res.status).toBe(200);
    });
  });

  // ─── Step 2.5: View My Certifications ────────────────────────────────────

  describe('Step 2.5 — GET /certifications/my', () => {
    it('returns paginated certification list for cooperative-admin (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/certifications/my')
        .set(bearerHeader(coopAdminToken));

      expect(res.status).toBe(200);
    });

    it('returns 403 when lab-technician accesses certifications/my', async () => {
      const labToken = buildMockJwt(buildJwtPayload('lab-technician'));
      const res = await request(app.getHttpServer())
        .get('/certifications/my')
        .set(bearerHeader(labToken));
      expect(res.status).toBe(403);
    });
  });

  // ─── Step 2.6: Notification Preferences ─────────────────────────────────

  describe('Step 2.6 — PUT /notifications/preferences/me', () => {
    it('reads default notification preferences (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/notifications/preferences/me')
        .set(bearerHeader(coopAdminToken));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('updates SMS notification preference (200)', async () => {
      const res = await request(app.getHttpServer())
        .put('/notifications/preferences/me')
        .set(bearerHeader(coopAdminToken))
        .send({ channels: ['sms'], language: 'fr' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('updates email notification preference (200)', async () => {
      const res = await request(app.getHttpServer())
        .put('/notifications/preferences/me')
        .set(bearerHeader(coopAdminToken))
        .send({ channels: ['email', 'sms'], language: 'ar' });

      expect(res.status).toBe(200);
    });
  });

  // ─── Members List ─────────────────────────────────────────────────────────

  describe('GET /cooperatives/:id/members', () => {
    it('lists cooperative members (200)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/cooperatives/${S2_COOP_ID}/members`)
        .set(bearerHeader(coopAdminToken));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
