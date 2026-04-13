import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from '../../../src/common/controllers/admin.controller';
import { KafkaAdminService } from '../../../src/common/services/kafka-admin.service';
import { DashboardService } from '../../../src/common/services/dashboard.service';
import { AuditLogService } from '../../../src/common/services/audit-log.service';

const makeKafkaAdminService = () => ({ getDlqStats: jest.fn() });
const makeDashboardService = () => ({ getDashboard: jest.fn() });
const makeAuditLogService = () => ({ findAll: jest.fn() });

describe('AdminController', () => {
  let controller: AdminController;
  let kafkaAdminService: ReturnType<typeof makeKafkaAdminService>;
  let dashboardService: ReturnType<typeof makeDashboardService>;
  let auditLogService: ReturnType<typeof makeAuditLogService>;

  beforeEach(async () => {
    kafkaAdminService = makeKafkaAdminService();
    dashboardService = makeDashboardService();
    auditLogService = makeAuditLogService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: KafkaAdminService, useValue: kafkaAdminService },
        { provide: DashboardService, useValue: dashboardService },
        { provide: AuditLogService, useValue: auditLogService },
      ],
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

  describe('getDashboard()', () => {
    it('US-081: returns success:true with dashboard metrics', async () => {
      const mockMetrics = {
        cooperatives: { total: 5, verified: 4, pending: 1, suspended: 0 },
        products: { total: 10 },
        certifications: { total: 3, granted: 2, pending: 1, denied: 0, revoked: 0 },
        labTests: { total: 8, passed: 7, failed: 1 },
        notifications: { total: 20, sent: 18, failed: 2 },
        generatedAt: '2026-04-13T00:00:00.000Z',
      };
      dashboardService.getDashboard.mockResolvedValue(mockMetrics);

      const result = await controller.getDashboard();

      expect(result).toEqual({ success: true, data: mockMetrics });
      expect(dashboardService.getDashboard).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAuditLogs()', () => {
    it('US-085: returns success:true with paginated audit logs', async () => {
      auditLogService.findAll.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });

      const result = await controller.getAuditLogs({ page: 1, limit: 20 });

      expect(result).toEqual({ success: true, data: [], meta: { page: 1, limit: 20, total: 0 } });
    });
  });
});
