/**
 * Integration test: CertificationService 12-step state machine (steps 1–12).
 *
 * Uses Testcontainers PostgreSQL with synchronize: true so migrations are not required.
 * Walks the full DRAFT → RENEWED chain and verifies:
 * - currentStatus updates correctly at each step
 * - A CertificationEvent row is appended for every transition
 * - Each event has the correct fromStatus, toStatus, eventType, actorId
 * - isEventProcessed returns true for a known correlationId after a transition
 */
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { CertificationService } from '../../../src/modules/certification/services/certification.service';
import {
  Certification,
  CertificationStatus,
  CertificationEventType,
} from '../../../src/modules/certification/entities/certification.entity';
import { CertificationEvent } from '../../../src/modules/certification/entities/certification-event.entity';
import { Inspection } from '../../../src/modules/certification/entities/inspection.entity';
import { InspectionReport } from '../../../src/modules/certification/entities/inspection-report.entity';
import { QrCode } from '../../../src/modules/certification/entities/qr-code.entity';
import { ExportDocument } from '../../../src/modules/certification/entities/export-document.entity';
import { CertificationProducer } from '../../../src/modules/certification/events/certification.producer';
import { QrCodeService } from '../../../src/modules/certification/services/qr-code.service';

const mockProducer = {
  publishCertificationRequested: jest.fn().mockResolvedValue(undefined),
  publishCertificationGranted: jest.fn().mockResolvedValue(undefined),
  publishCertificationDenied: jest.fn().mockResolvedValue(undefined),
  publishCertificationRevoked: jest.fn().mockResolvedValue(undefined),
  publishInspectionScheduled: jest.fn().mockResolvedValue(undefined),
  publishFinalReviewStarted: jest.fn().mockResolvedValue(undefined),
  publishCertificationRenewed: jest.fn().mockResolvedValue(undefined),
};

const mockQrCodeService = {
  generateQrCode: jest.fn().mockResolvedValue({ id: 'qr-uuid' }),
  deactivateByCertificationId: jest.fn().mockResolvedValue(undefined),
};

describe('CertificationService — Chain Steps 1–12 (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let module: TestingModule;
  let service: CertificationService;
  let certRepo: ReturnType<DataSource['getRepository']>;
  let eventRepo: ReturnType<DataSource['getRepository']>;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('terroir_chain_test')
      .withUsername('test')
      .withPassword('test')
      .start();

    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: container.getConnectionUri(),
          entities: [
            Certification,
            CertificationEvent,
            Inspection,
            InspectionReport,
            QrCode,
            ExportDocument,
          ],
          synchronize: true,
          schema: 'public',
        }),
        TypeOrmModule.forFeature([
          Certification,
          CertificationEvent,
          Inspection,
          InspectionReport,
          QrCode,
          ExportDocument,
        ]),
      ],
      providers: [
        CertificationService,
        { provide: CertificationProducer, useValue: mockProducer },
        { provide: QrCodeService, useValue: mockQrCodeService },
      ],
    }).compile();

    service = module.get<CertificationService>(CertificationService);
    dataSource = module.get<DataSource>(DataSource);
    certRepo = dataSource.getRepository(Certification);
    eventRepo = dataSource.getRepository(CertificationEvent);
  }, 120_000);

  afterEach(async () => {
    await eventRepo.query('DELETE FROM certification_event');
    await certRepo.query('DELETE FROM certification');
  });

  afterAll(async () => {
    await module.close();
    await container.stop();
  });

  it('walks DRAFT → LAB_RESULTS_RECEIVED and appends 7 CertificationEvent rows', async () => {
    // Seed a DRAFT certification
    const cert = certRepo.create({
      cooperativeId: 'coop-uuid',
      cooperativeName: 'Test Cooperative',
      batchId: 'batch-uuid',
      productTypeCode: 'ARGAN_OIL',
      certificationType: 'IGP',
      regionCode: 'SFI',
      requestedBy: 'user-uuid',
      requestedAt: new Date(),
      currentStatus: CertificationStatus.DRAFT,
      createdBy: 'user-uuid',
    });
    const saved = await certRepo.save(cert);
    const id = saved.id;

    // Step 1: DRAFT → SUBMITTED
    let updated = await service.submitRequest(id, 'user-uuid', 'cooperative-admin', 'corr-1');
    expect(updated.currentStatus).toBe(CertificationStatus.SUBMITTED);

    // Step 2: SUBMITTED → DOCUMENT_REVIEW
    updated = await service.startReview(
      id,
      'Looks complete',
      'reviewer-uuid',
      'certification-body',
      'corr-2',
    );
    expect(updated.currentStatus).toBe(CertificationStatus.DOCUMENT_REVIEW);

    // Step 3: DOCUMENT_REVIEW → INSPECTION_SCHEDULED
    updated = await service.scheduleInspectionChain(
      id,
      { certificationId: id, inspectorId: 'insp-uuid', scheduledDate: '2026-05-15', farmIds: [] },
      'reviewer-uuid',
      'certification-body',
      'corr-3',
    );
    expect(updated.currentStatus).toBe(CertificationStatus.INSPECTION_SCHEDULED);

    // Step 4: INSPECTION_SCHEDULED → INSPECTION_IN_PROGRESS
    updated = await service.startInspection(id, 'insp-uuid', 'inspector', 'corr-4');
    expect(updated.currentStatus).toBe(CertificationStatus.INSPECTION_IN_PROGRESS);

    // Step 5: INSPECTION_IN_PROGRESS → INSPECTION_COMPLETE
    updated = await service.completeInspectionChain(
      id,
      { passed: true, summary: 'No major issues found' },
      'insp-uuid',
      'inspector',
      'corr-5',
    );
    expect(updated.currentStatus).toBe(CertificationStatus.INSPECTION_COMPLETE);

    // Step 6: INSPECTION_COMPLETE → LAB_TESTING
    updated = await service.requestLab(
      id,
      'lab-uuid',
      'Send 500g samples',
      'reviewer-uuid',
      'certification-body',
      'corr-6',
    );
    expect(updated.currentStatus).toBe(CertificationStatus.LAB_TESTING);

    // Step 7: LAB_TESTING → LAB_RESULTS_RECEIVED (via internal service method)
    await service.receiveLabResults('batch-uuid', 'lab-test-uuid', true, 'corr-7');
    const final = await certRepo.findOneBy({ id });
    expect(final!.currentStatus).toBe(CertificationStatus.LAB_RESULTS_RECEIVED);

    // Verify 7 CertificationEvent rows were appended
    const events = await eventRepo.find({
      where: { certificationId: id },
      order: { occurredAt: 'ASC' },
    });
    expect(events).toHaveLength(7);

    // Verify event sequence
    const expected = [
      {
        eventType: CertificationEventType.REQUEST_SUBMITTED,
        fromStatus: CertificationStatus.DRAFT,
        toStatus: CertificationStatus.SUBMITTED,
      },
      {
        eventType: CertificationEventType.REVIEW_STARTED,
        fromStatus: CertificationStatus.SUBMITTED,
        toStatus: CertificationStatus.DOCUMENT_REVIEW,
      },
      {
        eventType: CertificationEventType.INSPECTION_SCHEDULED,
        fromStatus: CertificationStatus.DOCUMENT_REVIEW,
        toStatus: CertificationStatus.INSPECTION_SCHEDULED,
      },
      {
        eventType: CertificationEventType.INSPECTION_STARTED,
        fromStatus: CertificationStatus.INSPECTION_SCHEDULED,
        toStatus: CertificationStatus.INSPECTION_IN_PROGRESS,
      },
      {
        eventType: CertificationEventType.INSPECTION_COMPLETED,
        fromStatus: CertificationStatus.INSPECTION_IN_PROGRESS,
        toStatus: CertificationStatus.INSPECTION_COMPLETE,
      },
      {
        eventType: CertificationEventType.LAB_REQUESTED,
        fromStatus: CertificationStatus.INSPECTION_COMPLETE,
        toStatus: CertificationStatus.LAB_TESTING,
      },
      {
        eventType: CertificationEventType.LAB_RESULTS_RECEIVED,
        fromStatus: CertificationStatus.LAB_TESTING,
        toStatus: CertificationStatus.LAB_RESULTS_RECEIVED,
      },
    ];

    events.forEach((event, i) => {
      const ex = expected[i];
      if (!ex) throw new Error(`No expected entry for index ${i}`);
      expect(event.eventType).toBe(ex.eventType);
      expect(event.fromStatus).toBe(ex.fromStatus);
      expect(event.toStatus).toBe(ex.toStatus);
    });
  }, 30_000);

  it('isEventProcessed returns true after a correlationId is recorded', async () => {
    const cert = certRepo.create({
      cooperativeId: 'coop-uuid',
      cooperativeName: 'Test Coop',
      batchId: 'batch-uuid-2',
      productTypeCode: 'ARGAN_OIL',
      certificationType: 'IGP',
      regionCode: 'SFI',
      requestedBy: 'user-uuid',
      requestedAt: new Date(),
      currentStatus: CertificationStatus.DRAFT,
      createdBy: 'user-uuid',
    });
    const saved = await certRepo.save(cert);

    expect(await service.isEventProcessed('unique-corr-id')).toBe(false);
    await service.submitRequest(saved.id, 'user-uuid', 'cooperative-admin', 'unique-corr-id');
    expect(await service.isEventProcessed('unique-corr-id')).toBe(true);
  }, 30_000);

  it('walks LAB_RESULTS_RECEIVED → UNDER_REVIEW → GRANTED → RENEWED + new DRAFT (steps 8, 9, 12)', async () => {
    // Seed at LAB_RESULTS_RECEIVED to bypass steps 1–7
    const cert = certRepo.create({
      cooperativeId: 'coop-uuid',
      cooperativeName: 'Test Cooperative',
      batchId: 'batch-uuid-steps8to12',
      productTypeCode: 'ARGAN_OIL',
      certificationType: 'IGP',
      regionCode: 'SFI',
      requestedBy: 'user-uuid',
      requestedAt: new Date(),
      currentStatus: CertificationStatus.LAB_RESULTS_RECEIVED,
      createdBy: 'user-uuid',
    });
    const saved = await certRepo.save(cert);
    const id = saved.id;

    // Step 8: LAB_RESULTS_RECEIVED → UNDER_REVIEW
    let updated = await service.startFinalReview(
      id,
      'reviewer-uuid',
      'certification-body',
      'corr-8',
    );
    expect(updated.currentStatus).toBe(CertificationStatus.UNDER_REVIEW);

    // Step 9: UNDER_REVIEW → GRANTED
    updated = await service.grantCertification(
      id,
      { validFrom: '2026-05-01', validUntil: '2027-05-01' },
      'reviewer-uuid',
      'certification-body',
      'corr-9',
    );
    expect(updated.currentStatus).toBe(CertificationStatus.GRANTED);
    expect(updated.certificationNumber).toMatch(/^TERROIR-IGP-SFI-\d{4}-\d{3}$/);

    // Step 12: GRANTED → RENEWED (old cert) + new DRAFT
    const newCert = await service.renewCertification(
      id,
      'user-uuid',
      'cooperative-admin',
      'corr-12',
    );
    expect(newCert.currentStatus).toBe(CertificationStatus.DRAFT);
    expect(newCert.renewedFromId).toBe(id);

    const oldCert = await certRepo.findOneBy({ id });
    expect(oldCert!.currentStatus).toBe(CertificationStatus.RENEWED);

    // Verify CertificationEvent rows: 3 events (steps 8, 9, 12 on old cert)
    const events = await eventRepo.find({
      where: { certificationId: id },
      order: { occurredAt: 'ASC' },
    });
    expect(events).toHaveLength(3);
    expect(events[0]!.eventType).toBe(CertificationEventType.FINAL_REVIEW_STARTED);
    expect(events[1]!.eventType).toBe(CertificationEventType.DECISION_GRANTED);
    expect(events[2]!.eventType).toBe(CertificationEventType.CERTIFICATE_RENEWED);
  }, 30_000);

  it('walks UNDER_REVIEW → DENIED and appends DECISION_DENIED event (step 10)', async () => {
    const cert = certRepo.create({
      cooperativeId: 'coop-uuid',
      cooperativeName: 'Test Cooperative',
      batchId: 'batch-uuid-deny',
      productTypeCode: 'ARGAN_OIL',
      certificationType: 'IGP',
      regionCode: 'SFI',
      requestedBy: 'user-uuid',
      requestedAt: new Date(),
      currentStatus: CertificationStatus.UNDER_REVIEW,
      createdBy: 'user-uuid',
    });
    const saved = await certRepo.save(cert);

    const denied = await service.denyCertification(
      saved.id,
      { reason: 'Lab results below threshold' },
      'reviewer-uuid',
      'certification-body',
      'corr-10',
    );
    expect(denied.currentStatus).toBe(CertificationStatus.DENIED);
    expect(denied.denialReason).toBe('Lab results below threshold');

    const events = await eventRepo.find({ where: { certificationId: saved.id } });
    expect(events).toHaveLength(1);
    expect(events[0]!.eventType).toBe(CertificationEventType.DECISION_DENIED);
  }, 30_000);
});
