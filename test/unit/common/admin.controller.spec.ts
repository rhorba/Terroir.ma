import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from '../../../src/common/controllers/admin.controller';
import { KafkaAdminService } from '../../../src/common/services/kafka-admin.service';

const makeKafkaAdminService = () => ({
  getDlqStats: jest.fn(),
});

describe('AdminController', () => {
  let controller: AdminController;
  let kafkaAdminService: ReturnType<typeof makeKafkaAdminService>;

  beforeEach(async () => {
    kafkaAdminService = makeKafkaAdminService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [{ provide: KafkaAdminService, useValue: kafkaAdminService }],
    }).compile();

    controller = module.get<AdminController>(AdminController);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getDlqStats()', () => {
    it('US-087: returns success:true with DLQ topic stats from KafkaAdminService', async () => {
      const mockStats = [
        { topic: 'certification.decision.granted.dlq', totalMessages: 3 },
        { topic: 'notification.email.send.dlq', totalMessages: 0 },
      ];
      kafkaAdminService.getDlqStats.mockResolvedValue(mockStats);

      const result = await controller.getDlqStats();

      expect(result).toEqual({ success: true, data: mockStats });
      expect(kafkaAdminService.getDlqStats).toHaveBeenCalledTimes(1);
    });

    it('returns success:true with empty array when Redpanda Admin API is unreachable', async () => {
      kafkaAdminService.getDlqStats.mockResolvedValue([]);

      const result = await controller.getDlqStats();

      expect(result).toEqual({ success: true, data: [] });
    });
  });
});
