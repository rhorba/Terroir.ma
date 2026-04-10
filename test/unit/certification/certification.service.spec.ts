import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CertificationService } from '../../../src/modules/certification/services/certification.service';
import {
  Certification,
  CertificationStatus,
} from '../../../src/modules/certification/entities/certification.entity';
import { CertificationEvent } from '../../../src/modules/certification/entities/certification-event.entity';
import { CertificationProducer } from '../../../src/modules/certification/events/certification.producer';
import { QrCodeService } from '../../../src/modules/certification/services/qr-code.service';

// ─── Entity manager mock used inside dataSource.transaction callbacks ─────────
const makeMockEm = () => ({
  create: jest.fn().mockImplementation((_Entity: unknown, dto: unknown) => dto),
  save: jest.fn().mockImplementation(async (_Entity: unknown, val: unknown) => val),
  query: jest.fn().mockResolvedValue([{ last_seq: 1 }]),
});

const makeRepo = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn().mockImplementation((dto) => dto),
  find: jest.fn(),
  findAndCount: jest.fn(),
  update: jest.fn(),
  count: jest.fn().mockResolvedValue(0),
});

const makeProducer = () => ({
  publishCertificationRequested: jest.fn().mockResolvedValue(undefined),
  publishCertificationGranted: jest.fn().mockResolvedValue(undefined),
  publishCertificationDenied: jest.fn().mockResolvedValue(undefined),
  publishCertificationRevoked: jest.fn().mockResolvedValue(undefined),
  publishFinalReviewStarted: jest.fn().mockResolvedValue(undefined),
  publishCertificationRenewed: jest.fn().mockResolvedValue(undefined),
});

const makeQrCodeService = () => ({
  generateQrCode: jest.fn().mockResolvedValue({ id: 'qr-uuid' }),
  deactivateByCertificationId: jest.fn().mockResolvedValue(undefined),
  evictQrCache: jest.fn().mockResolvedValue(undefined),
});

/**
 * Build a Certification stub in the given status.
 */
function buildCert(overrides: Partial<Certification> = {}): Certification {
  return {
    id: 'cert-001',
    cooperativeId: 'coop-001',
    cooperativeName: 'Coop Test',
    batchId: 'batch-001',
    productTypeCode: 'ARGAN-OIL',
    certificationType: 'IGP',
    regionCode: 'SFI',
    currentStatus: CertificationStatus.DRAFT,
    certificationNumber: null,
    requestedBy: 'user-001',
    requestedAt: new Date(),
    createdBy: 'user-001',
    ...overrides,
  } as Certification;
}

describe('CertificationService', () => {
  let service: CertificationService;
  let certRepo: ReturnType<typeof makeRepo>;
  let eventRepo: ReturnType<typeof makeRepo>;
  let producer: ReturnType<typeof makeProducer>;
  let qrCodeService: ReturnType<typeof makeQrCodeService>;
  let dataSource: { transaction: jest.Mock; query: jest.Mock };

  beforeEach(async () => {
    certRepo = makeRepo();
    eventRepo = makeRepo();
    producer = makeProducer();
    qrCodeService = makeQrCodeService();

    // transaction mock: run the callback with a mock entity manager
    dataSource = {
      transaction: jest
        .fn()
        .mockImplementation(async (cb: (em: ReturnType<typeof makeMockEm>) => Promise<unknown>) => {
          const em = makeMockEm();
          return cb(em);
        }),
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CertificationService,
        { provide: getRepositoryToken(Certification), useValue: certRepo },
        { provide: getRepositoryToken(CertificationEvent), useValue: eventRepo },
        { provide: CertificationProducer, useValue: producer },
        { provide: QrCodeService, useValue: qrCodeService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<CertificationService>(CertificationService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── isEventProcessed() ───────────────────────────────────────────────────

  describe('isEventProcessed()', () => {
    it('returns false when no matching correlationId exists', async () => {
      eventRepo.count.mockResolvedValue(0);
      expect(await service.isEventProcessed('unknown-id')).toBe(false);
    });

    it('returns true when correlationId already recorded', async () => {
      eventRepo.count.mockResolvedValue(1);
      expect(await service.isEventProcessed('known-id')).toBe(true);
    });
  });

  // ─── requestCertification() ───────────────────────────────────────────────

  describe('requestCertification()', () => {
    it('creates a DRAFT certification and publishes the requested event', async () => {
      const cert = buildCert();
      certRepo.create.mockReturnValue(cert);
      certRepo.save.mockResolvedValue(cert);

      const dto = {
        cooperativeName: 'Coop Test',
        batchId: 'batch-001',
        productTypeCode: 'ARGAN-OIL',
        certificationType: 'IGP',
        regionCode: 'SFI',
      };

      const result = await service.requestCertification(dto as never, 'user-001', 'corr-001');

      expect(certRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          currentStatus: CertificationStatus.DRAFT,
          requestedBy: 'user-001',
        }),
      );
      expect(certRepo.save).toHaveBeenCalled();
      expect(producer.publishCertificationRequested).toHaveBeenCalledWith(cert, 'corr-001');
      expect(result).toEqual(cert);
    });
  });

  // ─── findById() ───────────────────────────────────────────────────────────

  describe('findById()', () => {
    it('returns certification when found', async () => {
      const cert = buildCert();
      certRepo.findOne.mockResolvedValue(cert);

      const result = await service.findById('cert-001');
      expect(result).toEqual(cert);
    });

    it('throws NotFoundException when certification not found', async () => {
      certRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── findByCooperative() ──────────────────────────────────────────────────

  describe('findByCooperative()', () => {
    it('returns all certifications for a cooperative', async () => {
      const certs = [buildCert(), buildCert({ id: 'cert-002' })];
      certRepo.find.mockResolvedValue(certs);

      const result = await service.findByCooperative('coop-001');

      expect(certRepo.find).toHaveBeenCalledWith({
        where: { cooperativeId: 'coop-001' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(certs);
    });
  });

  // ─── findPending() ────────────────────────────────────────────────────────

  describe('findPending()', () => {
    it('returns paginated certifications with actionable statuses', async () => {
      const mockData = [buildCert({ currentStatus: CertificationStatus.SUBMITTED })];
      certRepo.findAndCount.mockResolvedValue([mockData, 1]);

      const result = await service.findPending(1, 20);

      expect(certRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { createdAt: 'DESC' },
          skip: 0,
          take: 20,
        }),
      );
      expect(result.data).toEqual(mockData);
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1 });
    });

    it('calculates skip correctly for page 2', async () => {
      certRepo.findAndCount.mockResolvedValue([[], 50]);

      const result = await service.findPending(2, 10);

      expect(certRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
      expect(result.meta).toEqual({ page: 2, limit: 10, total: 50 });
    });
  });

  // ─── findByCooperativePaginated() ─────────────────────────────────────────

  describe('findByCooperativePaginated()', () => {
    it('returns paginated certifications for a cooperative', async () => {
      const mockData = [buildCert({ cooperativeId: 'coop-002' })];
      certRepo.findAndCount.mockResolvedValue([mockData, 5]);

      const result = await service.findByCooperativePaginated('coop-002', 1, 20);

      expect(certRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { cooperativeId: 'coop-002' },
          order: { createdAt: 'DESC' },
          skip: 0,
          take: 20,
        }),
      );
      expect(result.data).toEqual(mockData);
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 5 });
    });

    it('returns empty data when cooperative has no certifications', async () => {
      certRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findByCooperativePaginated('unknown-coop', 1, 20);

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });

  // ─── State machine transitions ────────────────────────────────────────────

  describe('submitRequest() — DRAFT → SUBMITTED', () => {
    it('transitions certification from DRAFT to SUBMITTED', async () => {
      const cert = buildCert({ currentStatus: CertificationStatus.DRAFT });
      certRepo.findOne.mockResolvedValue(cert);

      await service.submitRequest('cert-001', 'user-001', 'cooperative-admin', 'corr-001');

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(producer.publishCertificationRequested).toHaveBeenCalled();
    });

    it('throws BadRequestException when cert is not in DRAFT status', async () => {
      const cert = buildCert({ currentStatus: CertificationStatus.SUBMITTED });
      certRepo.findOne.mockResolvedValue(cert);

      await expect(
        service.submitRequest('cert-001', 'user-001', 'cooperative-admin', 'corr-001'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('startReview() — SUBMITTED → DOCUMENT_REVIEW', () => {
    it('transitions certification to DOCUMENT_REVIEW', async () => {
      const cert = buildCert({ currentStatus: CertificationStatus.SUBMITTED });
      certRepo.findOne.mockResolvedValue(cert);

      await service.startReview(
        'cert-001',
        'looks good',
        'body-001',
        'certification-body',
        'corr-001',
      );

      expect(dataSource.transaction).toHaveBeenCalled();
    });

    it('throws BadRequestException when cert is not in SUBMITTED status', async () => {
      const cert = buildCert({ currentStatus: CertificationStatus.DRAFT });
      certRepo.findOne.mockResolvedValue(cert);

      await expect(
        service.startReview('cert-001', null, 'body-001', 'certification-body', 'corr-001'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('receiveLabResults() — LAB_TESTING → LAB_RESULTS_RECEIVED', () => {
    it('transitions to LAB_RESULTS_RECEIVED when matching cert found', async () => {
      const cert = buildCert({ currentStatus: CertificationStatus.LAB_TESTING });
      certRepo.findOne.mockResolvedValue(cert);

      await service.receiveLabResults('batch-001', 'test-001', true, 'corr-001');

      expect(dataSource.transaction).toHaveBeenCalled();
    });

    it('is a no-op when no LAB_TESTING cert found for the batch', async () => {
      certRepo.findOne.mockResolvedValue(null);

      await service.receiveLabResults('batch-001', 'test-001', true, 'corr-001');

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('startFinalReview() — LAB_RESULTS_RECEIVED → UNDER_REVIEW', () => {
    it('transitions to UNDER_REVIEW and publishes event', async () => {
      const cert = buildCert({ currentStatus: CertificationStatus.LAB_RESULTS_RECEIVED });
      certRepo.findOne.mockResolvedValue(cert);

      await service.startFinalReview('cert-001', 'body-001', 'certification-body', 'corr-001');

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(producer.publishFinalReviewStarted).toHaveBeenCalled();
    });
  });

  describe('grantCertification() — UNDER_REVIEW → GRANTED', () => {
    it('grants certification, generates QR, and publishes event', async () => {
      const cert = buildCert({ currentStatus: CertificationStatus.UNDER_REVIEW });
      certRepo.findOne.mockResolvedValue(cert);

      const dto = {
        validFrom: '2026-01-01',
        validUntil: '2029-01-01',
        remarks: 'All checks passed',
      };

      await service.grantCertification(
        'cert-001',
        dto as never,
        'body-001',
        'certification-body',
        'corr-001',
      );

      expect(dataSource.transaction).toHaveBeenCalledTimes(2); // generateCertificationNumber + applyTransition
      expect(qrCodeService.generateQrCode).toHaveBeenCalled();
      expect(producer.publishCertificationGranted).toHaveBeenCalled();
    });

    it('throws BadRequestException when cert is not UNDER_REVIEW', async () => {
      const cert = buildCert({ currentStatus: CertificationStatus.GRANTED });
      certRepo.findOne.mockResolvedValue(cert);

      await expect(
        service.grantCertification(
          'cert-001',
          {} as never,
          'body-001',
          'certification-body',
          'corr-001',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('denyCertification() — UNDER_REVIEW → DENIED', () => {
    it('denies certification and publishes event', async () => {
      const cert = buildCert({ currentStatus: CertificationStatus.UNDER_REVIEW });
      certRepo.findOne.mockResolvedValue(cert);

      await service.denyCertification(
        'cert-001',
        { reason: 'Inspection failed' } as never,
        'body-001',
        'certification-body',
        'corr-001',
      );

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(producer.publishCertificationDenied).toHaveBeenCalledWith(
        expect.anything(),
        'body-001',
        'Inspection failed',
        'corr-001',
      );
    });

    it('throws BadRequestException when cert is not UNDER_REVIEW', async () => {
      const cert = buildCert({ currentStatus: CertificationStatus.DRAFT });
      certRepo.findOne.mockResolvedValue(cert);

      await expect(
        service.denyCertification(
          'cert-001',
          { reason: 'x' } as never,
          'body-001',
          'certification-body',
          'corr-001',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('revokeCertification() — GRANTED → REVOKED', () => {
    it('revokes certification, deactivates QR, and publishes event', async () => {
      const cert = buildCert({ currentStatus: CertificationStatus.GRANTED });
      certRepo.findOne.mockResolvedValue(cert);

      await service.revokeCertification(
        'cert-001',
        'Fraud detected',
        'admin-001',
        'super-admin',
        'corr-001',
      );

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(qrCodeService.deactivateByCertificationId).toHaveBeenCalledWith('cert-001');
      expect(producer.publishCertificationRevoked).toHaveBeenCalledWith(
        expect.anything(),
        'admin-001',
        'Fraud detected',
        'corr-001',
      );
    });

    it('throws BadRequestException when cert is not GRANTED', async () => {
      const cert = buildCert({ currentStatus: CertificationStatus.DENIED });
      certRepo.findOne.mockResolvedValue(cert);

      await expect(
        service.revokeCertification('cert-001', 'reason', 'admin-001', 'super-admin', 'corr-001'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('renewCertification() — GRANTED → RENEWED', () => {
    it('transitions old cert to RENEWED, evicts QR cache, and creates a new DRAFT cert', async () => {
      const oldCert = buildCert({ currentStatus: CertificationStatus.GRANTED });
      const newCert = buildCert({ id: 'cert-002', currentStatus: CertificationStatus.DRAFT });
      certRepo.findOne.mockResolvedValue(oldCert);
      certRepo.create.mockReturnValue(newCert);
      certRepo.save.mockResolvedValue(newCert);

      const result = await service.renewCertification(
        'cert-001',
        'user-001',
        'cooperative-admin',
        'corr-001',
      );

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(qrCodeService.evictQrCache).toHaveBeenCalledWith('cert-001');
      expect(certRepo.save).toHaveBeenCalled();
      expect(producer.publishCertificationRenewed).toHaveBeenCalled();
      expect(result).toEqual(newCert);
    });

    it('throws BadRequestException when cert is not GRANTED', async () => {
      const cert = buildCert({ currentStatus: CertificationStatus.RENEWED });
      certRepo.findOne.mockResolvedValue(cert);

      await expect(
        service.renewCertification('cert-001', 'user-001', 'cooperative-admin', 'corr-001'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
