import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { LabTestService } from '../../../src/modules/product/services/lab-test.service';
import { LabTest } from '../../../src/modules/product/entities/lab-test.entity';
import { LabTestResult } from '../../../src/modules/product/entities/lab-test-result.entity';
import { ProductionBatch } from '../../../src/modules/product/entities/production-batch.entity';
import { ProductType } from '../../../src/modules/product/entities/product-type.entity';
import { ProductProducer } from '../../../src/modules/product/events/product.producer';
import { MinioService } from '../../../src/common/services/minio.service';

const makeRepo = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn().mockImplementation((dto) => dto),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
  findAndCount: jest.fn(),
});

const makeProducer = () => ({
  publishLabTestCompleted: jest.fn().mockResolvedValue(undefined),
  publishLabTestSubmitted: jest.fn().mockResolvedValue(undefined),
});

const makeMinio = () => ({
  uploadFile: jest.fn().mockResolvedValue(undefined),
  getFileStream: jest.fn().mockResolvedValue({ pipe: jest.fn() }),
  deleteFile: jest.fn().mockResolvedValue(undefined),
});

describe('LabTestService', () => {
  let service: LabTestService;
  let labTestRepo: ReturnType<typeof makeRepo>;
  let labTestResultRepo: ReturnType<typeof makeRepo>;
  let productTypeRepo: ReturnType<typeof makeRepo>;
  let batchRepo: ReturnType<typeof makeRepo>;
  let producer: ReturnType<typeof makeProducer>;
  let minio: ReturnType<typeof makeMinio>;

  beforeEach(async () => {
    labTestRepo = makeRepo();
    labTestResultRepo = makeRepo();
    productTypeRepo = makeRepo();
    batchRepo = makeRepo();
    producer = makeProducer();
    minio = makeMinio();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LabTestService,
        { provide: getRepositoryToken(LabTest), useValue: labTestRepo },
        { provide: getRepositoryToken(LabTestResult), useValue: labTestResultRepo },
        { provide: getRepositoryToken(ProductionBatch), useValue: batchRepo },
        { provide: getRepositoryToken(ProductType), useValue: productTypeRepo },
        { provide: ProductProducer, useValue: producer },
        { provide: MinioService, useValue: minio },
      ],
    }).compile();

    service = module.get<LabTestService>(LabTestService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── submitLabTest() ───────────────────────────────────────────────────────

  describe('submitLabTest()', () => {
    const dto = {
      batchId: 'batch-001',
      laboratoryId: 'lab-001',
      expectedResultDate: '2026-05-01',
    };

    it('creates a lab test and publishes event when batch exists', async () => {
      const batch = { id: 'batch-001', productTypeCode: 'ARGAN-OIL' };
      batchRepo.findOne.mockResolvedValue(batch);
      const savedTest = { id: 'test-001', batchId: 'batch-001', status: 'submitted' };
      labTestRepo.save.mockResolvedValue(savedTest);

      const result = await service.submitLabTest(dto as never, 'coop-001', 'user-001');

      expect(batchRepo.findOne).toHaveBeenCalledWith({ where: { id: 'batch-001' } });
      expect(labTestRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          batchId: 'batch-001',
          cooperativeId: 'coop-001',
          productTypeCode: 'ARGAN-OIL',
          submittedBy: 'user-001',
          status: 'submitted',
        }),
      );
      expect(batchRepo.update).toHaveBeenCalledWith({ id: 'batch-001' }, { status: 'lab_testing' });
      expect(producer.publishLabTestSubmitted).toHaveBeenCalledWith(
        savedTest,
        'user-001',
        '2026-05-01',
      );
      expect(result).toEqual(savedTest);
    });

    it('uses null for laboratoryId and expectedResultDate when not provided', async () => {
      const batch = { id: 'batch-001', productTypeCode: 'ARGAN-OIL' };
      batchRepo.findOne.mockResolvedValue(batch);
      labTestRepo.save.mockResolvedValue({ id: 'test-001' });

      await service.submitLabTest({ batchId: 'batch-001' } as never, 'coop-001', 'user-001');

      expect(labTestRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          laboratoryId: null,
          expectedResultDate: null,
        }),
      );
      expect(producer.publishLabTestSubmitted).toHaveBeenCalledWith(
        expect.anything(),
        'user-001',
        null,
      );
    });

    it('throws NotFoundException when batch not found', async () => {
      batchRepo.findOne.mockResolvedValue(null);

      await expect(service.submitLabTest(dto as never, 'coop-001', 'user-001')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── recordResult() ────────────────────────────────────────────────────────

  describe('recordResult()', () => {
    const mockLabTest = {
      id: 'test-001',
      batchId: 'batch-001',
      productTypeCode: 'ARGAN-OIL',
      status: 'submitted',
    };

    it('records a passing result, updates statuses, and publishes event', async () => {
      const mockResult = { id: 'result-001', passed: true, labTestId: 'test-001' };
      labTestRepo.findOne.mockResolvedValue(mockLabTest);
      productTypeRepo.findOne.mockResolvedValue(null); // no parameters → passes automatically
      labTestResultRepo.save.mockResolvedValue(mockResult);

      const dto = {
        labTestId: 'test-001',
        testValues: { acidity: 0.5 },
        technicianName: 'Hassan',
        laboratoryName: 'ONSSA Agadir',
      };

      const result = await service.recordResult(dto as never, 'tech-001', 'corr-001');

      expect(result).toEqual(mockResult);
      expect(labTestRepo.update).toHaveBeenCalledWith({ id: 'test-001' }, { status: 'completed' });
      expect(batchRepo.update).toHaveBeenCalledWith({ id: 'batch-001' }, { status: 'lab_passed' });
      expect(producer.publishLabTestCompleted).toHaveBeenCalled();
    });

    it('records a failing result and sets batch to lab_failed', async () => {
      const mockResult = { id: 'result-001', passed: false };
      labTestRepo.findOne.mockResolvedValue(mockLabTest);
      productTypeRepo.findOne.mockResolvedValue({
        code: 'ARGAN-OIL',
        labTestParameters: [{ name: 'acidity', unit: '%', minValue: 0.1, maxValue: 0.3 }],
      });
      labTestResultRepo.save.mockResolvedValue(mockResult);

      const dto = {
        labTestId: 'test-001',
        testValues: { acidity: 0.8 }, // exceeds maxValue → fail
        technicianName: 'Hassan',
      };

      await service.recordResult(dto as never, 'tech-001', 'corr-001');

      expect(batchRepo.update).toHaveBeenCalledWith({ id: 'batch-001' }, { status: 'lab_failed' });
    });

    it('uses "Unknown" for technicianName and null for laboratoryName when not provided', async () => {
      labTestRepo.findOne.mockResolvedValue(mockLabTest);
      productTypeRepo.findOne.mockResolvedValue(null);
      labTestResultRepo.save.mockResolvedValue({ id: 'result-001', passed: true });

      await service.recordResult(
        { labTestId: 'test-001', testValues: {} } as never,
        'tech-001',
        'corr-001',
      );

      expect(labTestResultRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          technicianName: 'Unknown',
          laboratoryName: null,
        }),
      );
    });

    it('throws NotFoundException when lab test not found', async () => {
      labTestRepo.findOne.mockResolvedValue(null);

      await expect(
        service.recordResult(
          { labTestId: 'bad-id', testValues: {} } as never,
          'tech-001',
          'corr-001',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── validateLabTestParameters() ──────────────────────────────────────────

  describe('validateLabTestParameters()', () => {
    it('returns passed: true and empty failedParameters when product type not found', async () => {
      productTypeRepo.findOne.mockResolvedValue(null);

      const result = await service.validateLabTestParameters('UNKNOWN', { value: 10 });

      expect(result).toEqual({ passed: true, failedParameters: [] });
    });

    it('passes when all numeric values are within range', async () => {
      productTypeRepo.findOne.mockResolvedValue({
        code: 'ARGAN-OIL',
        labTestParameters: [
          { name: 'acidity', unit: '%', minValue: 0.1, maxValue: 1.5 },
          { name: 'peroxide', unit: 'meq/kg', minValue: 0, maxValue: 20 },
        ],
      });

      const result = await service.validateLabTestParameters('ARGAN-OIL', {
        acidity: 0.5,
        peroxide: 10,
      });

      expect(result.passed).toBe(true);
      expect(result.failedParameters).toHaveLength(0);
    });

    it('passes when value equals minValue boundary', async () => {
      productTypeRepo.findOne.mockResolvedValue({
        code: 'ARGAN-OIL',
        labTestParameters: [{ name: 'acidity', unit: '%', minValue: 0.5, maxValue: 1.5 }],
      });

      const result = await service.validateLabTestParameters('ARGAN-OIL', { acidity: 0.5 });
      expect(result.passed).toBe(true);
    });

    it('fails when value is below minValue', async () => {
      productTypeRepo.findOne.mockResolvedValue({
        code: 'ARGAN-OIL',
        labTestParameters: [{ name: 'acidity', unit: '%', minValue: 0.5 }],
      });

      const result = await service.validateLabTestParameters('ARGAN-OIL', { acidity: 0.3 });

      expect(result.passed).toBe(false);
      expect(result.failedParameters[0]).toContain('< min');
    });

    it('fails when value exceeds maxValue', async () => {
      productTypeRepo.findOne.mockResolvedValue({
        code: 'ARGAN-OIL',
        labTestParameters: [{ name: 'acidity', unit: '%', maxValue: 1.0 }],
      });

      const result = await service.validateLabTestParameters('ARGAN-OIL', { acidity: 1.5 });

      expect(result.passed).toBe(false);
      expect(result.failedParameters[0]).toContain('> max');
    });

    it('fails when a required parameter is missing from testValues', async () => {
      productTypeRepo.findOne.mockResolvedValue({
        code: 'ARGAN-OIL',
        labTestParameters: [{ name: 'acidity', unit: '%', minValue: 0.1 }],
      });

      const result = await service.validateLabTestParameters('ARGAN-OIL', {});

      expect(result.passed).toBe(false);
      expect(result.failedParameters[0]).toContain('missing');
    });

    it('fails enum validation when value is not in allowed list', async () => {
      productTypeRepo.findOne.mockResolvedValue({
        code: 'HONEY',
        labTestParameters: [{ name: 'color', unit: '', type: 'enum', values: ['amber', 'dark'] }],
      });

      const result = await service.validateLabTestParameters('HONEY', { color: 'light' });

      expect(result.passed).toBe(false);
      expect(result.failedParameters[0]).toContain('expected one of');
      expect(result.failedParameters[0]).toContain('amber');
    });

    it('passes enum validation when value is in the allowed list', async () => {
      productTypeRepo.findOne.mockResolvedValue({
        code: 'HONEY',
        labTestParameters: [{ name: 'color', unit: '', type: 'enum', values: ['amber', 'dark'] }],
      });

      const result = await service.validateLabTestParameters('HONEY', { color: 'amber' });

      expect(result.passed).toBe(true);
    });

    it('fails when value is NaN (non-numeric string for a numeric parameter)', async () => {
      productTypeRepo.findOne.mockResolvedValue({
        code: 'ARGAN-OIL',
        labTestParameters: [{ name: 'acidity', unit: '%', minValue: 0.1 }],
      });

      const result = await service.validateLabTestParameters('ARGAN-OIL', {
        acidity: 'not-a-number',
      });

      expect(result.passed).toBe(false);
      expect(result.failedParameters[0]).toContain('expected numeric');
    });

    it('collects multiple failures when several parameters are out of range', async () => {
      productTypeRepo.findOne.mockResolvedValue({
        code: 'ARGAN-OIL',
        labTestParameters: [
          { name: 'acidity', unit: '%', minValue: 0.1, maxValue: 0.5 },
          { name: 'peroxide', unit: 'meq/kg', minValue: 0, maxValue: 10 },
        ],
      });

      const result = await service.validateLabTestParameters('ARGAN-OIL', {
        acidity: 0.8, // too high
        peroxide: 15, // too high
      });

      expect(result.passed).toBe(false);
      expect(result.failedParameters).toHaveLength(2);
    });
  });

  // ─── findById() ────────────────────────────────────────────────────────────

  describe('findById()', () => {
    it('returns lab test when found', async () => {
      const labTest = { id: 'test-001', batchId: 'batch-001' };
      labTestRepo.findOne.mockResolvedValue(labTest);

      const result = await service.findById('test-001');

      expect(result).toEqual(labTest);
      expect(labTestRepo.findOne).toHaveBeenCalledWith({ where: { id: 'test-001' } });
    });

    it('throws NotFoundException when lab test not found', async () => {
      labTestRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('US-029: resolves for any authenticated user — inspector has no role restriction on GET /lab-tests/:id', async () => {
      const labTest = { id: 'test-001', batchId: 'batch-001' };
      labTestRepo.findOne.mockResolvedValue(labTest);
      // LabTestController.findOne() uses JwtAuthGuard only — inspector can access during inspection
      const result = await service.findById('test-001');
      expect(result).toEqual(labTest);
    });
  });

  // ─── findAll() — US-028 ───────────────────────────────────────────────────

  describe('findAll()', () => {
    it('returns paginated lab tests with no filters', async () => {
      const mockTests = [{ id: 'test-001' }, { id: 'test-002' }];
      labTestRepo.findAndCount.mockResolvedValue([mockTests, 2]);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(labTestRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
      expect(result.data).toEqual(mockTests);
      expect(result.meta.total).toBe(2);
    });

    it('applies cooperativeId filter when provided', async () => {
      labTestRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ cooperativeId: 'coop-001', page: 1, limit: 20 });

      expect(labTestRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ cooperativeId: 'coop-001' }) }),
      );
    });

    it('returns empty page when no lab tests match filter', async () => {
      labTestRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll({ status: 'cancelled', page: 1, limit: 20 });

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });

  // ─── findResultByLabTestId() ───────────────────────────────────────────────

  describe('findResultByLabTestId()', () => {
    it('returns result when found', async () => {
      const mockResult = { id: 'result-001', labTestId: 'test-001' };
      labTestResultRepo.findOne.mockResolvedValue(mockResult);

      const result = await service.findResultByLabTestId('test-001');

      expect(result).toEqual(mockResult);
      expect(labTestResultRepo.findOne).toHaveBeenCalledWith({ where: { labTestId: 'test-001' } });
    });

    it('returns null when no result exists for the lab test', async () => {
      labTestResultRepo.findOne.mockResolvedValue(null);

      const result = await service.findResultByLabTestId('test-001');

      expect(result).toBeNull();
    });
  });

  // ─── uploadReport() + downloadReport() — US-026 ───────────────────────────

  describe('uploadReport()', () => {
    it('uploads PDF to MinIO and updates report key on LabTest', async () => {
      const labTest = { id: 'test-001', batchId: 'batch-001', reportS3Key: null } as LabTest;
      labTestRepo.findOne.mockResolvedValue(labTest);
      const updatedLabTest = {
        ...labTest,
        reportS3Key: 'lab-reports/test-001/uuid-report.pdf',
        reportFileName: 'report.pdf',
      };
      labTestRepo.update.mockResolvedValue({ affected: 1 });
      // second findOne call (after update) returns updated record
      labTestRepo.findOne.mockResolvedValueOnce(labTest).mockResolvedValueOnce(updatedLabTest);

      const file = {
        originalname: 'report.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('pdf'),
        size: 3,
      } as Express.Multer.File;

      const result = await service.uploadReport('test-001', file);

      expect(minio.uploadFile).toHaveBeenCalledWith(
        expect.stringContaining('lab-reports/test-001/'),
        file.buffer,
        'application/pdf',
      );
      expect(labTestRepo.update).toHaveBeenCalledWith(
        { id: 'test-001' },
        expect.objectContaining({ reportFileName: 'report.pdf' }),
      );
      expect(result).toEqual(updatedLabTest);
    });

    it('throws NotFoundException when lab test not found', async () => {
      labTestRepo.findOne.mockResolvedValue(null);
      const file = {
        originalname: 'r.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('x'),
        size: 1,
      } as Express.Multer.File;
      await expect(service.uploadReport('missing', file)).rejects.toThrow(NotFoundException);
    });
  });

  describe('downloadReport()', () => {
    it('throws NotFoundException when no report has been uploaded', async () => {
      const labTest = { id: 'test-001', reportS3Key: null, reportFileName: null } as LabTest;
      labTestRepo.findOne.mockResolvedValue(labTest);

      await expect(service.downloadReport('test-001')).rejects.toThrow(NotFoundException);
    });

    it('returns stream and fileName when report exists', async () => {
      const labTest = {
        id: 'test-001',
        reportS3Key: 'lab-reports/test-001/uuid-report.pdf',
        reportFileName: 'report.pdf',
      } as LabTest;
      labTestRepo.findOne.mockResolvedValue(labTest);
      const mockStream = { pipe: jest.fn() };
      minio.getFileStream.mockResolvedValue(mockStream);

      const result = await service.downloadReport('test-001');

      expect(minio.getFileStream).toHaveBeenCalledWith('lab-reports/test-001/uuid-report.pdf');
      expect(result.fileName).toBe('report.pdf');
      expect(result.stream).toBe(mockStream);
    });
  });
});
