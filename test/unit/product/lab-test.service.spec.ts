import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LabTestService } from '../../../src/modules/product/services/lab-test.service';
import { LabTest } from '../../../src/modules/product/entities/lab-test.entity';
import { LabTestResult } from '../../../src/modules/product/entities/lab-test-result.entity';
import { ProductionBatch } from '../../../src/modules/product/entities/production-batch.entity';
import { ProductProducer } from '../../../src/modules/product/events/product.producer';

const mockRepo = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn().mockImplementation((dto) => dto),
  update: jest.fn(),
});

const mockProducer = () => ({
  emitLabTestCompleted: jest.fn(),
  emitLabTestSubmitted: jest.fn(),
});

describe('LabTestService', () => {
  let service: LabTestService;
  let labTestRepo: ReturnType<typeof mockRepo>;
  let producer: ReturnType<typeof mockProducer>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LabTestService,
        { provide: getRepositoryToken(LabTest), useFactory: mockRepo },
        { provide: getRepositoryToken(LabTestResult), useFactory: mockRepo },
        { provide: getRepositoryToken(ProductionBatch), useFactory: mockRepo },
        { provide: ProductProducer, useFactory: mockProducer },
      ],
    }).compile();

    service = module.get<LabTestService>(LabTestService);
    labTestRepo = module.get(getRepositoryToken(LabTest));
    producer = module.get<ProductProducer>(ProductProducer);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('submitResult()', () => {
    it('should emit lab.test.completed event after saving results', async () => {
      const mockBatch = { id: 'batch-uuid', cooperativeId: 'coop-uuid', productTypeCode: 'ARGAN_OIL' };
      const mockLabTest = { id: 'test-uuid', batchId: 'batch-uuid', status: 'pending' };

      labTestRepo.findOne
        .mockResolvedValueOnce(mockLabTest)  // find the lab test
        .mockResolvedValueOnce(mockBatch);   // find the batch
      labTestRepo.save.mockResolvedValue({ ...mockLabTest, status: 'completed', passed: true });

      const dto = {
        passed: true,
        testValues: { acidity: 0.5, peroxide_value: 10 },
        completedAt: new Date().toISOString(),
        labName: 'ONSSA Agadir',
      };

      await service.submitResult('test-uuid', dto, 'technician-uuid');

      expect(producer.emitLabTestCompleted).toHaveBeenCalledWith(
        expect.objectContaining({ passed: true, batchId: 'batch-uuid' }),
      );
    });
  });
});
