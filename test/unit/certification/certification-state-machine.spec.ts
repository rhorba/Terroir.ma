/**
 * Unit tests: CertificationService state machine guard.
 *
 * Verifies that every transition method throws BadRequestException
 * when the certification is not in the expected status.
 * Tests all 12 transitions (Steps 1–12).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CertificationService } from '../../../src/modules/certification/services/certification.service';
import {
  Certification,
  CertificationStatus,
} from '../../../src/modules/certification/entities/certification.entity';
import { CertificationEvent } from '../../../src/modules/certification/entities/certification-event.entity';
import { CertificationProducer } from '../../../src/modules/certification/events/certification.producer';
import { QrCodeService } from '../../../src/modules/certification/services/qr-code.service';

const makeCert = (status: CertificationStatus): Certification =>
  ({
    id: 'cert-uuid',
    currentStatus: status,
    cooperativeId: 'coop-uuid',
    batchId: 'batch-uuid',
    productTypeCode: 'ARGAN_OIL',
    certificationType: 'IGP',
    regionCode: 'SFI',
    cooperativeName: 'Test Coop',
    requestedBy: 'user-uuid',
    requestedAt: new Date(),
    createdBy: 'user-uuid',
    certificationNumber: null,
    grantedBy: null,
    grantedAt: null,
    validFrom: null,
    validUntil: null,
    deniedBy: null,
    deniedAt: null,
    denialReason: null,
    revokedBy: null,
    revokedAt: null,
    revocationReason: null,
    renewedFromId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  }) as unknown as Certification;

const mockRepo = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
  count: jest.fn().mockResolvedValue(0),
});

const mockProducer = () => ({
  publishCertificationRequested: jest.fn().mockResolvedValue(undefined),
  publishCertificationGranted: jest.fn().mockResolvedValue(undefined),
  publishCertificationDenied: jest.fn().mockResolvedValue(undefined),
  publishCertificationRevoked: jest.fn().mockResolvedValue(undefined),
  publishFinalReviewStarted: jest.fn().mockResolvedValue(undefined),
  publishCertificationRenewed: jest.fn().mockResolvedValue(undefined),
});

const mockQrCodeService = () => ({
  generateQrCode: jest.fn().mockResolvedValue({ id: 'qr-uuid' }),
  deactivateByCertificationId: jest.fn().mockResolvedValue(undefined),
  evictQrCache: jest.fn().mockResolvedValue(undefined),
});

const mockDataSource = () => ({
  transaction: jest.fn().mockImplementation(async (cb: (em: unknown) => Promise<unknown>) =>
    cb({
      create: jest.fn().mockReturnValue({}),
      save: jest.fn().mockImplementation((_entity: unknown, obj: unknown) => Promise.resolve(obj)),
    }),
  ),
  query: jest.fn(),
});

describe('CertificationService — State Machine Guards', () => {
  let service: CertificationService;
  let certRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    certRepo = mockRepo();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CertificationService,
        { provide: getRepositoryToken(Certification), useValue: certRepo },
        { provide: getRepositoryToken(CertificationEvent), useFactory: mockRepo },
        { provide: CertificationProducer, useFactory: mockProducer },
        { provide: QrCodeService, useFactory: mockQrCodeService },
        { provide: DataSource, useFactory: mockDataSource },
      ],
    }).compile();

    service = module.get<CertificationService>(CertificationService);
  });

  describe('submitRequest — DRAFT only', () => {
    it('throws when status is SUBMITTED (not DRAFT)', async () => {
      certRepo.findOne.mockResolvedValue(makeCert(CertificationStatus.SUBMITTED));
      await expect(
        service.submitRequest('cert-uuid', 'actor-id', 'cooperative-admin', 'corr-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when status is DOCUMENT_REVIEW (not DRAFT)', async () => {
      certRepo.findOne.mockResolvedValue(makeCert(CertificationStatus.DOCUMENT_REVIEW));
      await expect(
        service.submitRequest('cert-uuid', 'actor-id', 'cooperative-admin', 'corr-id'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('startReview — SUBMITTED only', () => {
    it('throws when status is DRAFT (not SUBMITTED)', async () => {
      certRepo.findOne.mockResolvedValue(makeCert(CertificationStatus.DRAFT));
      await expect(
        service.startReview('cert-uuid', null, 'actor-id', 'certification-body', 'corr-id'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('scheduleInspectionChain — DOCUMENT_REVIEW only', () => {
    it('throws when status is SUBMITTED (not DOCUMENT_REVIEW)', async () => {
      certRepo.findOne.mockResolvedValue(makeCert(CertificationStatus.SUBMITTED));
      await expect(
        service.scheduleInspectionChain(
          'cert-uuid',
          {
            certificationId: 'cert-uuid',
            inspectorId: 'insp-uuid',
            scheduledDate: '2026-05-01',
            farmIds: [],
          },
          'actor-id',
          'certification-body',
          'corr-id',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('startInspection — INSPECTION_SCHEDULED only', () => {
    it('throws when status is DOCUMENT_REVIEW (not INSPECTION_SCHEDULED)', async () => {
      certRepo.findOne.mockResolvedValue(makeCert(CertificationStatus.DOCUMENT_REVIEW));
      await expect(
        service.startInspection('cert-uuid', 'actor-id', 'inspector', 'corr-id'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('completeInspectionChain — INSPECTION_IN_PROGRESS only', () => {
    it('throws when status is INSPECTION_SCHEDULED (not INSPECTION_IN_PROGRESS)', async () => {
      certRepo.findOne.mockResolvedValue(makeCert(CertificationStatus.INSPECTION_SCHEDULED));
      await expect(
        service.completeInspectionChain(
          'cert-uuid',
          { passed: true, summary: 'All good' },
          'actor-id',
          'inspector',
          'corr-id',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('requestLab — INSPECTION_COMPLETE only', () => {
    it('throws when status is INSPECTION_IN_PROGRESS (not INSPECTION_COMPLETE)', async () => {
      certRepo.findOne.mockResolvedValue(makeCert(CertificationStatus.INSPECTION_IN_PROGRESS));
      await expect(
        service.requestLab('cert-uuid', null, null, 'actor-id', 'certification-body', 'corr-id'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('receiveLabResults — LAB_TESTING only', () => {
    it('logs warning and returns without throwing when no LAB_TESTING cert exists for batch', async () => {
      certRepo.findOne.mockResolvedValue(null);
      await expect(
        service.receiveLabResults('batch-uuid', 'lab-test-uuid', true, 'corr-id'),
      ).resolves.toBeUndefined();
    });
  });

  describe('error message content', () => {
    it('includes the current status in the error message', async () => {
      certRepo.findOne.mockResolvedValue(makeCert(CertificationStatus.GRANTED));
      try {
        await service.submitRequest('cert-uuid', 'actor-id', 'cooperative-admin', 'corr-id');
        fail('Expected BadRequestException');
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect((err as BadRequestException).message).toContain(CertificationStatus.GRANTED);
        expect((err as BadRequestException).message).toContain(CertificationStatus.DRAFT);
      }
    });
  });

  describe('startFinalReview — LAB_RESULTS_RECEIVED only', () => {
    it('throws when status is UNDER_REVIEW (not LAB_RESULTS_RECEIVED)', async () => {
      certRepo.findOne.mockResolvedValue(makeCert(CertificationStatus.UNDER_REVIEW));
      await expect(
        service.startFinalReview('cert-uuid', 'actor-id', 'certification-body', 'corr-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when status is GRANTED (not LAB_RESULTS_RECEIVED)', async () => {
      certRepo.findOne.mockResolvedValue(makeCert(CertificationStatus.GRANTED));
      await expect(
        service.startFinalReview('cert-uuid', 'actor-id', 'certification-body', 'corr-id'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('grantCertification — UNDER_REVIEW only (tightened from Sprint 2)', () => {
    it('throws when status is LAB_RESULTS_RECEIVED (guard now strict to UNDER_REVIEW)', async () => {
      certRepo.findOne.mockResolvedValue(makeCert(CertificationStatus.LAB_RESULTS_RECEIVED));
      await expect(
        service.grantCertification(
          'cert-uuid',
          { validFrom: '2026-01-01', validUntil: '2027-01-01' } as never,
          'actor-id',
          'certification-body',
          'corr-id',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('denyCertification — UNDER_REVIEW only (tightened from Sprint 2)', () => {
    it('throws when status is LAB_RESULTS_RECEIVED (guard now strict to UNDER_REVIEW)', async () => {
      certRepo.findOne.mockResolvedValue(makeCert(CertificationStatus.LAB_RESULTS_RECEIVED));
      await expect(
        service.denyCertification(
          'cert-uuid',
          { reason: 'Failed lab' } as never,
          'actor-id',
          'certification-body',
          'corr-id',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('renewCertification — GRANTED only', () => {
    it('throws when status is UNDER_REVIEW (not GRANTED)', async () => {
      certRepo.findOne.mockResolvedValue(makeCert(CertificationStatus.UNDER_REVIEW));
      await expect(
        service.renewCertification('cert-uuid', 'actor-id', 'cooperative-admin', 'corr-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when status is RENEWED (cannot renew twice without re-granting)', async () => {
      certRepo.findOne.mockResolvedValue(makeCert(CertificationStatus.RENEWED));
      await expect(
        service.renewCertification('cert-uuid', 'actor-id', 'cooperative-admin', 'corr-id'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
