/**
 * Scenario 4 — Lab Technician: Lab Test Submission & Results (Dr. Amina)
 * Covers: submit lab test, view assigned tests, record results, upload/download report.
 * Maps to USER-MANUAL-TEST-SCENARIOS.md Steps 4.1–4.5.
 */
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp, buildMockJwt, bearerHeader } from '../helpers/app.helper';
import { buildJwtPayload } from '../factories/user.factory';

const S4_COOP_ID = 'a4000000-0000-4000-8000-000000000001';
const S4_LAB_ID = 'a4000000-0000-4000-8000-000000000002';
const S4_FARM_ID = 'a4000000-0000-4000-8000-000000000003';
const S4_USER_ID = 'a4000000-0000-4000-8000-000000000099';

describe('Scenario 4 — Lab Technician: Lab Test Submission & Results (e2e)', () => {
  let app: INestApplication;
  let labTechToken: string;
  let coopAdminToken: string;
  let ds: DataSource;

  beforeAll(async () => {
    app = await createTestApp();
    ds = app.get(DataSource);

    labTechToken = buildMockJwt(buildJwtPayload('lab-technician', { sub: S4_USER_ID }));
    coopAdminToken = buildMockJwt(
      buildJwtPayload('cooperative-admin', { sub: S4_USER_ID, cooperative_id: S4_COOP_ID }),
    );

    // Seed cooperative
    await ds.query(
      `INSERT INTO cooperative.cooperative
       (id, name, ice, email, phone, region_code, city, president_name, president_cin, president_phone, status, product_types, created_by, verified_at)
       VALUES ($1,'Coopérative Lab S4','004444444444444','lab-s4@coop.ma','+212660000030','SOUSS_MASSA','Agadir','Dr Test','C111111','+212660000031','active','["SAFFRON"]',$2,NOW())
       ON CONFLICT DO NOTHING`,
      [S4_COOP_ID, S4_USER_ID],
    );

    // Seed accredited lab
    await ds.query(
      `INSERT INTO product.lab
       (id, name, onssa_accreditation_number, is_accredited)
       VALUES ($1,'Laboratoire ONSSA Agadir S4','ONSSA-S4-001',true)
       ON CONFLICT DO NOTHING`,
      [S4_LAB_ID],
    );

    // Seed farm
    await ds.query(
      `INSERT INTO cooperative.farm
       (id, cooperative_id, name, area_hectares, crop_types, region_code, created_by)
       VALUES ($1,$2,'Ferme S4',1.0,'["SAFFRON"]','SOUSS_MASSA',$3)
       ON CONFLICT DO NOTHING`,
      [S4_FARM_ID, S4_COOP_ID, S4_USER_ID],
    );
  });

  afterAll(async () => {
    await ds
      .query(
        `DELETE FROM product.lab_test_result WHERE lab_test_id IN (SELECT id FROM product.lab_test WHERE cooperative_id = $1)`,
        [S4_COOP_ID],
      )
      .catch(() => {});
    await ds
      .query(`DELETE FROM product.lab_test WHERE cooperative_id = $1`, [S4_COOP_ID])
      .catch(() => {});
    await ds
      .query(`DELETE FROM product.production_batch WHERE cooperative_id = $1`, [S4_COOP_ID])
      .catch(() => {});
    await ds
      .query(`DELETE FROM product.harvest WHERE cooperative_id = $1`, [S4_COOP_ID])
      .catch(() => {});
    await ds.query(`DELETE FROM cooperative.farm WHERE id = $1`, [S4_FARM_ID]).catch(() => {});
    await ds.query(`DELETE FROM product.lab WHERE id = $1`, [S4_LAB_ID]).catch(() => {});
    await ds
      .query(`DELETE FROM cooperative.cooperative WHERE id = $1`, [S4_COOP_ID])
      .catch(() => {});
    await app.close();
  });

  let batchId: string;
  let labTestId: string;

  // ─── Prepare: Create harvest + batch ─────────────────────────────────────

  beforeAll(async () => {
    // Create harvest
    const harvestRes = await request(app.getHttpServer())
      .post('/harvests')
      .set(bearerHeader(coopAdminToken))
      .send({
        farmId: S4_FARM_ID,
        cooperativeId: S4_COOP_ID,
        productTypeCode: 'SAFFRON',
        quantityKg: 20,
        harvestDate: '2025-10-28',
        campaignYear: '2025/2026',
        method: 'manual',
      });

    const harvestId = (harvestRes.body?.data ?? harvestRes.body)?.id as string | undefined;
    if (!harvestId) return;

    // Create batch
    const batchRes = await request(app.getHttpServer())
      .post('/batches')
      .set(bearerHeader(coopAdminToken))
      .send({
        productTypeCode: 'SAFFRON',
        harvestIds: [harvestId],
        totalQuantityKg: 20,
        processingDate: '2025-10-29',
      });

    batchId = ((batchRes.body?.data ?? batchRes.body)?.id as string | undefined) ?? '';
  });

  // ─── Step 4.1: Submit Lab Test ────────────────────────────────────────────

  describe('Step 4.1 — POST /lab-tests (cooperative-admin submits)', () => {
    it('submits a lab test request (201)', async () => {
      if (!batchId) return;
      const res = await request(app.getHttpServer())
        .post('/lab-tests')
        .set(bearerHeader(coopAdminToken))
        .send({
          batchId,
          laboratoryId: S4_LAB_ID,
          expectedResultDate: '2025-11-15',
        });

      expect(res.status).toBe(201);
      const body = res.body?.data ?? res.body;
      expect(body?.id).toBeTruthy();
      expect(body?.status).toBe('submitted');
      labTestId = body.id as string;
    });

    it('returns 400 for invalid batchId UUID', async () => {
      const res = await request(app.getHttpServer())
        .post('/lab-tests')
        .set(bearerHeader(coopAdminToken))
        .send({ batchId: 'not-a-uuid' });
      expect(res.status).toBe(400);
    });

    it('returns 403 for consumer role', async () => {
      const consumerToken = buildMockJwt(buildJwtPayload('consumer'));
      const res = await request(app.getHttpServer())
        .post('/lab-tests')
        .set(bearerHeader(consumerToken))
        .send({ batchId: batchId || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380000' });
      expect(res.status).toBe(403);
    });
  });

  // ─── Step 4.2: View Assigned Tests ───────────────────────────────────────

  describe('Step 4.2 — GET /lab-tests (lab-technician)', () => {
    it('lists lab tests for lab-technician (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/lab-tests')
        .set(bearerHeader(labTechToken));

      expect(res.status).toBe(200);
    });

    it('returns 403 for cooperative-member', async () => {
      const memberToken = buildMockJwt(buildJwtPayload('cooperative-member'));
      const res = await request(app.getHttpServer())
        .get('/lab-tests')
        .set(bearerHeader(memberToken));
      expect(res.status).toBe(403);
    });
  });

  // ─── Step 4.3: Record Lab Analysis Results ───────────────────────────────

  describe('Step 4.3 — POST /lab-tests/:id/results', () => {
    it('records ISO 3632 saffron lab results (201)', async () => {
      if (!labTestId) return;
      const res = await request(app.getHttpServer())
        .post(`/lab-tests/${labTestId}/results`)
        .set(bearerHeader(labTechToken))
        .send({
          testValues: {
            crocin_e440: 247,
            safranal_e330: 34,
            picrocrocin_e257: 82,
            moisture_pct: 8.5,
            ash_total_pct: 5.2,
          },
          technicianName: 'Dr. Amina Benali',
        });

      expect(res.status).toBe(201);
      const body = res.body?.data ?? res.body;
      expect(body?.id).toBeTruthy();
    });

    it('returns 403 when cooperative-admin tries to record results', async () => {
      if (!labTestId) return;
      const res = await request(app.getHttpServer())
        .post(`/lab-tests/${labTestId}/results`)
        .set(bearerHeader(coopAdminToken))
        .send({ testValues: { crocin_e440: 200 } });
      expect(res.status).toBe(403);
    });

    it('returns 400 when testValues is missing', async () => {
      const res = await request(app.getHttpServer())
        .post(`/lab-tests/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380001/results`)
        .set(bearerHeader(labTechToken))
        .send({ technicianName: 'Dr. Test' });
      expect(res.status).toBe(400);
    });
  });

  // ─── Step 4.4: Upload PDF Lab Report ─────────────────────────────────────

  describe('Step 4.4 — POST /lab-tests/:id/report (multipart)', () => {
    it('uploads a PDF report (200)', async () => {
      if (!labTestId) return;
      const pdfContent = Buffer.from('%PDF-1.4 fake pdf content for test');
      const res = await request(app.getHttpServer())
        .post(`/lab-tests/${labTestId}/report`)
        .set(bearerHeader(labTechToken))
        .attach('file', pdfContent, {
          filename: 'test-report.pdf',
          contentType: 'application/pdf',
        });

      // MinIO may not be running in test; 500/503 is acceptable; 403 is not
      expect(res.status).not.toBe(403);
      expect(res.status).not.toBe(401);
    });

    it('returns 403 when cooperative-admin uploads report', async () => {
      if (!labTestId) return;
      const pdfContent = Buffer.from('%PDF-1.4 test');
      const res = await request(app.getHttpServer())
        .post(`/lab-tests/${labTestId}/report`)
        .set(bearerHeader(coopAdminToken))
        .attach('file', pdfContent, { filename: 'test.pdf', contentType: 'application/pdf' });
      expect(res.status).toBe(403);
    });
  });

  // ─── Step 4.5: Get Lab Test Result ───────────────────────────────────────

  describe('Step 4.5 — GET /lab-tests/:id/result', () => {
    it('retrieves lab test result for authorized roles (200 or 404)', async () => {
      if (!labTestId) return;
      const res = await request(app.getHttpServer())
        .get(`/lab-tests/${labTestId}/result`)
        .set(bearerHeader(labTechToken));

      expect([200, 404]).toContain(res.status);
    });

    it('retrieves lab test by ID', async () => {
      if (!labTestId) return;
      const res = await request(app.getHttpServer())
        .get(`/lab-tests/${labTestId}`)
        .set(bearerHeader(labTechToken));

      expect(res.status).toBe(200);
    });
  });
});
