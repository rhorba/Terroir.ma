/**
 * E2E test: Certification chain state machine — Steps 1–12 via REST.
 *
 * Verifies:
 * - Each transition endpoint responds 200 for the correct role
 * - Out-of-order calls return 400 Bad Request
 * - Wrong-role calls return 403 Forbidden
 *
 * Runs against a test NestJS app with in-memory-style DB (synchronize: true).
 * Uses TestJwtStrategy — no real Keycloak required.
 */
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, buildMockJwt, bearerHeader } from '../../helpers/app.helper';
import { buildJwtPayload } from '../../factories/user.factory';
import { DataSource } from 'typeorm';
import {
  Certification,
  CertificationStatus,
} from '../../../src/modules/certification/entities/certification.entity';

// Fixed valid UUIDs for test data (uuid-typed columns reject plain strings)
const E2E_COOP_ID = 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b01';
const E2E_BATCH_ID = 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b02';
const E2E_USER_ID = 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b03';
const E2E_INSP_ID = 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b04';

describe('Certification Chain E2E (steps 1–12)', () => {
  let app: INestApplication;
  let cooperativeAdminToken: string;
  let certBodyToken: string;
  let inspectorToken: string;
  let dataSource: DataSource;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get<DataSource>(DataSource);

    cooperativeAdminToken = buildMockJwt(buildJwtPayload('cooperative-admin'));
    certBodyToken = buildMockJwt(buildJwtPayload('certification-body'));
    inspectorToken = buildMockJwt(buildJwtPayload('inspector'));
  });

  afterAll(async () => {
    await app.close();
  });

  // Helper: seed a DRAFT certification directly in the DB
  async function seedDraftCertification(): Promise<string> {
    const repo = dataSource.getRepository(Certification);
    const cert = repo.create({
      cooperativeId: E2E_COOP_ID,
      cooperativeName: 'Chain Test Coop',
      batchId: E2E_BATCH_ID,
      productTypeCode: 'ARGAN_OIL',
      certificationType: 'IGP',
      regionCode: 'SFI',
      requestedBy: E2E_USER_ID,
      requestedAt: new Date(),
      currentStatus: CertificationStatus.DRAFT,
      createdBy: E2E_USER_ID,
    });
    const saved = await repo.save(cert);
    return saved.id;
  }

  describe('Happy path: steps 1–6 in correct order and role', () => {
    it('walks through all 6 REST-triggered transitions', async () => {
      const certId = await seedDraftCertification();

      // Step 1: DRAFT → SUBMITTED (cooperative-admin)
      await request(app.getHttpServer())
        .post(`/certifications/${certId}/submit`)
        .set(bearerHeader(cooperativeAdminToken))
        .send({})
        .expect(200)
        .expect((res) => {
          expect(res.body.currentStatus).toBe(CertificationStatus.SUBMITTED);
        });

      // Step 2: SUBMITTED → DOCUMENT_REVIEW (certification-body)
      await request(app.getHttpServer())
        .post(`/certifications/${certId}/start-review`)
        .set(bearerHeader(certBodyToken))
        .send({ remarks: 'Documentation complete' })
        .expect(200)
        .expect((res) => {
          expect(res.body.currentStatus).toBe(CertificationStatus.DOCUMENT_REVIEW);
        });

      // Step 3: DOCUMENT_REVIEW → INSPECTION_SCHEDULED (certification-body)
      await request(app.getHttpServer())
        .post(`/certifications/${certId}/schedule-inspection`)
        .set(bearerHeader(certBodyToken))
        .send({
          certificationId: certId,
          inspectorId: E2E_INSP_ID,
          scheduledDate: '2026-06-01',
          farmIds: [],
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.currentStatus).toBe(CertificationStatus.INSPECTION_SCHEDULED);
        });

      // Step 4: INSPECTION_SCHEDULED → INSPECTION_IN_PROGRESS (inspector)
      await request(app.getHttpServer())
        .post(`/certifications/${certId}/start-inspection`)
        .set(bearerHeader(inspectorToken))
        .send({})
        .expect(200)
        .expect((res) => {
          expect(res.body.currentStatus).toBe(CertificationStatus.INSPECTION_IN_PROGRESS);
        });

      // Step 5: INSPECTION_IN_PROGRESS → INSPECTION_COMPLETE (inspector)
      await request(app.getHttpServer())
        .post(`/certifications/${certId}/complete-inspection`)
        .set(bearerHeader(inspectorToken))
        .send({ passed: true, summary: 'No issues found during field visit' })
        .expect(200)
        .expect((res) => {
          expect(res.body.currentStatus).toBe(CertificationStatus.INSPECTION_COMPLETE);
        });

      // Step 6: INSPECTION_COMPLETE → LAB_TESTING (certification-body)
      await request(app.getHttpServer())
        .post(`/certifications/${certId}/request-lab`)
        .set(bearerHeader(certBodyToken))
        .send({ remarks: 'Send to ONSSA lab' })
        .expect(200)
        .expect((res) => {
          expect(res.body.currentStatus).toBe(CertificationStatus.LAB_TESTING);
        });
    });
  });

  describe('Guard: out-of-order call returns 400', () => {
    it('returns 400 when submitting an already-SUBMITTED certification', async () => {
      const certId = await seedDraftCertification();

      // Move to SUBMITTED
      await request(app.getHttpServer())
        .post(`/certifications/${certId}/submit`)
        .set(bearerHeader(cooperativeAdminToken))
        .send({})
        .expect(200);

      // Try to submit again → 400
      await request(app.getHttpServer())
        .post(`/certifications/${certId}/submit`)
        .set(bearerHeader(cooperativeAdminToken))
        .send({})
        .expect(400);
    });

    it('returns 400 when trying to start-review a DRAFT (not SUBMITTED)', async () => {
      const certId = await seedDraftCertification();

      // Cert is still in DRAFT — trying to start-review should fail
      await request(app.getHttpServer())
        .post(`/certifications/${certId}/start-review`)
        .set(bearerHeader(certBodyToken))
        .send({})
        .expect(400);
    });
  });

  describe('Guard: wrong-role call returns 403', () => {
    it('returns 403 when cooperative-admin calls start-review', async () => {
      const certId = await seedDraftCertification();

      // Submit first so it's in SUBMITTED state
      await request(app.getHttpServer())
        .post(`/certifications/${certId}/submit`)
        .set(bearerHeader(cooperativeAdminToken))
        .send({})
        .expect(200);

      // cooperative-admin calling start-review → 403
      await request(app.getHttpServer())
        .post(`/certifications/${certId}/start-review`)
        .set(bearerHeader(cooperativeAdminToken)) // wrong role
        .send({})
        .expect(403);
    });

    it('returns 401 when unauthenticated', async () => {
      const certId = await seedDraftCertification();
      await request(app.getHttpServer())
        .post(`/certifications/${certId}/submit`)
        .send({})
        .expect(401);
    });
  });

  describe('Steps 8–12: final review, grant, deny, renew', () => {
    async function seedAtStatus(status: CertificationStatus): Promise<string> {
      const certId = await seedDraftCertification();
      await dataSource.getRepository(Certification).update(certId, { currentStatus: status });
      return certId;
    }

    it('POST start-final-review moves LAB_RESULTS_RECEIVED → UNDER_REVIEW (certification-body)', async () => {
      const certId = await seedAtStatus(CertificationStatus.LAB_RESULTS_RECEIVED);
      await request(app.getHttpServer())
        .post(`/certifications/${certId}/start-final-review`)
        .set(bearerHeader(certBodyToken))
        .send({})
        .expect(200)
        .expect((res) => {
          expect(res.body.currentStatus).toBe(CertificationStatus.UNDER_REVIEW);
        });
    });

    it('POST start-final-review returns 403 for cooperative-admin (wrong role)', async () => {
      const certId = await seedAtStatus(CertificationStatus.LAB_RESULTS_RECEIVED);
      await request(app.getHttpServer())
        .post(`/certifications/${certId}/start-final-review`)
        .set(bearerHeader(cooperativeAdminToken))
        .send({})
        .expect(403);
    });

    it('PATCH grant returns 400 when cert is LAB_RESULTS_RECEIVED (guard tightened to UNDER_REVIEW)', async () => {
      const certId = await seedAtStatus(CertificationStatus.LAB_RESULTS_RECEIVED);
      await request(app.getHttpServer())
        .patch(`/certifications/${certId}/grant`)
        .set(bearerHeader(certBodyToken))
        .send({ validFrom: '2026-05-01', validUntil: '2027-05-01' })
        .expect(400);
    });

    it('PATCH grant moves UNDER_REVIEW → GRANTED (certification-body)', async () => {
      const certId = await seedAtStatus(CertificationStatus.UNDER_REVIEW);
      await request(app.getHttpServer())
        .patch(`/certifications/${certId}/grant`)
        .set(bearerHeader(certBodyToken))
        .send({ validFrom: '2026-05-01', validUntil: '2027-05-01' })
        .expect(200)
        .expect((res) => {
          expect(res.body.currentStatus).toBe(CertificationStatus.GRANTED);
        });
    });

    it('PATCH deny moves UNDER_REVIEW → DENIED (certification-body)', async () => {
      const certId = await seedAtStatus(CertificationStatus.UNDER_REVIEW);
      await request(app.getHttpServer())
        .patch(`/certifications/${certId}/deny`)
        .set(bearerHeader(certBodyToken))
        .send({ reason: 'Lab parameters failed' })
        .expect(200)
        .expect((res) => {
          expect(res.body.currentStatus).toBe(CertificationStatus.DENIED);
        });
    });

    it('POST renew moves GRANTED → RENEWED and returns new DRAFT cert (cooperative-admin)', async () => {
      const certId = await seedAtStatus(CertificationStatus.GRANTED);
      await request(app.getHttpServer())
        .post(`/certifications/${certId}/renew`)
        .set(bearerHeader(cooperativeAdminToken))
        .send({})
        .expect(200)
        .expect((res) => {
          expect(res.body.currentStatus).toBe(CertificationStatus.DRAFT);
          expect(res.body.renewedFromId).toBe(certId);
        });

      // Verify old cert is now RENEWED
      const oldCert = await dataSource.getRepository(Certification).findOneBy({ id: certId });
      expect(oldCert!.currentStatus).toBe(CertificationStatus.RENEWED);
    });

    it('POST renew returns 400 when cert is UNDER_REVIEW (not GRANTED)', async () => {
      const certId = await seedAtStatus(CertificationStatus.UNDER_REVIEW);
      await request(app.getHttpServer())
        .post(`/certifications/${certId}/renew`)
        .set(bearerHeader(cooperativeAdminToken))
        .send({})
        .expect(400);
    });
  });
});
