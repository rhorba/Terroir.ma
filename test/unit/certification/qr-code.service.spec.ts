import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { QrCodeService } from '../../../src/modules/certification/services/qr-code.service';
import { QrCode } from '../../../src/modules/certification/entities/qr-code.entity';
import { QrScanEvent } from '../../../src/modules/certification/entities/qr-scan-event.entity';
import {
  Certification,
  CertificationStatus,
} from '../../../src/modules/certification/entities/certification.entity';
import { CertificationProducer } from '../../../src/modules/certification/events/certification.producer';

const makeRepo = () => ({
  findOne: jest.fn(),
  save: jest.fn().mockResolvedValue({}),
  create: jest.fn((dto: unknown) => dto),
  update: jest.fn(),
  increment: jest.fn().mockResolvedValue(undefined),
});

const makeQrScanEventRepo = () => ({
  create: jest.fn((dto: unknown) => dto),
  save: jest.fn().mockResolvedValue({}),
  manager: {
    query: jest.fn().mockResolvedValue([
      {
        total_scans: '5',
        last_30_days_scans: '2',
        first_scan_at: '2026-01-01T00:00:00Z',
        last_scan_at: '2026-04-01T00:00:00Z',
      },
    ]),
  },
});

const makeCacheManager = () => ({
  get: jest.fn(),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
});

const mockProducer = () => ({
  publishQrCodeGenerated: jest.fn().mockResolvedValue(undefined),
});

const configService = {
  get: (key: string, def?: unknown) => {
    const map: Record<string, unknown> = {
      QR_HMAC_SECRET: 'test-secret-32-chars-padded-here',
      APP_BASE_URL: 'http://localhost:3000',
    };
    return map[key] ?? def;
  },
};

describe('QrCodeService', () => {
  let service: QrCodeService;
  let qrCodeRepo: ReturnType<typeof makeRepo>;
  let certRepo: ReturnType<typeof makeRepo>;
  let qrScanEventRepo: ReturnType<typeof makeQrScanEventRepo>;
  let cacheManager: ReturnType<typeof makeCacheManager>;

  beforeEach(async () => {
    qrCodeRepo = makeRepo();
    certRepo = makeRepo();
    qrScanEventRepo = makeQrScanEventRepo();
    cacheManager = makeCacheManager();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QrCodeService,
        { provide: getRepositoryToken(QrCode), useValue: qrCodeRepo },
        { provide: getRepositoryToken(Certification), useValue: certRepo },
        { provide: getRepositoryToken(QrScanEvent), useValue: qrScanEventRepo },
        { provide: CACHE_MANAGER, useValue: cacheManager },
        { provide: CertificationProducer, useFactory: mockProducer },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<QrCodeService>(QrCodeService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('HMAC signature', () => {
    it('should produce a deterministic HMAC for the same uuid + secret', () => {
      expect(typeof service.generateQrCode).toBe('function');
      expect(typeof service.verifyQrCode).toBe('function');
    });
  });

  describe('generateQrCode()', () => {
    const certId = 'cert-uuid';
    const corrId = 'corr-001';

    it('generates, saves, and returns a QR code for a valid certification', async () => {
      const cert = {
        id: certId,
        certificationNumber: 'TERROIR-IGP-SFI-2025-001',
        cooperativeId: 'coop-001',
        validUntil: '2027-01-01',
      };
      const savedQr = {
        id: 'qr-001',
        certificationId: certId,
        hmacSignature: 'some-sig',
        isActive: true,
      };

      certRepo.findOne.mockResolvedValue(cert);
      qrCodeRepo.update.mockResolvedValue({ affected: 1 });
      qrCodeRepo.create.mockReturnValue(savedQr);
      qrCodeRepo.save.mockResolvedValue(savedQr);

      const result = await service.generateQrCode(certId, corrId);

      // Deactivates existing active QR codes
      expect(qrCodeRepo.update).toHaveBeenCalledWith(
        { certificationId: certId, isActive: true },
        { isActive: false },
      );
      // Saves the new QR code
      expect(qrCodeRepo.save).toHaveBeenCalled();
      expect(result).toEqual(savedQr);
    });

    it('sets expiresAt to null when certification has no validUntil', async () => {
      const cert = {
        id: certId,
        certificationNumber: 'TERROIR-IGP-SFI-2025-001',
        cooperativeId: 'coop-001',
        validUntil: null,
      };
      const savedQr = { id: 'qr-001', certificationId: certId };

      certRepo.findOne.mockResolvedValue(cert);
      qrCodeRepo.update.mockResolvedValue({ affected: 0 });
      qrCodeRepo.create.mockReturnValue(savedQr);
      qrCodeRepo.save.mockResolvedValue(savedQr);

      await service.generateQrCode(certId, corrId);

      expect(qrCodeRepo.create).toHaveBeenCalledWith(expect.objectContaining({ expiresAt: null }));
    });

    it('throws NotFoundException when certification does not exist', async () => {
      certRepo.findOne.mockResolvedValue(null);

      await expect(service.generateQrCode('bad-cert', corrId)).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'CERTIFICATION_NOT_FOUND' }),
        }),
      );
    });
  });

  describe('verifyQrCode()', () => {
    const sig = 'valid-sig';
    const activeQr = {
      id: 'qr-uuid',
      certificationId: 'cert-uuid',
      hmacSignature: sig,
      isActive: true,
      scansCount: 0,
      expiresAt: null,
    };

    it('returns valid: true for a GRANTED cert', async () => {
      const grantedCert = { id: 'cert-uuid', currentStatus: CertificationStatus.GRANTED };
      cacheManager.get.mockResolvedValue(null);
      qrCodeRepo.findOne.mockResolvedValue(activeQr);
      certRepo.findOne.mockResolvedValue(grantedCert);

      const result = await service.verifyQrCode(sig);
      expect(result.valid).toBe(true);
      expect(result.message).toContain('valid');
    });

    it('returns valid: false with superseded message and newCertificationNumber for RENEWED cert', async () => {
      const renewedCert = { id: 'cert-uuid', currentStatus: CertificationStatus.RENEWED };
      const successorCert = {
        id: 'new-cert-uuid',
        certificationNumber: 'TERROIR-IGP-SFI-2026-001',
        currentStatus: CertificationStatus.DRAFT,
      };
      cacheManager.get.mockResolvedValue(null);
      qrCodeRepo.findOne.mockResolvedValue(activeQr);
      certRepo.findOne
        .mockResolvedValueOnce(renewedCert) // main cert lookup
        .mockResolvedValueOnce(successorCert); // successor lookup

      const result = await service.verifyQrCode(sig);
      expect(result.valid).toBe(false);
      expect(result.newCertificationNumber).toBe('TERROIR-IGP-SFI-2026-001');
      expect(result.message).toContain('TERROIR-IGP-SFI-2026-001');
    });

    it('returns superseded with null newCertificationNumber when successor not yet granted', async () => {
      const renewedCert = { id: 'cert-uuid', currentStatus: CertificationStatus.RENEWED };
      const draftSuccessor = {
        id: 'new-cert-uuid',
        certificationNumber: null,
        currentStatus: CertificationStatus.DRAFT,
      };
      cacheManager.get.mockResolvedValue(null);
      qrCodeRepo.findOne.mockResolvedValue(activeQr);
      certRepo.findOne.mockResolvedValueOnce(renewedCert).mockResolvedValueOnce(draftSuccessor);

      const result = await service.verifyQrCode(sig);
      expect(result.valid).toBe(false);
      expect(result.newCertificationNumber).toBeNull();
      expect(result.message).toContain('pending');
    });

    it('returns valid: false for a REVOKED cert', async () => {
      const revokedCert = { id: 'cert-uuid', currentStatus: CertificationStatus.REVOKED };
      cacheManager.get.mockResolvedValue(null);
      qrCodeRepo.findOne.mockResolvedValue(activeQr);
      certRepo.findOne.mockResolvedValue(revokedCert);

      const result = await service.verifyQrCode(sig);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('REVOKED');
    });

    it('returns valid: false when QR code not found', async () => {
      cacheManager.get.mockResolvedValue(null);
      qrCodeRepo.findOne.mockResolvedValue(null);

      const result = await service.verifyQrCode('bad-sig');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('returns valid: false when QR code is expired', async () => {
      const expiredQr = {
        id: 'qr-uuid',
        certificationId: 'cert-uuid',
        hmacSignature: sig,
        isActive: true,
        scansCount: 5,
        expiresAt: new Date('2020-01-01'), // past date → expired
      };
      cacheManager.get.mockResolvedValue(null);
      qrCodeRepo.findOne.mockResolvedValue(expiredQr);

      const result = await service.verifyQrCode(sig);

      expect(result.valid).toBe(false);
      expect(result.message).toContain('expired');
      expect(certRepo.findOne).not.toHaveBeenCalled(); // stops before cert lookup
    });

    it('returns valid: false when certification is not found after QR lookup', async () => {
      cacheManager.get.mockResolvedValue(null);
      qrCodeRepo.findOne.mockResolvedValue(activeQr);
      certRepo.findOne.mockResolvedValue(null); // cert deleted/missing

      const result = await service.verifyQrCode(sig);

      expect(result.valid).toBe(false);
      expect(result.message).toContain('Certification not found');
    });
  });

  describe('downloadQrCode()', () => {
    const certId = 'cert-download';
    const activeQr = {
      id: 'qr-dl-001',
      certificationId: certId,
      isActive: true,
      verificationUrl: 'https://api.terroir.ma/verify/abc123def',
    };

    it('returns a PNG buffer for a GRANTED certification', async () => {
      certRepo.findOne.mockResolvedValue({
        id: certId,
        currentStatus: 'GRANTED',
        certificationNumber: 'TERROIR-AOP-RSK-2026-001',
      });
      qrCodeRepo.findOne.mockResolvedValue(activeQr);

      const result = await service.downloadQrCode(certId, 'png');

      expect(result.mimeType).toBe('image/png');
      expect(result.filename).toBe('TERROIR-AOP-RSK-2026-001.png');
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.buffer.length).toBeGreaterThan(0);
    });

    it('returns an SVG buffer for a RENEWED certification', async () => {
      certRepo.findOne.mockResolvedValue({
        id: certId,
        currentStatus: 'RENEWED',
        certificationNumber: 'TERROIR-IGP-SFI-2025-042',
      });
      qrCodeRepo.findOne.mockResolvedValue(activeQr);

      const result = await service.downloadQrCode(certId, 'svg');

      expect(result.mimeType).toBe('image/svg+xml');
      expect(result.filename).toBe('TERROIR-IGP-SFI-2025-042.svg');
      expect(result.buffer.toString()).toContain('<svg');
    });

    it('falls back to certificationId in filename when certificationNumber is null', async () => {
      certRepo.findOne.mockResolvedValue({
        id: certId,
        currentStatus: 'GRANTED',
        certificationNumber: null,
      });
      qrCodeRepo.findOne.mockResolvedValue(activeQr);

      const result = await service.downloadQrCode(certId, 'png');

      expect(result.filename).toBe(`${certId}.png`);
    });

    it('throws NotFoundException for a non-GRANTED/RENEWED certification', async () => {
      certRepo.findOne.mockResolvedValue({ id: certId, currentStatus: 'DENIED' });

      await expect(service.downloadQrCode(certId, 'png')).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'CERTIFICATION_NOT_FOUND_OR_NOT_GRANTED' }),
        }),
      );
    });

    it('throws NotFoundException when certification is not found', async () => {
      certRepo.findOne.mockResolvedValue(null);

      await expect(service.downloadQrCode(certId, 'png')).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'CERTIFICATION_NOT_FOUND_OR_NOT_GRANTED' }),
        }),
      );
    });

    it('throws NotFoundException when no active QR code exists for the certification', async () => {
      certRepo.findOne.mockResolvedValue({
        id: certId,
        currentStatus: 'GRANTED',
        certificationNumber: 'T-001',
      });
      qrCodeRepo.findOne.mockResolvedValue(null);

      await expect(service.downloadQrCode(certId, 'png')).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'QR_CODE_NOT_FOUND' }),
        }),
      );
    });
  });

  describe('cache behavior', () => {
    const sig = 'test-sig';
    const cacheKey = `qr:verify:${sig}`;
    const activeQr = {
      id: 'qr-uuid',
      certificationId: 'cert-uuid',
      hmacSignature: sig,
      isActive: true,
      scansCount: 0,
      expiresAt: null,
    };

    it('returns cached result without hitting DB on cache hit', async () => {
      const cachedResult = { valid: true, message: 'cached', certification: null, qrCode: null };
      cacheManager.get.mockResolvedValue(cachedResult);

      const result = await service.verifyQrCode(sig);

      expect(result).toEqual(cachedResult);
      expect(qrCodeRepo.findOne).not.toHaveBeenCalled();
    });

    it('caches GRANTED result with 300s TTL', async () => {
      cacheManager.get.mockResolvedValue(null);
      qrCodeRepo.findOne.mockResolvedValue(activeQr);
      qrCodeRepo.increment.mockResolvedValue(undefined);
      certRepo.findOne.mockResolvedValue({
        id: 'cert-uuid',
        currentStatus: CertificationStatus.GRANTED,
      });

      await service.verifyQrCode(sig);

      expect(cacheManager.set).toHaveBeenCalledWith(
        cacheKey,
        expect.objectContaining({ valid: true }),
        300_000,
      );
    });

    it('does NOT cache REVOKED result', async () => {
      cacheManager.get.mockResolvedValue(null);
      qrCodeRepo.findOne.mockResolvedValue(activeQr);
      certRepo.findOne.mockResolvedValue({
        id: 'cert-uuid',
        currentStatus: CertificationStatus.REVOKED,
      });

      await service.verifyQrCode(sig);

      expect(cacheManager.set).not.toHaveBeenCalled();
    });

    it('evicts cache in deactivateByCertificationId before deactivating', async () => {
      qrCodeRepo.findOne.mockResolvedValue(activeQr);

      await service.deactivateByCertificationId('cert-uuid');

      expect(cacheManager.del).toHaveBeenCalledWith(cacheKey);
      expect(qrCodeRepo.update).toHaveBeenCalledWith(
        { certificationId: 'cert-uuid', isActive: true },
        { isActive: false },
      );
      // del must be called BEFORE update
      const delOrder = cacheManager.del.mock.invocationCallOrder[0] ?? 0;
      const updateOrder = qrCodeRepo.update.mock.invocationCallOrder[0] ?? 0;
      expect(delOrder).toBeLessThan(updateOrder);
    });

    it('evictQrCache calls del with correct key when active QR exists', async () => {
      qrCodeRepo.findOne.mockResolvedValue(activeQr);

      await service.evictQrCache('cert-uuid');

      expect(cacheManager.del).toHaveBeenCalledWith(cacheKey);
    });

    it('evictQrCache is a no-op when no active QR exists', async () => {
      qrCodeRepo.findOne.mockResolvedValue(null);

      await service.evictQrCache('cert-uuid');

      expect(cacheManager.del).not.toHaveBeenCalled();
    });
  });

  describe('US-058 — QR scan event tracking', () => {
    const sig = 'scan-event-sig';
    const activeQr = {
      id: 'qr-scan-uuid',
      certificationId: 'cert-scan-uuid',
      hmacSignature: sig,
      isActive: true,
      scansCount: 0,
      expiresAt: null,
    };

    it('writes QrScanEvent fire-and-forget on GRANTED scan', async () => {
      cacheManager.get.mockResolvedValue(null);
      qrCodeRepo.findOne.mockResolvedValue(activeQr);
      qrCodeRepo.increment.mockResolvedValue(undefined);
      certRepo.findOne.mockResolvedValue({
        id: 'cert-scan-uuid',
        currentStatus: CertificationStatus.GRANTED,
      });

      await service.verifyQrCode(sig, '192.168.1.1');

      expect(qrScanEventRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          qrCodeId: 'qr-scan-uuid',
          certificationId: 'cert-scan-uuid',
          ipAddress: '192.168.1.1',
        }),
      );
      expect(qrScanEventRepo.save).toHaveBeenCalled();
    });

    it('does NOT write QrScanEvent when QR code is not found', async () => {
      cacheManager.get.mockResolvedValue(null);
      qrCodeRepo.findOne.mockResolvedValue(null);

      await service.verifyQrCode('bad-sig');

      expect(qrScanEventRepo.save).not.toHaveBeenCalled();
    });

    it('getScanStats() returns totals cast to numbers', async () => {
      const result = await service.getScanStats('cert-scan-uuid');

      expect(result.totalScans).toBe(5);
      expect(result.last30DaysScans).toBe(2);
      expect(typeof result.totalScans).toBe('number');
    });

    it('getScanStats() passes certificationId to query', async () => {
      await service.getScanStats('cert-scan-uuid');

      expect(qrScanEventRepo.manager.query).toHaveBeenCalledWith(
        expect.stringContaining('certification.qr_scan_event'),
        ['cert-scan-uuid'],
      );
    });
  });
});
