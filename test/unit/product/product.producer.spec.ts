import { Test, TestingModule } from '@nestjs/testing';
import { ProductProducer } from '../../../src/modules/product/events/product.producer';
import { KafkaProducerService } from '../../../src/common/kafka/kafka-producer.service';

const mockKafkaProducer = { send: jest.fn().mockResolvedValue(undefined) };

describe('ProductProducer', () => {
  let producer: ProductProducer;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductProducer, { provide: KafkaProducerService, useValue: mockKafkaProducer }],
    }).compile();
    producer = module.get<ProductProducer>(ProductProducer);
  });

  it('publishHarvestLogged() sends to product.harvest.logged', async () => {
    const harvest = {
      id: 'h-001',
      farmId: 'farm-001',
      cooperativeId: 'c-001',
      productTypeCode: 'ARGAN-OIL',
      quantityKg: 250.5,
      harvestDate: '2026-04-01',
      campaignYear: '2025-2026',
      method: 'manual',
    } as never;

    await producer.publishHarvestLogged(harvest, 'corr-001');

    expect(mockKafkaProducer.send).toHaveBeenCalledWith(
      'product.harvest.logged',
      expect.objectContaining({ harvestId: 'h-001', productTypeCode: 'ARGAN-OIL' }),
    );
  });

  it('publishHarvestLogged() swallows errors without rethrowing', async () => {
    mockKafkaProducer.send.mockRejectedValueOnce(new Error('broker down'));
    await expect(
      producer.publishHarvestLogged({ id: 'h-001' } as never, 'corr-001'),
    ).resolves.toBeUndefined();
  });

  it('publishBatchCreated() sends to product.batch.created', async () => {
    const batch = {
      id: 'b-001',
      batchNumber: 'BATCH-001',
      cooperativeId: 'c-001',
      productTypeCode: 'ARGAN-OIL',
      harvestIds: ['h-001', 'h-002'],
      totalQuantityKg: 500,
      processingDate: '2026-04-10',
    } as never;

    await producer.publishBatchCreated(batch, 'corr-001');

    expect(mockKafkaProducer.send).toHaveBeenCalledWith(
      'product.batch.created',
      expect.objectContaining({ batchId: 'b-001', batchNumber: 'BATCH-001' }),
    );
  });

  it('publishLabTestCompleted() sends to lab.test.completed with JSON-stringified testValues', async () => {
    const labTest = {
      id: 'lt-001',
      batchId: 'b-001',
      cooperativeId: 'c-001',
      productTypeCode: 'ARGAN-OIL',
      laboratoryId: 'lab-001',
    } as never;
    const result = {
      passed: true,
      testValues: { acidity: 0.5, peroxideValue: 5 },
      failedParameters: [],
      completedAt: new Date(),
      technicianName: 'Dr. Amina',
    } as never;

    await producer.publishLabTestCompleted(labTest, result, 'corr-001');

    expect(mockKafkaProducer.send).toHaveBeenCalledWith(
      'lab.test.completed',
      expect.objectContaining({
        labTestId: 'lt-001',
        passed: true,
        testValues: JSON.stringify({ acidity: 0.5, peroxideValue: 5 }),
      }),
    );
  });
});
