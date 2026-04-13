import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ExportDocumentPdfService } from '../../../src/modules/certification/services/export-document-pdf.service';
import { ExportDocument } from '../../../src/modules/certification/entities/export-document.entity';
import { Certification } from '../../../src/modules/certification/entities/certification.entity';

// Mock PDFKit — mirrors CertificationPdfService test pattern
jest.mock('pdfkit', () => {
  const { EventEmitter } = require('events');
  return jest.fn().mockImplementation(() => {
    const emitter = new EventEmitter();
    emitter.font = jest.fn().mockReturnThis();
    emitter.fontSize = jest.fn().mockReturnThis();
    emitter.fillColor = jest.fn().mockReturnThis();
    emitter.text = jest.fn().mockReturnThis();
    emitter.moveDown = jest.fn().mockReturnThis();
    emitter.moveTo = jest.fn().mockReturnThis();
    emitter.lineTo = jest.fn().mockReturnThis();
    emitter.stroke = jest.fn().mockReturnThis();
    emitter.registerFont = jest.fn().mockReturnThis();
    emitter.image = jest.fn().mockReturnThis();
    emitter.end = jest.fn().mockImplementation(function (this: typeof emitter) {
      this.emit('data', Buffer.from('export-pdf'));
      this.emit('end');
    });
    return emitter;
  });
});

const makeRepo = () => ({ findOne: jest.fn() });

const mockExportDoc: Partial<ExportDocument> = {
  id: 'doc-1',
  certificationId: 'cert-1',
  cooperativeId: 'coop-1',
  destinationCountry: 'FR',
  hsCode: '1515.30',
  quantityKg: 500,
  consigneeName: 'Paris Imports',
  consigneeCountry: 'FR',
  status: 'approved',
  onssaReference: 'ONSSA-2025-001',
  validUntil: '2025-12-31',
};

const mockCert: Partial<Certification> = {
  id: 'cert-1',
  certificationNumber: 'TERROIR-IGP-SOUSS-2025-000001',
  cooperativeName: 'Coopérative Argane du Souss',
  productTypeCode: 'ARGAN-OIL',
  certificationType: 'IGP',
  regionCode: 'SOUSS_MASSA',
};

describe('ExportDocumentPdfService', () => {
  let service: ExportDocumentPdfService;
  let exportDocRepo: ReturnType<typeof makeRepo>;
  let certRepo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    exportDocRepo = makeRepo();
    certRepo = makeRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportDocumentPdfService,
        { provide: getRepositoryToken(ExportDocument), useValue: exportDocRepo },
        { provide: getRepositoryToken(Certification), useValue: certRepo },
      ],
    }).compile();

    service = module.get<ExportDocumentPdfService>(ExportDocumentPdfService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('generateExportCertificatePdf() — returns a Buffer for an existing export document', async () => {
    exportDocRepo.findOne.mockResolvedValue(mockExportDoc);
    certRepo.findOne.mockResolvedValue(mockCert);

    const result = await service.generateExportCertificatePdf('doc-1');

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('generateExportCertificatePdf() — throws NotFoundException when export document not found', async () => {
    exportDocRepo.findOne.mockResolvedValue(null);

    await expect(service.generateExportCertificatePdf('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('generateExportCertificatePdf() — handles null certification gracefully', async () => {
    exportDocRepo.findOne.mockResolvedValue(mockExportDoc);
    certRepo.findOne.mockResolvedValue(null); // cert lookup returns null

    const result = await service.generateExportCertificatePdf('doc-1');

    // Should still produce a Buffer (cert fields are simply omitted from PDF)
    expect(Buffer.isBuffer(result)).toBe(true);
  });
});
