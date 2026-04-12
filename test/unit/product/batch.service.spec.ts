import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { BatchService } from '../../../src/modules/product/services/batch.service';
import {
  ProductionBatch,
  BatchStatus,
} from '../../../src/modules/product/entities/production-batch.entity';
import { ProductProducer } from '../../../src/modules/product/events/product.producer';

const makeRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  create: jest.fn().mockImplementation((dto) => ({ id: 'batch-uuid', ...dto })),
  update: jest.fn().mockResolvedValue(undefined),
});

const mockProducer = {
  publishBatchCreated: jest.fn().mockResolvedValue(undefined),
};

describe('BatchService', () => {
  let service: BatchService;
  let batchRepo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    jest.clearAllMocks();
    batchRepo = makeRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BatchService,
        { provide: getRepositoryToken(ProductionBatch), useValue: batchRepo },
        { provide: ProductProducer, useValue: mockProducer },
      ],
    }).compile();

    service = module.get<BatchService>(BatchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createBatch()', () => {
    const dto = {
      productTypeCode: 'ARGAN-OIL',
      harvestIds: ['harvest-001'],
      totalQuantityKg: 200,
      processingDate: '2026-04-10',
      processingMethod: 'cold-press',
      storageConditions: 'cool-dry',
    };

    it('creates a batch with a generated batch number', async () => {
      const savedBatch = {
        id: 'batch-001',
        batchNumber: 'BATCH-ARGAN-OIL-2026-XXXX',
        status: 'created',
      };
      batchRepo.save.mockResolvedValue(savedBatch);

      const result = await service.createBatch(dto as never, 'coop-001', 'user-001');

      expect(batchRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          productTypeCode: 'ARGAN-OIL',
          cooperativeId: 'coop-001',
          createdBy: 'user-001',
          status: 'created',
        }),
      );
      expect(batchRepo.save).toHaveBeenCalled();
      expect(mockProducer.publishBatchCreated).toHaveBeenCalledWith(savedBatch, 'user-001');
      expect(result).toEqual(savedBatch);
    });

    it('batch number contains the product type code', async () => {
      batchRepo.save.mockImplementation((batch) => Promise.resolve(batch));

      const result = await service.createBatch(dto as never, 'coop-001', 'user-001');

      expect(result.batchNumber).toContain('ARGAN-OIL');
    });
  });

  describe('findById()', () => {
    it('returns batch when found', async () => {
      const batch = { id: 'batch-001', status: 'created' };
      batchRepo.findOne.mockResolvedValue(batch);

      const result = await service.findById('batch-001');

      expect(result).toEqual(batch);
    });

    it('throws NotFoundException when not found', async () => {
      batchRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByCooperative()', () => {
    it('returns all batches for a cooperative', async () => {
      const batches = [{ id: 'batch-001' }, { id: 'batch-002' }];
      batchRepo.find.mockResolvedValue(batches);

      const result = await service.findByCooperative('coop-001');

      expect(batchRepo.find).toHaveBeenCalledWith({
        where: { cooperativeId: 'coop-001' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('updateStatus()', () => {
    it('updates batch status when transition is valid', async () => {
      const batch = { id: 'batch-001', status: 'created' };
      batchRepo.findOne.mockResolvedValue(batch);

      await service.updateStatus('batch-001', 'lab_submitted' as BatchStatus);

      expect(batchRepo.update).toHaveBeenCalledWith(
        { id: 'batch-001' },
        { status: 'lab_submitted' },
      );
    });

    it('throws BadRequestException when transitioning a certified batch to non-recall status', async () => {
      const batch = { id: 'batch-001', status: 'certified' };
      batchRepo.findOne.mockResolvedValue(batch);

      await expect(service.updateStatus('batch-001', 'created' as BatchStatus)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('allows transitioning certified batch to recalled', async () => {
      const batch = { id: 'batch-001', status: 'certified' };
      batchRepo.findOne.mockResolvedValue(batch);

      await expect(
        service.updateStatus('batch-001', 'recalled' as BatchStatus),
      ).resolves.toBeUndefined();

      expect(batchRepo.update).toHaveBeenCalledWith({ id: 'batch-001' }, { status: 'recalled' });
    });
  });
});
