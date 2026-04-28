/**
 * Scenario 11 — Admin Reports & Exports (Khalid + Omar)
 * Covers: cert stats, analytics, compliance report, ONSSA report, JSON export, CSV exports.
 * Maps to USER-MANUAL-TEST-SCENARIOS.md Steps 11.1–11.8.
 */
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp, buildMockJwt, bearerHeader } from '../helpers/app.helper';
import { buildJwtPayload } from '../factories/user.factory';

const S11_COOP_ID = 'b1000000-0000-4000-8000-000000000001';
const S11_CERT_ID = 'b1000000-0000-4000-8000-000000000002';
const S11_BATCH_ID = 'b1000000-0000-4000-8000-000000000003';
const S11_USER_ID = 'b1000000-0000-4000-8000-000000000099';

describe('Scenario 11 — Admin Reports & Exports (e2e)', () => {
  let app: INestApplication;
  let superAdminToken: string;
  let certBodyToken: string;
  let coopAdminToken: string;
  let ds: DataSource;

  beforeAll(async () => {
    app = await createTestApp();
    ds = app.get(DataSource);

    superAdminToken = buildMockJwt(buildJwtPayload('super-admin', { sub: S11_USER_ID }));
    certBodyToken = buildMockJwt(buildJwtPayload('certification-body', { sub: S11_USER_ID }));
    coopAdminToken = buildMockJwt(
      buildJwtPayload('cooperative-admin', { sub: S11_USER_ID, cooperative_id: S11_COOP_ID }),
    );

    // Seed cooperative + granted certification for reports
    await ds.query(
      `INSERT INTO cooperative.cooperative
       (id, name, ice, email, phone, region_code, city, president_name, president_cin, president_phone, status, product_types, created_by, verified_at)
       VALUES ($1,'Coopérative Reports S11','011111111111111','reports-s11@coop.ma','+212660000110','SOUSS_MASSA','Agadir','Rep Admin','R111111','+212660000111','active','["SAFFRON"]',$2,NOW())
       ON CONFLICT DO NOTHING`,
      [S11_COOP_ID, S11_USER_ID],
    );

    await ds.query(
      `INSERT INTO certification.certification
       (id, cooperative_id, cooperative_name, batch_id, product_type_code, certification_type, region_code, current_status, requested_by, requested_at, granted_at, valid_from, valid_until, created_by)
       VALUES ($1,$2,'Coopérative Reports S11',$3,'SAFFRON','IGP','SOUSS_MASSA','GRANTED',$4,NOW(),NOW(),NOW(), NOW() + INTERVAL '365 days',$4)
       ON CONFLICT DO NOTHING`,
      [S11_CERT_ID, S11_COOP_ID, S11_BATCH_ID, S11_USER_ID],
    );
  });

  afterAll(async () => {
    await ds
      .query(`DELETE FROM certification.certification_event WHERE certification_id = $1`, [
        S11_CERT_ID,
      ])
      .catch(() => {});
    await ds
      .query(`DELETE FROM certification.certification WHERE id = $1`, [S11_CERT_ID])
      .catch(() => {});
    await ds
      .query(`DELETE FROM cooperative.cooperative WHERE id = $1`, [S11_COOP_ID])
      .catch(() => {});
    await app.close();
  });

  // ─── Step 11.1: Certification Statistics ─────────────────────────────────

  describe('Step 11.1 — GET /certifications/stats', () => {
    it('returns certification stats for super-admin (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/certifications/stats')
        .set(bearerHeader(superAdminToken));

      expect(res.status).toBe(200);
    });

    it('accepts date range filter (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/certifications/stats')
        .query({ from: '2025-01-01', to: '2026-12-31' })
        .set(bearerHeader(superAdminToken));
      expect(res.status).toBe(200);
    });

    it('returns 403 for cooperative-admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/certifications/stats')
        .set(bearerHeader(coopAdminToken));
      expect(res.status).toBe(403);
    });
  });

  // ─── Step 11.2: Analytics by Region and Product Type ─────────────────────

  describe('Step 11.2 — GET /certifications/analytics', () => {
    it('returns analytics for certification-body (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/certifications/analytics')
        .set(bearerHeader(certBodyToken));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('returns analytics for super-admin (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/certifications/analytics')
        .query({ from: '2025-01-01' })
        .set(bearerHeader(superAdminToken));
      expect(res.status).toBe(200);
    });

    it('returns 403 for cooperative-admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/certifications/analytics')
        .set(bearerHeader(coopAdminToken));
      expect(res.status).toBe(403);
    });
  });

  // ─── Step 11.3: Compliance Report ────────────────────────────────────────

  describe('Step 11.3 — GET /certifications/compliance-report', () => {
    it('returns compliance rows for certification-body (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/certifications/compliance-report')
        .set(bearerHeader(certBodyToken));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body?.data ?? res.body)).toBe(true);
    });
  });

  // ─── Step 11.4: ONSSA Active Certifications Report ───────────────────────

  describe('Step 11.4 — GET /certifications/onssa-report', () => {
    it('returns ONSSA active certs for super-admin (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/certifications/onssa-report')
        .set(bearerHeader(superAdminToken));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body?.data ?? res.body)).toBe(true);
    });
  });

  // ─── Step 11.5: Export Full Registry JSON ────────────────────────────────

  describe('Step 11.5 — GET /certifications/export', () => {
    it('returns JSON attachment for super-admin (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/certifications/export')
        .set(bearerHeader(superAdminToken));

      expect(res.status).toBe(200);
      const contentType = res.headers['content-type'] ?? '';
      expect(contentType).toMatch(/json/i);
    });

    it('accepts status filter (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/certifications/export')
        .query({ status: 'GRANTED' })
        .set(bearerHeader(superAdminToken));
      expect(res.status).toBe(200);
    });

    it('returns 403 for cooperative-admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/certifications/export')
        .set(bearerHeader(coopAdminToken));
      expect(res.status).toBe(403);
    });
  });

  // ─── Step 11.6: Compliance Export CSV ────────────────────────────────────

  describe('Step 11.6 — GET /certifications/compliance-export', () => {
    it('returns CSV attachment for certification-body (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/certifications/compliance-export')
        .set(bearerHeader(certBodyToken));

      expect(res.status).toBe(200);
      const contentType = res.headers['content-type'] ?? '';
      expect(contentType).toMatch(/text\/csv|application\/octet-stream/i);
    });
  });

  // ─── Step 11.7: Product Registry CSV ─────────────────────────────────────

  describe('Step 11.7 — GET /products/export', () => {
    it('returns CSV product registry for super-admin (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/products/export')
        .set(bearerHeader(superAdminToken));

      expect(res.status).toBe(200);
      const contentType = res.headers['content-type'] ?? '';
      expect(contentType).toMatch(/text\/csv|application\/octet-stream/i);
    });

    it('returns 403 for cooperative-admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/products/export')
        .set(bearerHeader(coopAdminToken));
      expect(res.status).toBe(403);
    });
  });

  // ─── Step 11.8: QR Scan Stats ────────────────────────────────────────────

  describe('Step 11.8 — GET /certifications/:id/scan-stats', () => {
    it('returns scan stats for seeded certification (200)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/certifications/${S11_CERT_ID}/scan-stats`)
        .set(bearerHeader(superAdminToken));

      expect(res.status).toBe(200);
      const body = res.body?.data ?? res.body;
      expect(body?.totalScans ?? 0).toBeGreaterThanOrEqual(0);
    });

    it('returns 403 for cooperative-admin on scan-stats', async () => {
      const res = await request(app.getHttpServer())
        .get(`/certifications/${S11_CERT_ID}/scan-stats`)
        .set(bearerHeader(coopAdminToken));
      expect(res.status).toBe(403);
    });

    it('returns non-500 for unknown certification', async () => {
      const res = await request(app.getHttpServer())
        .get('/certifications/00000000-0000-4000-8000-000000000000/scan-stats')
        .set(bearerHeader(superAdminToken));
      expect(res.status).not.toBe(500);
    });
  });

  // ─── Pending Queue ────────────────────────────────────────────────────────

  describe('GET /certifications/pending', () => {
    it('returns pending certifications for certification-body (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/certifications/pending')
        .set(bearerHeader(certBodyToken));

      expect(res.status).toBe(200);
    });

    it('returns 403 for cooperative-admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/certifications/pending')
        .set(bearerHeader(coopAdminToken));
      expect(res.status).toBe(403);
    });
  });
});
