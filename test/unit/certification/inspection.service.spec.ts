import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InspectionService } from '../../../src/modules/certification/services/inspection.service';
import { Inspection } from '../../../src/modules/certification/entities/inspection.entity';
import { InspectionReport } from '../../../src/modules/certification/entities/inspection-report.entity';
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
  create: jest.fn().mockImplementation((dto) => ({ id: 'new-uuid', ...dto })),
  update: jest.fn().mockResolvedValue(undefined),
});

const mockProducer = {
  publishInspectionScheduled: jest.fn().mockResolvedValue(undefined),
  publishInspectorAssigned: jest.fn().mockResolvedValue(undefined),
};

describe('InspectionService', () => {
  let service: InspectionService;
  let inspectionRepo: ReturnType<typeof makeRepo>;
  let reportRepo: ReturnType<typeof makeRepo>;
  let certRepo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    jest.clearAllMocks();
    inspectionRepo = makeRepo();
    reportRepo = makeRepo();
    certRepo = makeRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InspectionService,
        { provide: getRepositoryToken(Inspection), useValue: inspectionRepo },
        { provide: getRepositoryToken(InspectionReport), useValue: reportRepo },
        { provide: getRepositoryToken(Certification), useValue: certRepo },
        { provide: CertificationProducer, useValue: mockProducer },
      ],
    }).compile();

    service = module.get<InspectionService>(InspectionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('scheduleInspection()', () => {
    const dto = {
      certificationId: 'cert-001',
      inspectorId: 'inspector-001',
      inspectorName: 'Hassan Benali',
      scheduledDate: '2026-05-01',
      farmIds: ['farm-001'],
    };

    it('creates and returns an inspection when cert exists', async () => {
      const cert = { id: 'cert-001', cooperativeId: 'coop-001' };
      const savedInspection = { id: 'insp-001', ...dto, status: 'scheduled' };
      certRepo.findOne.mockResolvedValue(cert);
      inspectionRepo.save.mockResolvedValue(savedInspection);

      const result = await service.scheduleInspection(dto, 'actor-001', 'corr-001');

      expect(certRepo.findOne).toHaveBeenCalledWith({ where: { id: dto.certificationId } });
      expect(inspectionRepo.save).toHaveBeenCalled();
      expect(certRepo.update).toHaveBeenCalledWith(
        { id: dto.certificationId },
        { currentStatus: CertificationStatus.INSPECTION_SCHEDULED },
      );
      expect(mockProducer.publishInspectionScheduled).toHaveBeenCalled();
      expect(result).toEqual(savedInspection);
    });

    it('throws NotFoundException when certification does not exist', async () => {
      certRepo.findOne.mockResolvedValue(null);

      await expect(service.scheduleInspection(dto, 'actor-001', 'corr-001')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('completeInspection()', () => {
    const dto = {
      passed: true,
      summary: 'All checks passed',
      farmFindings: [],
      nonConformities: [],
    };

    it('completes inspection and creates a report', async () => {
      const scheduledInspection = {
        id: 'insp-001',
        certificationId: 'cert-001',
        cooperativeId: 'coop-001',
        status: 'scheduled',
      };
      const savedReport = { id: 'report-001', ...dto };
      inspectionRepo.findOne.mockResolvedValue(scheduledInspection);
      reportRepo.save.mockResolvedValue(savedReport);

      const result = await service.completeInspection('insp-001', dto, 'inspector-001', 'corr-001');

      expect(inspectionRepo.update).toHaveBeenCalled();
      expect(reportRepo.save).toHaveBeenCalled();
      expect(certRepo.update).toHaveBeenCalledWith(
        { id: scheduledInspection.certificationId },
        { currentStatus: CertificationStatus.INSPECTION_COMPLETE },
      );
      expect(result).toEqual(savedReport);
    });

    it('throws NotFoundException when inspection does not exist', async () => {
      inspectionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.completeInspection('bad-id', dto, 'inspector-001', 'corr-001'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when inspection is already completed', async () => {
      inspectionRepo.findOne.mockResolvedValue({ id: 'insp-001', status: 'completed' });

      await expect(
        service.completeInspection('insp-001', dto, 'inspector-001', 'corr-001'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findById()', () => {
    it('returns inspection when found', async () => {
      const inspection = { id: 'insp-001', status: 'scheduled' };
      inspectionRepo.findOne.mockResolvedValue(inspection);

      const result = await service.findById('insp-001');

      expect(result).toEqual(inspection);
    });

    it('throws NotFoundException when not found', async () => {
      inspectionRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByCertification()', () => {
    it('returns all inspections for a certification', async () => {
      const inspections = [{ id: 'insp-001' }, { id: 'insp-002' }];
      inspectionRepo.find.mockResolvedValue(inspections);

      const result = await service.findByCertification('cert-001');

      expect(inspectionRepo.find).toHaveBeenCalledWith({
        where: { certificationId: 'cert-001' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('findByInspectorId()', () => {
    it('returns paginated inspections for an inspector', async () => {
      const mockData = [{ id: 'insp-001', inspectorId: 'user-sub-123' }];
      inspectionRepo.findAndCount.mockResolvedValue([mockData, 1]);

      const result = await service.findByInspectorId('user-sub-123', 1, 20);

      expect(inspectionRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { inspectorId: 'user-sub-123' },
          order: { createdAt: 'DESC' },
          skip: 0,
          take: 20,
        }),
      );
      expect(result.data).toEqual(mockData);
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1 });
    });

    it('returns empty data when inspector has no inspections', async () => {
      inspectionRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findByInspectorId('inspector-no-work', 1, 20);

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });

  describe('assignInspector() — US-044', () => {
    const scheduledInspection = {
      id: 'insp-001',
      certificationId: 'cert-001',
      cooperativeId: 'coop-001',
      inspectorId: 'old-inspector',
      inspectorName: 'Old Name',
      scheduledDate: '2026-05-01',
      status: 'scheduled',
    };

    it('should update inspectorId/Name and publish Kafka event', async () => {
      const updated = {
        ...scheduledInspection,
        inspectorId: 'new-inspector',
        inspectorName: 'New Name',
      };
      inspectionRepo.findOne
        .mockResolvedValueOnce(scheduledInspection) // guard check
        .mockResolvedValueOnce(updated); // findById after update
      inspectionRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.assignInspector(
        'insp-001',
        'new-inspector',
        'New Name',
        'admin-uuid',
        'corr-id',
      );

      expect(inspectionRepo.update).toHaveBeenCalledWith(
        { id: 'insp-001' },
        { inspectorId: 'new-inspector', inspectorName: 'New Name' },
      );
      expect(mockProducer.publishInspectorAssigned).toHaveBeenCalledWith(
        updated,
        'admin-uuid',
        'corr-id',
      );
      expect(result.inspectorId).toBe('new-inspector');
    });

    it('should throw ConflictException for completed inspection', async () => {
      inspectionRepo.findOne.mockResolvedValue({ ...scheduledInspection, status: 'completed' });

      await expect(
        service.assignInspector('insp-001', 'new', 'New', 'admin', 'corr'),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException for cancelled inspection', async () => {
      inspectionRepo.findOne.mockResolvedValue({ ...scheduledInspection, status: 'cancelled' });

      await expect(
        service.assignInspector('insp-001', 'new', 'New', 'admin', 'corr'),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException for unknown inspection id', async () => {
      inspectionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.assignInspector('bad-id', 'new', 'New', 'admin', 'corr'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('fileReport()', () => {
    it('delegates to completeInspection and returns inspection', async () => {
      const inspection = {
        id: 'insp-001',
        status: 'scheduled',
        certificationId: 'cert-001',
        cooperativeId: 'coop-001',
      };
      const report = { id: 'report-001', passed: true };
      const dto = { passed: true, reportSummary: 'Good', nonConformities: null };

      inspectionRepo.findOne
        .mockResolvedValueOnce(inspection) // completeInspection lookup
        .mockResolvedValueOnce(inspection); // findById at end
      reportRepo.save.mockResolvedValue(report);

      const result = await service.fileReport(
        'insp-001',
        dto as never,
        'inspector-001',
        'corr-001',
      );

      expect(result).toEqual(inspection);
    });
  });
});
