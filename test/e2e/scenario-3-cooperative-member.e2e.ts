/**
 * Scenario 3 — Cooperative-Member: Harvest & Batch Logging (Hassan)
 * Covers: log harvest, create batch, add processing steps, view processing history.
 * Maps to USER-MANUAL-TEST-SCENARIOS.md Steps 3.1–3.4.
 */
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp, buildMockJwt, bearerHeader } from '../helpers/app.helper';
import { buildJwtPayload } from '../factories/user.factory';

const S3_COOP_ID = 'a3000000-0000-4000-8000-000000000001';
const S3_FARM_ID = 'a3000000-0000-4000-8000-000000000002';
const S3_USER_ID = 'a3000000-0000-4000-8000-000000000099';

describe('Scenario 3 — Cooperative-Member: Harvest & Batch Logging (e2e)', () => {
  let app: INestApplication;
  let memberToken: string;
  let ds: DataSource;

  beforeAll(async () => {
    app = await createTestApp();
    ds = app.get(DataSource);

    memberToken = buildMockJwt(
      buildJwtPayload('cooperative-member', {
        sub: S3_USER_ID,
        cooperative_id: S3_COOP_ID,
      }),
    );

    // Seed cooperative
    await ds.query(
      `INSERT INTO cooperative.cooperative
       (id, name, ice, email, phone, region_code, city, president_name, president_cin, president_phone, status, product_types, created_by, verified_at)
       VALUES ($1,'Coopérative Hassan S3','003333333333333','hassan-s3@coop.ma','+212660000020','DRAA_TAFILALET','Taliouine','Ahmed','B654321','+212660000021','active','["SAFFRON"]',$2,NOW())
       ON CONFLICT DO NOTHING`,
      [S3_COOP_ID, S3_USER_ID],
    );

    // Seed farm
    await ds.query(
      `INSERT INTO cooperative.farm
       (id, cooperative_id, name, area_hectares, crop_types, region_code, commune, created_by)
       VALUES ($1,$2,'Parcelle Nord Taliouine',2.5,'["SAFFRON"]','DRAA_TAFILALET','Taliouine',$3)
       ON CONFLICT DO NOTHING`,
      [S3_FARM_ID, S3_COOP_ID, S3_USER_ID],
    );
  });

  afterAll(async () => {
    await ds.query(`DELETE FROM product.processing_step WHERE cooperative_id = $1`, [S3_COOP_ID]);
    await ds.query(`DELETE FROM product.production_batch WHERE cooperative_id = $1`, [S3_COOP_ID]);
    await ds.query(`DELETE FROM product.harvest WHERE cooperative_id = $1`, [S3_COOP_ID]);
    await ds.query(`DELETE FROM cooperative.farm WHERE id = $1`, [S3_FARM_ID]);
    await ds.query(`DELETE FROM cooperative.cooperative WHERE id = $1`, [S3_COOP_ID]);
    await app.close();
  });

  let harvestId: string;
  let batchId: string;

  // ─── Step 3.1: Log a Harvest ──────────────────────────────────────────────

  describe('Step 3.1 — POST /harvests', () => {
    it('logs a saffron harvest (201)', async () => {
      const res = await request(app.getHttpServer())
        .post('/harvests')
        .set(bearerHeader(memberToken))
        .send({
          farmId: S3_FARM_ID,
          cooperativeId: S3_COOP_ID,
          productTypeCode: 'SAFFRON',
          quantityKg: 12.5,
          harvestDate: '2025-10-28',
          campaignYear: '2025/2026',
          method: 'Cueillette manuelle des pistils',
          metadata: { pickerCount: 8, weatherCondition: 'sunny', altitudeM: 1650 },
        });

      expect(res.status).toBe(201);
      const body = res.body?.data ?? res.body;
      expect(body?.id).toBeTruthy();
      expect(parseFloat(body?.quantityKg)).toBeCloseTo(12.5, 1);
      expect(body?.productTypeCode).toBe('SAFFRON');
      harvestId = body.id as string;
    });

    it('returns 400 when farmId is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/harvests')
        .set(bearerHeader(memberToken))
        .send({
          productTypeCode: 'SAFFRON',
          quantityKg: 5,
          harvestDate: '2025-10-28',
          campaignYear: '2025/2026',
          method: 'manual',
        });
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid campaignYear format', async () => {
      const res = await request(app.getHttpServer())
        .post('/harvests')
        .set(bearerHeader(memberToken))
        .send({
          farmId: S3_FARM_ID,
          productTypeCode: 'SAFFRON',
          quantityKg: 5,
          harvestDate: '2025-10-28',
          campaignYear: '2025',
          method: 'manual',
        });
      expect(res.status).toBe(400);
    });

    it('returns 401 without authentication', async () => {
      await request(app.getHttpServer())
        .post('/harvests')
        .send({
          farmId: S3_FARM_ID,
          productTypeCode: 'SAFFRON',
          quantityKg: 5,
          harvestDate: '2025-10-28',
          campaignYear: '2025/2026',
          method: 'manual',
        })
        .expect(401);
    });

    it('retrieves harvest by farm ID', async () => {
      const res = await request(app.getHttpServer())
        .get(`/harvests/farm/${S3_FARM_ID}`)
        .set(bearerHeader(memberToken));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body?.data ?? res.body)).toBe(true);
    });
  });

  // ─── Step 3.2: Create a Production Batch ─────────────────────────────────

  describe('Step 3.2 — POST /batches', () => {
    it('creates a production batch (201)', async () => {
      if (!harvestId) {
        console.warn('Skipping batch test — harvest not created');
        return;
      }

      const res = await request(app.getHttpServer())
        .post('/batches')
        .set(bearerHeader(memberToken))
        .send({
          productTypeCode: 'SAFFRON',
          harvestIds: [harvestId],
          totalQuantityKg: 12.5,
          processingDate: '2025-10-29',
        });

      expect(res.status).toBe(201);
      const body = res.body?.data ?? res.body;
      expect(body?.id).toBeTruthy();
      expect(body?.status ?? body?.currentStatus).toBeTruthy();
      batchId = body.id as string;
    });

    it('returns 400 when harvestIds is empty', async () => {
      const res = await request(app.getHttpServer())
        .post('/batches')
        .set(bearerHeader(memberToken))
        .send({
          productTypeCode: 'SAFFRON',
          harvestIds: [],
          totalQuantityKg: 10,
          processingDate: '2025-10-29',
        });
      expect(res.status).toBe(400);
    });

    it('returns 403 when inspector creates batch', async () => {
      const inspectorToken = buildMockJwt(buildJwtPayload('inspector'));
      const res = await request(app.getHttpServer())
        .post('/batches')
        .set(bearerHeader(inspectorToken))
        .send({
          productTypeCode: 'SAFFRON',
          harvestIds: ['fake-id'],
          totalQuantityKg: 1,
          processingDate: '2025-10-29',
        });
      expect(res.status).toBe(403);
    });
  });

  // ─── Step 3.3: Add Processing Steps ──────────────────────────────────────

  describe('Step 3.3 — POST /batches/:id/processing-steps', () => {
    it('adds DRYING step (201)', async () => {
      if (!batchId) return;
      const res = await request(app.getHttpServer())
        .post(`/batches/${batchId}/processing-steps`)
        .set(bearerHeader(memberToken))
        .send({
          stepType: 'DRYING',
          doneAt: '2025-10-29T08:00:00Z',
          notes: "Séchage à l'ombre pendant 3 jours",
        });

      expect(res.status).toBe(201);
      const body = res.body?.data ?? res.body;
      expect(body?.stepType).toBe('DRYING');
    });

    it('adds SORTING step (201)', async () => {
      if (!batchId) return;
      const res = await request(app.getHttpServer())
        .post(`/batches/${batchId}/processing-steps`)
        .set(bearerHeader(memberToken))
        .send({
          stepType: 'SORTING',
          doneAt: '2025-11-01T09:00:00Z',
          notes: 'Tri manuel Grade 1',
        });

      expect(res.status).toBe(201);
    });

    it('adds PACKAGING step (201)', async () => {
      if (!batchId) return;
      const res = await request(app.getHttpServer())
        .post(`/batches/${batchId}/processing-steps`)
        .set(bearerHeader(memberToken))
        .send({
          stepType: 'PACKAGING',
          doneAt: '2025-11-02T14:00:00Z',
          notes: 'Sachets hermétiques 1g',
        });

      expect(res.status).toBe(201);
    });

    it('returns 400 for invalid stepType', async () => {
      if (!batchId) return;
      const res = await request(app.getHttpServer())
        .post(`/batches/${batchId}/processing-steps`)
        .set(bearerHeader(memberToken))
        .send({ stepType: 'INVALID_STEP', doneAt: '2025-11-01T09:00:00Z' });
      expect(res.status).toBe(400);
    });
  });

  // ─── Step 3.4: View Processing History ───────────────────────────────────

  describe('Step 3.4 — GET /batches/:id/processing-steps', () => {
    it('lists all processing steps for a batch (200)', async () => {
      if (!batchId) return;
      const res = await request(app.getHttpServer())
        .get(`/batches/${batchId}/processing-steps`)
        .set(bearerHeader(memberToken));

      expect(res.status).toBe(200);
      const items = res.body?.data ?? res.body;
      expect(Array.isArray(items)).toBe(true);
      if (Array.isArray(items)) {
        expect(items.length).toBeGreaterThanOrEqual(3);
      }
    });

    it('returns 403 for consumer role', async () => {
      if (!batchId) return;
      const consumerToken = buildMockJwt(buildJwtPayload('consumer'));
      const res = await request(app.getHttpServer())
        .get(`/batches/${batchId}/processing-steps`)
        .set(bearerHeader(consumerToken));
      expect(res.status).toBe(403);
    });
  });
});
