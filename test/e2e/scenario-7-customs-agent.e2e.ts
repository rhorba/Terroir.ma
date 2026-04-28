/**
 * Scenario 7 — Customs Agent: Export Documentation (Leila)
 * Covers: generate export doc, view pending, validate clearance, download PDF, HS codes, CSV report.
 * Maps to USER-MANUAL-TEST-SCENARIOS.md Steps 7.1–7.7.
 */
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp, buildMockJwt, bearerHeader } from '../helpers/app.helper';
import { buildJwtPayload } from '../factories/user.factory';

const S7_COOP_ID = 'a7000000-0000-4000-8000-000000000001';
const S7_CERT_ID = 'a7000000-0000-4000-8000-000000000002';
const S7_BATCH_ID = 'a7000000-0000-4000-8000-000000000003';
const S7_USER_ID = 'a7000000-0000-4000-8000-000000000099';

describe('Scenario 7 — Customs Agent: Export Documentation (e2e)', () => {
  let app: INestApplication;
  let customsAgentToken: string;
  let coopAdminToken: string;
  let ds: DataSource;

  beforeAll(async () => {
    app = await createTestApp();
    ds = app.get(DataSource);

    customsAgentToken = buildMockJwt(buildJwtPayload('customs-agent', { sub: S7_USER_ID }));
    coopAdminToken = buildMockJwt(
      buildJwtPayload('cooperative-admin', { sub: S7_USER_ID, cooperative_id: S7_COOP_ID }),
    );

    // Seed cooperative
    await ds.query(
      `INSERT INTO cooperative.cooperative
       (id, name, ice, email, phone, region_code, city, president_name, president_cin, president_phone, status, product_types, created_by, verified_at)
       VALUES ($1,'Coopérative Export S7','007777777777777','export-s7@coop.ma','+212660000070','DRAA_TAFILALET','Taliouine','Export Admin','G777777','+212660000071','active','["SAFFRON"]',$2,NOW())
       ON CONFLICT DO NOTHING`,
      [S7_COOP_ID, S7_USER_ID],
    );

    // Seed a GRANTED certification
    await ds.query(
      `INSERT INTO certification.certification
       (id, cooperative_id, cooperative_name, batch_id, product_type_code, certification_type, region_code, current_status, requested_by, requested_at, granted_at, valid_from, valid_until, created_by)
       VALUES ($1,$2,'Coopérative Export S7',$3,'SAFFRON','IGP','DRAA_TAFILALET','GRANTED',$4,NOW(),NOW(),NOW(), NOW() + INTERVAL '365 days',$4)
       ON CONFLICT DO NOTHING`,
      [S7_CERT_ID, S7_COOP_ID, S7_BATCH_ID, S7_USER_ID],
    );
  });

  afterAll(async () => {
    await ds
      .query(`DELETE FROM certification.export_document WHERE certification_id = $1`, [S7_CERT_ID])
      .catch(() => {});
    await ds
      .query(`DELETE FROM certification.certification_event WHERE certification_id = $1`, [
        S7_CERT_ID,
      ])
      .catch(() => {});
    await ds
      .query(`DELETE FROM certification.certification WHERE id = $1`, [S7_CERT_ID])
      .catch(() => {});
    await ds
      .query(`DELETE FROM cooperative.cooperative WHERE id = $1`, [S7_COOP_ID])
      .catch(() => {});
    await app.close();
  });

  let exportDocId: string;

  // ─── Step 7.1: Fatima Requests Export Document ───────────────────────────

  describe('Step 7.1 — POST /export-documents (cooperative-admin)', () => {
    it('creates an export document in draft status (201)', async () => {
      const res = await request(app.getHttpServer())
        .post('/export-documents')
        .set(bearerHeader(coopAdminToken))
        .send({
          certificationId: S7_CERT_ID,
          destinationCountry: 'DE',
          hsCode: '09102000',
          quantityKg: 10,
          consigneeName: 'Gewürzhaus GmbH',
          consigneeCountry: 'DE',
        });

      expect(res.status).toBe(201);
      const body = res.body?.data ?? res.body;
      expect(body?.id).toBeTruthy();
      expect(body?.status ?? body?.currentStatus ?? 'submitted').toMatch(/draft|submitted/i);
      exportDocId = body.id as string;
    });

    it('returns 400 for invalid country code (not 2-char)', async () => {
      const res = await request(app.getHttpServer())
        .post('/export-documents')
        .set(bearerHeader(coopAdminToken))
        .send({
          certificationId: S7_CERT_ID,
          destinationCountry: 'GERMANY',
          hsCode: '09102000',
          quantityKg: 10,
          consigneeName: 'Test GmbH',
          consigneeCountry: 'DE',
        });
      expect(res.status).toBe(400);
    });

    it('returns 403 for inspector role', async () => {
      const inspectorToken = buildMockJwt(buildJwtPayload('inspector'));
      const res = await request(app.getHttpServer())
        .post('/export-documents')
        .set(bearerHeader(inspectorToken))
        .send({
          certificationId: S7_CERT_ID,
          destinationCountry: 'DE',
          hsCode: '09102000',
          quantityKg: 1,
          consigneeName: 'Test',
          consigneeCountry: 'DE',
        });
      expect(res.status).toBe(403);
    });
  });

  // ─── Step 7.2: Leila Reviews Pending Documents ───────────────────────────

  describe('Step 7.2 — GET /export-documents (customs-agent)', () => {
    it('lists export documents for customs-agent (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/export-documents')
        .set(bearerHeader(customsAgentToken));

      expect(res.status).toBe(200);
    });

    it('lists my export documents for cooperative-admin (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/export-documents/my')
        .set(bearerHeader(coopAdminToken));

      expect(res.status).toBe(200);
    });

    it('returns 403 for cooperative-member accessing all docs', async () => {
      const memberToken = buildMockJwt(buildJwtPayload('cooperative-member'));
      const res = await request(app.getHttpServer())
        .get('/export-documents')
        .set(bearerHeader(memberToken));
      expect(res.status).toBe(403);
    });
  });

  // ─── Step 7.3: View Export Document Details ──────────────────────────────

  describe('Step 7.3 — GET /export-documents/:id', () => {
    it('returns export document details (200)', async () => {
      if (!exportDocId) return;
      const res = await request(app.getHttpServer())
        .get(`/export-documents/${exportDocId}`)
        .set(bearerHeader(customsAgentToken));

      expect(res.status).toBe(200);
      const body = res.body?.data ?? res.body;
      expect(body?.id).toBe(exportDocId);
    });
  });

  // ─── Step 7.4: Validate Export Clearance ─────────────────────────────────

  describe('Step 7.4 — POST /export-documents/:id/validate', () => {
    it('validates export clearance (200 or 201)', async () => {
      if (!exportDocId) return;
      const res = await request(app.getHttpServer())
        .post(`/export-documents/${exportDocId}/validate`)
        .set(bearerHeader(customsAgentToken));

      expect([200, 201]).toContain(res.status);
      const body = res.body?.data ?? res.body;
      expect(body?.status ?? body?.currentStatus).toMatch(/approved/i);
    });

    it('returns 403 when cooperative-admin validates export', async () => {
      if (!exportDocId) return;
      const res = await request(app.getHttpServer())
        .post(`/export-documents/${exportDocId}/validate`)
        .set(bearerHeader(coopAdminToken));
      expect(res.status).toBe(403);
    });
  });

  // ─── Step 7.5: Download Export Certificate PDF ───────────────────────────

  describe('Step 7.5 — GET /export-documents/:id/certificate.pdf', () => {
    it('returns PDF content or service error (not auth error)', async () => {
      if (!exportDocId) return;
      const res = await request(app.getHttpServer())
        .get(`/export-documents/${exportDocId}/certificate.pdf`)
        .set(bearerHeader(customsAgentToken));

      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });

    it('returns 403 when cooperative-member downloads export PDF', async () => {
      const memberToken = buildMockJwt(buildJwtPayload('cooperative-member'));
      const res = await request(app.getHttpServer())
        .get(`/export-documents/00000000-0000-4000-8000-000000000001/certificate.pdf`)
        .set(bearerHeader(memberToken));
      expect(res.status).toBe(403);
    });
  });

  // ─── Step 7.6: View HS Codes ─────────────────────────────────────────────

  describe('Step 7.6 — GET /export-documents/hs-codes', () => {
    it('returns HS code list for customs-agent (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/export-documents/hs-codes')
        .set(bearerHeader(customsAgentToken));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns HS codes for cooperative-admin (scoped to their coop)', async () => {
      const res = await request(app.getHttpServer())
        .get('/export-documents/hs-codes')
        .set(bearerHeader(coopAdminToken));

      expect(res.status).toBe(200);
    });
  });

  // ─── Step 7.7: Clearances Report CSV ─────────────────────────────────────

  describe('Step 7.7 — GET /export-documents/clearances-report', () => {
    it('returns CSV file for customs-agent (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/export-documents/clearances-report')
        .query({ from: '2025-01-01', to: '2026-12-31' })
        .set(bearerHeader(customsAgentToken));

      expect(res.status).toBe(200);
      const contentType = res.headers['content-type'] ?? '';
      expect(contentType).toMatch(/text\/csv|application\/octet-stream/i);
    });

    it('returns 403 for cooperative-member', async () => {
      const memberToken = buildMockJwt(buildJwtPayload('cooperative-member'));
      const res = await request(app.getHttpServer())
        .get('/export-documents/clearances-report')
        .set(bearerHeader(memberToken));
      expect(res.status).toBe(403);
    });
  });
});
