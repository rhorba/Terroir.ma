import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
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
  let cacheManager: { get: jest.Mock; set: jest.Mock; del: jest.Mock };

  beforeEach(async () => {
    certRepo = makeRepo();
    eventRepo = makeRepo();
    producer = makeProducer();
    qrCodeService = makeQrCodeService();
    cacheManager = { get: jest.fn(), set: jest.fn(), del: jest.fn() };

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
        { provide: CACHE_MANAGER, useValue: cacheManager },
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

  // ─── getStats() ───────────────────────────────────────────────────────────

  describe('getStats()', () => {
    const mockRows = {
      byStatus: [{ current_status: 'GRANTED', count: '5' }],
      byRegion: [{ region_code: 'SFI', count: '3' }],
      byProductType: [{ product_type_code: 'ARGAN-OIL', count: '2' }],
    };

    it('returns stats from Redis cache when cache hit', async () => {
      const cached = {
        period: { from: null, to: null },
        byStatus: [{ status: 'GRANTED', count: 5 }],
        byRegion: [{ regionCode: 'SFI', count: 3 }],
        byProductType: [{ productTypeCode: 'ARGAN-OIL', count: 2 }],
      };
      cacheManager.get.mockResolvedValue(cached);

      const result = await service.getStats();

      expect(result).toEqual(cached);
      expect(dataSource.query).not.toHaveBeenCalled();
    });

    it('queries DB, caches result, and returns stats when cache miss', async () => {
      cacheManager.get.mockResolvedValue(null);
      dataSource.query
        .mockResolvedValueOnce(mockRows.byStatus)
        .mockResolvedValueOnce(mockRows.byRegion)
        .mockResolvedValueOnce(mockRows.byProductType);

      const result = await service.getStats();

      expect(dataSource.query).toHaveBeenCalledTimes(3);
      expect(cacheManager.set).toHaveBeenCalledWith(
        'stats:certifications:all:all',
        expect.any(Object),
        300_000,
      );
      expect(result.byStatus).toEqual([{ status: 'GRANTED', count: 5 }]);
      expect(result.byRegion).toEqual([{ regionCode: 'SFI', count: 3 }]);
      expect(result.byProductType).toEqual([{ productTypeCode: 'ARGAN-OIL', count: 2 }]);
    });

    it('uses date-scoped cache key and passes params when from/to provided', async () => {
      cacheManager.get.mockResolvedValue(null);
      dataSource.query
        .mockResolvedValueOnce(mockRows.byStatus)
        .mockResolvedValueOnce(mockRows.byRegion)
        .mockResolvedValueOnce(mockRows.byProductType);

      await service.getStats('2026-01-01', '2026-12-31');

      expect(cacheManager.get).toHaveBeenCalledWith('stats:certifications:2026-01-01:2026-12-31');
      expect(cacheManager.set).toHaveBeenCalledWith(
        'stats:certifications:2026-01-01:2026-12-31',
        expect.any(Object),
        300_000,
      );
    });

    it('sets period.from and period.to to null when no date range provided', async () => {
      cacheManager.get.mockResolvedValue(null);
      dataSource.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getStats();

      expect(result.period).toEqual({ from: null, to: null });
    });
  });

  // ─── exportForMapmdref() — US-084 ─────────────────────────────────────────

  describe('exportForMapmdref()', () => {
    it('returns all certifications when no filters provided', async () => {
      const certs = [buildCert({ currentStatus: CertificationStatus.GRANTED })];
      certRepo.find.mockResolvedValue(certs);

      const result = await service.exportForMapmdref({});

      expect(certRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: {}, take: 10_000 }),
      );
      expect(result).toEqual(certs);
    });

    it('applies status filter when provided', async () => {
      certRepo.find.mockResolvedValue([]);

      await service.exportForMapmdref({ status: CertificationStatus.GRANTED });

      expect(certRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ currentStatus: CertificationStatus.GRANTED }),
        }),
      );
    });

    it('applies Between date range filter when from and to are provided', async () => {
      certRepo.find.mockResolvedValue([]);

      await service.exportForMapmdref({ from: '2026-01-01', to: '2026-12-31' });

      const call = certRepo.find.mock.calls[0][0] as { where: { requestedAt: unknown } };
      // Between() returns a FindOperator — verify requestedAt is set
      expect(call.where.requestedAt).toBeDefined();
    });
  });

  // ─── complianceReport() — US-083 ──────────────────────────────────────────

  describe('complianceReport()', () => {
    it('returns grouped compliance rows with numeric counts', async () => {
      const rawRows = [
        {
          cooperativeId: 'coop-1',
          cooperativeName: 'Coop Argane',
          totalRequests: '5',
          pending: '2',
          granted: '2',
          denied: '1',
          revoked: '0',
          renewed: '0',
        },
      ];
      dataSource.query.mockResolvedValue(rawRows);

      const result = await service.complianceReport();

      expect(dataSource.query).toHaveBeenCalled();
      const first = result[0]!;
      expect(first.cooperativeName).toBe('Coop Argane');
      expect(first.totalRequests).toBe(5); // PostgreSQL returns strings → cast to number
      expect(first.granted).toBe(2);
    });

    it('passes date params to query when from and to are provided', async () => {
      dataSource.query.mockResolvedValue([]);

      await service.complianceReport('2026-01-01', '2026-12-31');

      const [, params] = dataSource.query.mock.calls[0] as [string, string[]];
      expect(params).toEqual(['2026-01-01', '2026-12-31']);
    });
  });

  // ─── onssaReport() — US-089 ───────────────────────────────────────────────

  describe('onssaReport()', () => {
    it('returns GRANTED certification rows from dataSource', async () => {
      const rawRows = [
        {
          certificationNumber: 'TERROIR-IGP-SOUSS-2025-000001',
          cooperativeName: 'Coop Argane',
          productTypeCode: 'ARGAN-OIL',
          regionCode: 'SOUSS_MASSA',
          certificationType: 'IGP',
          grantedAt: new Date('2025-06-01'),
          validFrom: '2025-06-01',
          validUntil: '2026-06-01',
        },
      ];
      dataSource.query.mockResolvedValue(rawRows);

      const result = await service.onssaReport();

      expect(dataSource.query).toHaveBeenCalled();
      expect(result[0]!.certificationNumber).toBe('TERROIR-IGP-SOUSS-2025-000001');
    });

    it('passes date params to query when from and to are provided', async () => {
      dataSource.query.mockResolvedValue([]);

      await service.onssaReport('2025-01-01', '2025-12-31');

      const [, params] = dataSource.query.mock.calls[0] as [string, string[]];
      expect(params).toEqual(['2025-01-01', '2025-12-31']);
    });
  });

  // ─── getAnalytics() — US-082 ──────────────────────────────────────────────

  describe('getAnalytics()', () => {
    it('returns cached analytics when available', async () => {
      const cached = {
        period: { from: null, to: null },
        byRegion: [],
        byProductType: [],
        generatedAt: '2026-04-13T00:00:00.000Z',
      };
      cacheManager.get.mockResolvedValue(cached);

      const result = await service.getAnalytics();

      expect(result).toBe(cached);
      expect(dataSource.query).not.toHaveBeenCalled();
    });

    it('queries DB and maps byRegion and byProductType correctly', async () => {
      cacheManager.get.mockResolvedValue(null);
      cacheManager.set.mockResolvedValue(undefined);
      dataSource.query
        .mockResolvedValueOnce([
          { region: 'SOUSS-MASSA', granted: '5', denied: '1', revoked: '0', total: '6' },
        ])
        .mockResolvedValueOnce([
          { product_type: 'ARGAN_OIL', granted: '5', denied: '1', revoked: '0', total: '6' },
        ]);

      const result = await service.getAnalytics();

      expect(result.byRegion).toHaveLength(1);
      expect(result.byRegion[0]!.region).toBe('SOUSS-MASSA');
      expect(result.byRegion[0]!.granted).toBe(5);
      expect(result.byRegion[0]!.total).toBe(6);
      expect(result.byProductType[0]!.productType).toBe('ARGAN_OIL');
      expect(result.period).toEqual({ from: null, to: null });
      expect(cacheManager.set).toHaveBeenCalledWith(
        'analytics:certifications:all:all',
        result,
        300_000,
      );
    });
  });
});
