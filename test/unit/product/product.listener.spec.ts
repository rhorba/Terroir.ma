import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProductListener } from '../../../src/modules/product/listeners/product.listener';
import { ProductionBatch } from '../../../src/modules/product/entities/production-batch.entity';
import { LabTest } from '../../../src/modules/product/entities/lab-test.entity';
import { LabTestResult } from '../../../src/modules/product/entities/lab-test-result.entity';
import { KafkaConsumerService } from '../../../src/common/kafka/kafka-consumer.service';

const makeRepo = () => ({
  update: jest.fn().mockResolvedValue(undefined),
  save: jest.fn().mockResolvedValue({ id: 'result-001' }),
  create: jest.fn().mockImplementation((dto) => ({ id: 'new-uuid', ...dto })),
});

const mockKafkaConsumerService = { subscribe: jest.fn() };

const makeLabTestEvent = (overrides: Record<string, unknown> = {}) => ({
  eventId: 'evt-001',
  correlationId: 'corr-001',
  timestamp: new Date().toISOString(),
  version: 1,
  source: 'product',
  labTestId: 'lab-001',
  batchId: 'batch-001',
  batchReference: 'BATCH-REF-001',
  cooperativeId: 'coop-001',
  productTypeCode: 'ARGAN-OIL',
  productName: "Huile d'argan",
  passed: true,
  // testValues arrives as a JSON string from Avro wire (producer JSON.stringifies it)
  testValues: JSON.stringify({ acidity: 0.5 }),
  failedParameters: [],
  completedAt: new Date().toISOString(),
  technician: 'tech-001',
  labName: 'Laboratoire Maroc',
  ...overrides,
});

describe('ProductListener', () => {
  let listener: ProductListener;
  let batchRepo: ReturnType<typeof makeRepo>;
  let labTestRepo: ReturnType<typeof makeRepo>;
  let labTestResultRepo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    jest.clearAllMocks();
    batchRepo = makeRepo();
    labTestRepo = makeRepo();
    labTestResultRepo = makeRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductListener,
        { provide: getRepositoryToken(ProductionBatch), useValue: batchRepo },
        { provide: getRepositoryToken(LabTest), useValue: labTestRepo },
        { provide: getRepositoryToken(LabTestResult), useValue: labTestResultRepo },
        { provide: KafkaConsumerService, useValue: mockKafkaConsumerService },
      ],
    }).compile();

    listener = module.get<ProductListener>(ProductListener);
  });

  it('should be defined', () => {
    expect(listener).toBeDefined();
  });

  describe('onModuleInit()', () => {
    it('registers lab.test.completed handler', () => {
      listener.onModuleInit();
      expect(mockKafkaConsumerService.subscribe).toHaveBeenCalledWith(
        'lab.test.completed',
        expect.any(Function),
      );
    });
  });

  describe('handleLabTestCompleted()', () => {
    it('updates lab test status, saves result, and updates batch status on pass', async () => {
      const event = makeLabTestEvent() as never;

      await listener.handleLabTestCompleted(event);

      expect(labTestRepo.update).toHaveBeenCalledWith({ id: 'lab-001' }, { status: 'completed' });
      expect(labTestResultRepo.save).toHaveBeenCalled();
      expect(batchRepo.update).toHaveBeenCalledWith({ id: 'batch-001' }, { status: 'lab_passed' });
    });

    it('sets batch status to lab_failed when test does not pass', async () => {
      const event = makeLabTestEvent({ passed: false }) as never;

      await listener.handleLabTestCompleted(event);

      expect(batchRepo.update).toHaveBeenCalledWith({ id: 'batch-001' }, { status: 'lab_failed' });
    });

    it('JSON.parses testValues string from Avro wire format before persisting', async () => {
      const event = makeLabTestEvent({ testValues: JSON.stringify({ acidity: 0.5 }) }) as never;

      await listener.handleLabTestCompleted(event);

      expect(labTestResultRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ testValues: { acidity: 0.5 } }),
      );
    });

    it('swallows errors without rethrowing', async () => {
      const event = makeLabTestEvent() as never;
      labTestRepo.update.mockRejectedValue(new Error('DB error'));

      await expect(listener.handleLabTestCompleted(event)).resolves.toBeUndefined();
    });
  });
});
