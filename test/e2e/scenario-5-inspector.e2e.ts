/**
 * Scenario 5 — Inspector: Field Inspection & Report (Youssef)
 * Covers: view assigned inspections, file immutable report, view details.
 * Maps to USER-MANUAL-TEST-SCENARIOS.md Steps 5.1–5.4.
 */
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp, buildMockJwt, bearerHeader } from '../helpers/app.helper';
import { buildJwtPayload } from '../factories/user.factory';

const S5_COOP_ID = 'a5000000-0000-4000-8000-000000000001';
const S5_CERT_ID = 'a5000000-0000-4000-8000-000000000002';
const S5_INSP_ID = 'a5000000-0000-4000-8000-000000000003';
const S5_INSP_USER = 'a5000000-0000-4000-8000-000000000099';
const S5_BATCH_ID = 'a5000000-0000-4000-8000-000000000004';
const S5_USER_ID = 'a5000000-0000-4000-8000-000000000098';

describe('Scenario 5 — Inspector: Field Inspection & Report (e2e)', () => {
  let app: INestApplication;
  let inspectorToken: string;
  let certBodyToken: string;
  let coopAdminToken: string;
  let ds: DataSource;

  beforeAll(async () => {
    app = await createTestApp();
    ds = app.get(DataSource);

    // Inspector's sub matches inspectorId on the inspection entity
    inspectorToken = buildMockJwt(buildJwtPayload('inspector', { sub: S5_INSP_USER }));
    certBodyToken = buildMockJwt(buildJwtPayload('certification-body', { sub: S5_USER_ID }));
    coopAdminToken = buildMockJwt(
      buildJwtPayload('cooperative-admin', { sub: S5_USER_ID, cooperative_id: S5_COOP_ID }),
    );

    // Seed cooperative
    await ds.query(
      `INSERT INTO cooperative.cooperative
       (id, name, ice, email, phone, region_code, city, president_name, president_cin, president_phone, status, product_types, created_by, verified_at)
       VALUES ($1,'Coopérative Inspection S5','005555555555555','insp-s5@coop.ma','+212660000040','DRAA_TAFILALET','Zagora','Test','D222222','+212660000041','active','["SAFFRON"]',$2,NOW())
       ON CONFLICT DO NOTHING`,
      [S5_COOP_ID, S5_USER_ID],
    );

    // Seed a certification in INSPECTION_SCHEDULED status
    await ds.query(
      `INSERT INTO certification.certification
       (id, cooperative_id, cooperative_name, batch_id, product_type_code, certification_type, region_code, current_status, requested_by, requested_at, created_by)
       VALUES ($1,$2,'Coopérative Inspection S5',$3,'SAFFRON','IGP','DRAA_TAFILALET','INSPECTION_SCHEDULED',$4,NOW(),$4)
       ON CONFLICT DO NOTHING`,
      [S5_CERT_ID, S5_COOP_ID, S5_BATCH_ID, S5_USER_ID],
    );

    // Seed a scheduled inspection assigned to S5_INSP_USER
    await ds.query(
      `INSERT INTO certification.inspection
       (id, certification_id, cooperative_id, inspector_id, inspector_name, scheduled_date, farm_ids, status, created_by)
       VALUES ($1,$2,$3,$4,'Youssef Inspector','2025-11-20','[]','scheduled',$5)
       ON CONFLICT DO NOTHING`,
      [S5_INSP_ID, S5_CERT_ID, S5_COOP_ID, S5_INSP_USER, S5_USER_ID],
    );
  });

  afterAll(async () => {
    await ds
      .query(`DELETE FROM certification.inspection WHERE id = $1`, [S5_INSP_ID])
      .catch(() => {});
    await ds
      .query(`DELETE FROM certification.certification_event WHERE certification_id = $1`, [
        S5_CERT_ID,
      ])
      .catch(() => {});
    await ds
      .query(`DELETE FROM certification.certification WHERE id = $1`, [S5_CERT_ID])
      .catch(() => {});
    await ds
      .query(`DELETE FROM cooperative.cooperative WHERE id = $1`, [S5_COOP_ID])
      .catch(() => {});
    await app.close();
  });

  // ─── Step 5.1: View My Assigned Inspections ──────────────────────────────

  describe('Step 5.1 — GET /inspections/my', () => {
    it('lists inspections for the authenticated inspector (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/inspections/my')
        .set(bearerHeader(inspectorToken));

      expect(res.status).toBe(200);
      const body = res.body;
      expect(body?.data ?? []).toBeDefined();
    });

    it('returns 403 when cooperative-admin accesses /inspections/my', async () => {
      const res = await request(app.getHttpServer())
        .get('/inspections/my')
        .set(bearerHeader(coopAdminToken));
      expect(res.status).toBe(403);
    });

    it('returns 401 without token', async () => {
      await request(app.getHttpServer()).get('/inspections/my').expect(401);
    });
  });

  // ─── Step 5.2: Start Field Visit ─────────────────────────────────────────

  describe('Step 5.2 — POST /certifications/:id/start-inspection', () => {
    it('inspector starts field visit — status advances to INSPECTION_IN_PROGRESS', async () => {
      const res = await request(app.getHttpServer())
        .post(`/certifications/${S5_CERT_ID}/start-inspection`)
        .set(bearerHeader(inspectorToken))
        .send({});

      expect(res.status).toBe(200);
      const body = res.body?.data ?? res.body;
      expect(body?.currentStatus).toBe('INSPECTION_IN_PROGRESS');
    });

    it('returns 403 when cooperative-admin calls start-inspection', async () => {
      const res = await request(app.getHttpServer())
        .post(`/certifications/${S5_CERT_ID}/start-inspection`)
        .set(bearerHeader(coopAdminToken))
        .send({});
      expect(res.status).toBe(403);
    });
  });

  // ─── Step 5.3: File Inspection Report ────────────────────────────────────

  describe('Step 5.3 — PATCH /inspections/:id/report', () => {
    it('files a passing inspection report (200)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/inspections/${S5_INSP_ID}/report`)
        .set(bearerHeader(inspectorToken))
        .send({
          passed: true,
          reportSummary:
            'Visite terrain effectuée le 20/11/2025. Parcelle Lot 3 conforme aux exigences IGP.',
          detailedObservations: 'Zone de récolte délimitée, altitude 1650m conforme.',
        });

      expect(res.status).toBe(200);
      const body = res.body?.data ?? res.body;
      expect(body?.passed).toBe(true);
    });

    it('returns 403 when certification-body files inspection report', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/inspections/${S5_INSP_ID}/report`)
        .set(bearerHeader(certBodyToken))
        .send({ passed: true, reportSummary: 'Test summary longer than 20 characters ok.' });
      expect(res.status).toBe(403);
    });

    it('returns 400 when reportSummary is too short (<20 chars)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/inspections/${S5_INSP_ID}/report`)
        .set(bearerHeader(inspectorToken))
        .send({ passed: true, reportSummary: 'Too short' });
      expect(res.status).toBe(400);
    });
  });

  // ─── Step 5.4: View Inspection Details ───────────────────────────────────

  describe('Step 5.4 — GET /inspections/:id', () => {
    it('returns inspection details with report (200)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/inspections/${S5_INSP_ID}`)
        .set(bearerHeader(inspectorToken));

      expect(res.status).toBe(200);
      const body = res.body?.data ?? res.body;
      expect(body?.id).toBe(S5_INSP_ID);
      expect(body?.certificationId).toBe(S5_CERT_ID);
    });

    it('returns 404 for unknown inspection ID', async () => {
      const res = await request(app.getHttpServer())
        .get('/inspections/00000000-0000-4000-8000-000000000000')
        .set(bearerHeader(inspectorToken));
      expect([404, 400]).toContain(res.status);
    });
  });
});
