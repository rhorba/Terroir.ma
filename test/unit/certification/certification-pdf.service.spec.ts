import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { CertificationPdfService } from '../../../src/modules/certification/services/certification-pdf.service';
import {
  Certification,
  CertificationStatus,
} from '../../../src/modules/certification/entities/certification.entity';
import { QrCode } from '../../../src/modules/certification/entities/qr-code.entity';

// ── Mock PDFKit — no filesystem, no real PDF rendering in unit tests ──────────
jest.mock('pdfkit', () => {
  return jest.fn().mockImplementation(() => {
    const { EventEmitter } = require('events');
    const emitter = new EventEmitter();
    const doc = Object.assign(emitter, {
      registerFont: jest.fn().mockReturnThis(),
      font: jest.fn().mockReturnThis(),
      fontSize: jest.fn().mockReturnThis(),
      fillColor: jest.fn().mockReturnThis(),
      text: jest.fn().mockReturnThis(),
      moveDown: jest.fn().mockReturnThis(),
      moveTo: jest.fn().mockReturnThis(),
      lineTo: jest.fn().mockReturnThis(),
      stroke: jest.fn().mockReturnThis(),
      image: jest.fn().mockReturnThis(),
      end: jest.fn().mockImplementation(function (this: typeof emitter) {
        this.emit('data', Buffer.from('pdf-chunk'));
        this.emit('end');
      }),
      y: 100,
    });
    return doc;
  });
});

jest.mock('qrcode', () => ({
  toBuffer: jest.fn().mockResolvedValue(Buffer.from('qr-image')),
}));

const makeRepo = () => ({
  findOne: jest.fn(),
});

const buildCert = (status: CertificationStatus): Certification =>
  ({
    id: 'cert-uuid',
    certificationNumber: 'TERROIR-IGP-SFI-2026-001',
    cooperativeName: 'Coopérative Argane',
    productTypeCode: 'ARGAN-OIL',
    certificationType: 'IGP',
    regionCode: 'SFI',
    currentStatus: status,
    validFrom: '2026-01-01',
    validUntil: '2027-01-01',
    grantedAt: new Date('2026-01-01'),
    cooperativeId: 'coop-uuid',
  }) as unknown as Certification;

const buildQrCode = (): QrCode =>
  ({
    id: 'qr-uuid',
    certificationId: 'cert-uuid',
    verificationUrl: 'https://terroir.ma/verify/abc123',
    isActive: true,
  }) as unknown as QrCode;

describe('CertificationPdfService', () => {
  let service: CertificationPdfService;
  let certRepo: ReturnType<typeof makeRepo>;
  let qrCodeRepo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    certRepo = makeRepo();
    qrCodeRepo = makeRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CertificationPdfService,
        { provide: getRepositoryToken(Certification), useValue: certRepo },
        { provide: getRepositoryToken(QrCode), useValue: qrCodeRepo },
      ],
    }).compile();

    service = module.get<CertificationPdfService>(CertificationPdfService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateCertificatePdf()', () => {
    it('returns a Buffer for a GRANTED certification', async () => {
      certRepo.findOne.mockResolvedValue(buildCert(CertificationStatus.GRANTED));
      qrCodeRepo.findOne.mockResolvedValue(buildQrCode());

      const result = await service.generateCertificatePdf('cert-uuid');

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it('returns a Buffer for a RENEWED certification', async () => {
      certRepo.findOne.mockResolvedValue(buildCert(CertificationStatus.RENEWED));
      qrCodeRepo.findOne.mockResolvedValue(buildQrCode());

      const result = await service.generateCertificatePdf('cert-uuid');

      expect(result).toBeInstanceOf(Buffer);
    });

    it('throws NotFoundException when certification does not exist', async () => {
      certRepo.findOne.mockResolvedValue(null);

      await expect(service.generateCertificatePdf('missing-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when certification status is not GRANTED or RENEWED', async () => {
      certRepo.findOne.mockResolvedValue(buildCert(CertificationStatus.SUBMITTED));

      await expect(service.generateCertificatePdf('cert-uuid')).rejects.toThrow(NotFoundException);
    });

    it('generates PDF without QR image when no active QR code exists', async () => {
      certRepo.findOne.mockResolvedValue(buildCert(CertificationStatus.GRANTED));
      qrCodeRepo.findOne.mockResolvedValue(null);

      const result = await service.generateCertificatePdf('cert-uuid');

      expect(result).toBeInstanceOf(Buffer);
    });

    it('generates PDF without QR image when verificationUrl is empty string', async () => {
      certRepo.findOne.mockResolvedValue(buildCert(CertificationStatus.GRANTED));
      qrCodeRepo.findOne.mockResolvedValue({ ...buildQrCode(), verificationUrl: '' });

      const result = await service.generateCertificatePdf('cert-uuid');

      expect(result).toBeInstanceOf(Buffer);
    });
  });
});
