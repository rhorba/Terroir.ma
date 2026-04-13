import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ProcessingStepService } from '../../../src/modules/product/services/processing-step.service';
import {
  ProcessingStep,
  ProcessingStepType,
} from '../../../src/modules/product/entities/processing-step.entity';
import { ProductionBatch } from '../../../src/modules/product/entities/production-batch.entity';
import { ProductProducer } from '../../../src/modules/product/events/product.producer';

const makeStepRepo = () => ({
  create: jest.fn().mockImplementation((dto) => ({ id: 'step-uuid', ...dto })),
  save: jest.fn(),
  find: jest.fn(),
});

const makeBatchRepo = () => ({
  findOne: jest.fn(),
});

const makeProducer = () => ({
  publishProcessingStepAdded: jest.fn().mockResolvedValue(undefined),
});

const mockBatch = { id: 'batch-001', cooperativeId: 'coop-001' } as ProductionBatch;

const mockDto = {
  stepType: ProcessingStepType.SORTING,
  doneAt: '2026-04-10T08:00:00Z',
  notes: 'Sorted by size',
};

describe('ProcessingStepService', () => {
  let service: ProcessingStepService;
  let stepRepo: ReturnType<typeof makeStepRepo>;
  let batchRepo: ReturnType<typeof makeBatchRepo>;
  let producer: ReturnType<typeof makeProducer>;

  beforeEach(async () => {
    stepRepo = makeStepRepo();
    batchRepo = makeBatchRepo();
    producer = makeProducer();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessingStepService,
        { provide: getRepositoryToken(ProcessingStep), useValue: stepRepo },
        { provide: getRepositoryToken(ProductionBatch), useValue: batchRepo },
        { provide: ProductProducer, useValue: producer },
      ],
    }).compile();

    service = module.get<ProcessingStepService>(ProcessingStepService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addStep()', () => {
    it('creates and returns a processing step when batch exists', async () => {
      batchRepo.findOne.mockResolvedValue(mockBatch);
      const savedStep = {
        id: 'step-uuid',
        batchId: 'batch-001',
        stepType: ProcessingStepType.SORTING,
        doneAt: new Date(mockDto.doneAt),
        doneBy: 'user-001',
        notes: 'Sorted by size',
        cooperativeId: 'coop-001',
        createdAt: new Date(),
      } as ProcessingStep;
      stepRepo.save.mockResolvedValue(savedStep);

      const result = await service.addStep(
        'batch-001',
        mockDto,
        'coop-001',
        'user-001',
        'corr-001',
      );

      expect(batchRepo.findOne).toHaveBeenCalledWith({ where: { id: 'batch-001' } });
      expect(stepRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          batchId: 'batch-001',
          cooperativeId: 'coop-001',
          stepType: ProcessingStepType.SORTING,
          doneBy: 'user-001',
          notes: 'Sorted by size',
        }),
      );
      expect(producer.publishProcessingStepAdded).toHaveBeenCalledWith(savedStep, 'corr-001');
      expect(result).toEqual(savedStep);
    });

    it('defaults notes to null when not provided in dto', async () => {
      batchRepo.findOne.mockResolvedValue(mockBatch);
      stepRepo.save.mockResolvedValue({ id: 'step-uuid' } as ProcessingStep);

      await service.addStep(
        'batch-001',
        { stepType: ProcessingStepType.WASHING, doneAt: '2026-04-10T08:00:00Z' },
        'coop-001',
        'user-001',
        'corr-001',
      );

      expect(stepRepo.create).toHaveBeenCalledWith(expect.objectContaining({ notes: null }));
    });

    it('throws NotFoundException when batch does not exist', async () => {
      batchRepo.findOne.mockResolvedValue(null);

      await expect(
        service.addStep('bad-batch', mockDto, 'coop-001', 'user-001', 'corr-001'),
      ).rejects.toThrow(NotFoundException);
      expect(producer.publishProcessingStepAdded).not.toHaveBeenCalled();
    });
  });

  describe('findByBatch()', () => {
    it('returns processing steps ordered by doneAt ascending', async () => {
      const steps = [
        { id: 'step-1', stepType: ProcessingStepType.SORTING } as ProcessingStep,
        { id: 'step-2', stepType: ProcessingStepType.WASHING } as ProcessingStep,
      ];
      stepRepo.find.mockResolvedValue(steps);

      const result = await service.findByBatch('batch-001');

      expect(stepRepo.find).toHaveBeenCalledWith({
        where: { batchId: 'batch-001' },
        order: { doneAt: 'ASC' },
      });
      expect(result).toEqual(steps);
    });

    it('returns empty array when no steps recorded for batch', async () => {
      stepRepo.find.mockResolvedValue([]);

      const result = await service.findByBatch('batch-001');

      expect(result).toEqual([]);
    });
  });
});
