import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ExportDocumentService } from '../../../src/modules/certification/services/export-document.service';
import { ExportDocument } from '../../../src/modules/certification/entities/export-document.entity';
import {
  Certification,
  CertificationStatus,
} from '../../../src/modules/certification/entities/certification.entity';
import { CertificationProducer } from '../../../src/modules/certification/events/certification.producer';

const makeRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  findAndCount: jest.fn(),
  save: jest.fn(),
  create: jest.fn().mockImplementation((dto) => ({ id: 'doc-uuid', ...dto })),
  update: jest.fn().mockResolvedValue(undefined),
});

const mockProducer = {
  publishExportDocumentRequested: jest.fn().mockResolvedValue(undefined),
};

describe('ExportDocumentService', () => {
  let service: ExportDocumentService;
  let exportDocRepo: ReturnType<typeof makeRepo>;
  let certRepo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    jest.clearAllMocks();
    exportDocRepo = makeRepo();
    certRepo = makeRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportDocumentService,
        { provide: getRepositoryToken(ExportDocument), useValue: exportDocRepo },
        { provide: getRepositoryToken(Certification), useValue: certRepo },
        { provide: CertificationProducer, useValue: mockProducer },
      ],
    }).compile();

    service = module.get<ExportDocumentService>(ExportDocumentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('requestExportDocument()', () => {
    const dto = {
      certificationId: 'cert-001',
      destinationCountry: 'FR',
      hsCode: '0802.12',
      quantityKg: 500,
      consigneeName: 'Importeur SA',
      consigneeCountry: 'FR',
    };

    it('creates export document when certification is GRANTED', async () => {
      const cert = {
        id: 'cert-001',
        cooperativeId: 'coop-001',
        currentStatus: CertificationStatus.GRANTED,
      };
      const savedDoc = { id: 'doc-001', ...dto, status: 'submitted' };
      certRepo.findOne.mockResolvedValue(cert);
      exportDocRepo.save.mockResolvedValue(savedDoc);

      const result = await service.requestExportDocument(dto, 'user-001', 'corr-001');

      expect(certRepo.findOne).toHaveBeenCalledWith({ where: { id: dto.certificationId } });
      expect(exportDocRepo.save).toHaveBeenCalled();
      expect(result).toEqual(savedDoc);
    });

    it('throws NotFoundException when certification not found', async () => {
      certRepo.findOne.mockResolvedValue(null);

      await expect(service.requestExportDocument(dto, 'user-001', 'corr-001')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when certification is not GRANTED', async () => {
      certRepo.findOne.mockResolvedValue({
        id: 'cert-001',
        currentStatus: CertificationStatus.DRAFT,
      });

      await expect(service.requestExportDocument(dto, 'user-001', 'corr-001')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findById()', () => {
    it('returns document when found', async () => {
      const doc = { id: 'doc-001', status: 'submitted' };
      exportDocRepo.findOne.mockResolvedValue(doc);

      const result = await service.findById('doc-001');

      expect(result).toEqual(doc);
    });

    it('throws NotFoundException when not found', async () => {
      exportDocRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByCooperative()', () => {
    it('returns all export documents for a cooperative', async () => {
      const docs = [{ id: 'doc-001' }, { id: 'doc-002' }];
      exportDocRepo.find.mockResolvedValue(docs);

      const result = await service.findByCooperative('coop-001');

      expect(exportDocRepo.find).toHaveBeenCalledWith({
        where: { cooperativeId: 'coop-001' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('updateOnssaReference()', () => {
    it('updates ONSSA reference and returns updated document', async () => {
      const doc = { id: 'doc-001', status: 'approved', onssaReference: 'ONSSA-2026-001' };
      exportDocRepo.findOne.mockResolvedValue(doc);

      const result = await service.updateOnssaReference('doc-001', 'ONSSA-2026-001');

      expect(exportDocRepo.update).toHaveBeenCalledWith(
        { id: 'doc-001' },
        { onssaReference: 'ONSSA-2026-001', status: 'approved' },
      );
      expect(result).toEqual(doc);
    });
  });

  describe('validateDocument()', () => {
    it('approves export document and sets validUntil 6 months from now', async () => {
      const doc = { id: 'doc-001', status: 'approved', validUntil: '2026-10-10' };
      exportDocRepo.findOne
        .mockResolvedValueOnce(doc) // first findById inside validateDocument
        .mockResolvedValueOnce(doc); // second findById at return

      const result = await service.validateDocument('doc-001', 'customs-agent-001');

      expect(exportDocRepo.update).toHaveBeenCalledWith(
        { id: 'doc-001' },
        expect.objectContaining({ status: 'approved', validUntil: expect.any(String) }),
      );
      expect(result).toEqual(doc);
    });
  });

  describe('findByCooperativePaginated()', () => {
    it('returns paginated export documents for a cooperative', async () => {
      const mockData = [{ id: 'doc-001', cooperativeId: 'coop-002' }];
      exportDocRepo.findAndCount.mockResolvedValue([mockData, 3]);

      const result = await service.findByCooperativePaginated('coop-002', 1, 20);

      expect(exportDocRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { cooperativeId: 'coop-002' },
          order: { createdAt: 'DESC' },
          skip: 0,
          take: 20,
        }),
      );
      expect(result.data).toEqual(mockData);
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 3 });
    });

    it('calculates skip correctly for page 3', async () => {
      exportDocRepo.findAndCount.mockResolvedValue([[], 30]);

      const result = await service.findByCooperativePaginated('coop-002', 3, 10);

      expect(exportDocRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
      expect(result.meta).toEqual({ page: 3, limit: 10, total: 30 });
    });
  });

  describe('generateDocument()', () => {
    it('delegates to requestExportDocument', async () => {
      const dto = {
        certificationId: 'cert-001',
        destinationCountry: 'DE',
        hsCode: '0802.12',
        quantityKg: 100,
        consigneeName: 'German Importer GmbH',
        consigneeCountry: 'DE',
      };
      const cert = {
        id: 'cert-001',
        cooperativeId: 'coop-001',
        currentStatus: CertificationStatus.GRANTED,
      };
      const savedDoc = { id: 'doc-001' };
      certRepo.findOne.mockResolvedValue(cert);
      exportDocRepo.save.mockResolvedValue(savedDoc);

      const result = await service.generateDocument(dto, 'user-001');

      expect(exportDocRepo.save).toHaveBeenCalled();
      expect(result).toEqual(savedDoc);
    });
  });

  // ─── findAll() ────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('returns paginated export documents across all cooperatives', async () => {
      const docs = [{ id: 'doc-001' }, { id: 'doc-002' }];
      exportDocRepo.findAndCount.mockResolvedValue([docs, 2]);

      const result = await service.findAll(1, 20);

      expect(exportDocRepo.findAndCount).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 20,
      });
      expect(result).toEqual({ data: docs, meta: { page: 1, limit: 20, total: 2 } });
    });

    it('returns empty result when no export documents exist', async () => {
      exportDocRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll(1, 20);

      expect(result).toEqual({ data: [], meta: { page: 1, limit: 20, total: 0 } });
    });
  });
});
