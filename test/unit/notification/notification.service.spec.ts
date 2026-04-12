import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { NotificationService } from '../../../src/modules/notification/services/notification.service';
import { Notification } from '../../../src/modules/notification/entities/notification.entity';
import { NotificationTemplate } from '../../../src/modules/notification/entities/notification-template.entity';
import { EmailService } from '../../../src/modules/notification/services/email.service';
import { SmsService } from '../../../src/modules/notification/services/sms.service';

const mockRepo = () => ({
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  save: jest.fn(),
  create: jest.fn().mockImplementation((dto) => ({ id: 'notif-uuid', ...dto })),
  update: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const mockEmailService = () => ({ send: jest.fn() });
const mockSmsService = () => ({ send: jest.fn() });

describe('NotificationService', () => {
  let service: NotificationService;
  let notificationRepo: ReturnType<typeof mockRepo>;
  let templateRepo: ReturnType<typeof mockRepo>;
  let emailService: ReturnType<typeof mockEmailService>;
  let cacheManager: { get: jest.Mock; set: jest.Mock; del: jest.Mock };

  beforeEach(async () => {
    cacheManager = {
      get: jest.fn().mockResolvedValue(null), // default: cache miss
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: getRepositoryToken(Notification), useFactory: mockRepo },
        { provide: getRepositoryToken(NotificationTemplate), useFactory: mockRepo },
        { provide: EmailService, useFactory: mockEmailService },
        { provide: SmsService, useFactory: mockSmsService },
        { provide: CACHE_MANAGER, useValue: cacheManager },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    notificationRepo = module.get(getRepositoryToken(Notification));
    templateRepo = module.get(getRepositoryToken(NotificationTemplate));
    emailService = module.get<EmailService>(EmailService) as unknown as ReturnType<
      typeof mockEmailService
    >;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByRecipient()', () => {
    it('returns paginated notifications for a recipient', async () => {
      const notifs = [{ id: 'notif-001' }];
      notificationRepo.findAndCount.mockResolvedValue([notifs, 1]);

      const [data, total] = await service.findByRecipient('coop-001', 10, 0);

      expect(notificationRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { recipientId: 'coop-001' }, take: 10, skip: 0 }),
      );
      expect(data).toEqual(notifs);
      expect(total).toBe(1);
    });
  });

  describe('findById()', () => {
    it('returns notification when found for recipient', async () => {
      const notif = { id: 'notif-001', recipientId: 'coop-001' };
      notificationRepo.findOne.mockResolvedValue(notif);

      const result = await service.findById('notif-001', 'coop-001');

      expect(notificationRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'notif-001', recipientId: 'coop-001' },
      });
      expect(result).toEqual(notif);
    });

    it('returns null when not found', async () => {
      notificationRepo.findOne.mockResolvedValue(null);

      const result = await service.findById('bad-id', 'coop-001');

      expect(result).toBeNull();
    });
  });

  describe('send()', () => {
    it('should skip sending when template is not found', async () => {
      templateRepo.findOne.mockResolvedValue(null);

      await service.send({
        recipientId: 'coop-123',
        recipientEmail: 'test@example.com',
        channel: 'email',
        templateCode: 'non-existent',
        language: 'fr-MA',
        context: {},
      });

      expect(emailService.send).not.toHaveBeenCalled();
      expect(notificationRepo.save).not.toHaveBeenCalled();
    });

    it('should render template and persist notification when template found', async () => {
      const template: Partial<NotificationTemplate> = {
        code: 'certification-granted',
        channel: 'email',
        language: 'fr-MA',
        subjectTemplate: 'Certification {{certificationNumber}}',
        bodyTemplate: '<p>Félicitations {{cooperativeName}}</p>',
        isActive: true,
      };
      templateRepo.findOne.mockResolvedValue(template);
      notificationRepo.save.mockResolvedValue({ id: 'notif-uuid' });

      await service.send({
        recipientId: 'coop-123',
        recipientEmail: 'admin@coop.ma',
        channel: 'email',
        templateCode: 'certification-granted',
        language: 'fr-MA',
        context: { certificationNumber: 'TERROIR-AOP-MRR-2025-001', cooperativeName: 'Coop Argan' },
      });

      expect(notificationRepo.save).toHaveBeenCalled();
      expect(emailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@coop.ma',
          subject: 'Certification TERROIR-AOP-MRR-2025-001',
        }),
      );
    });

    it('should mark notification as failed when email throws', async () => {
      const template: Partial<NotificationTemplate> = {
        code: 'certification-granted',
        channel: 'email',
        language: 'fr-MA',
        subjectTemplate: 'Certification',
        bodyTemplate: '<p>Body</p>',
        isActive: true,
      };
      templateRepo.findOne.mockResolvedValue(template);
      notificationRepo.save.mockResolvedValue({ id: 'notif-uuid' });
      emailService.send.mockRejectedValue(new Error('SMTP timeout'));

      await service.send({
        recipientId: 'coop-123',
        recipientEmail: 'admin@coop.ma',
        channel: 'email',
        templateCode: 'certification-granted',
        language: 'fr-MA',
        context: {},
      });

      expect(notificationRepo.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 'failed', errorMessage: 'SMTP timeout' }),
      );
    });
  });

  // ─── send() — template lookup: Redis → DB → file ─────────────────────────

  describe('send() — template lookup strategy', () => {
    const sendOpts = {
      recipientId: 'coop-123',
      recipientEmail: 'admin@coop.ma',
      channel: 'email' as const,
      templateCode: 'certification-granted',
      language: 'fr-MA',
      context: { cooperativeName: 'Test Coop' },
    };

    const template = {
      code: 'certification-granted',
      channel: 'email',
      language: 'fr-MA',
      subjectTemplate: 'Certificat',
      bodyTemplate: '<p>Bonjour</p>',
      isActive: true,
    } as NotificationTemplate;

    it('uses cached template from Redis when cache hit — skips DB query', async () => {
      cacheManager.get.mockResolvedValue(template);
      notificationRepo.save.mockResolvedValue({ id: 'notif-uuid' });
      emailService.send = jest.fn().mockResolvedValue(undefined);

      await service.send(sendOpts);

      expect(templateRepo.findOne).not.toHaveBeenCalled();
      expect(notificationRepo.save).toHaveBeenCalled();
    });

    it('queries DB and caches result when Redis miss + DB hit', async () => {
      cacheManager.get.mockResolvedValue(null);
      templateRepo.findOne.mockResolvedValue(template);
      notificationRepo.save.mockResolvedValue({ id: 'notif-uuid' });
      emailService.send = jest.fn().mockResolvedValue(undefined);

      await service.send(sendOpts);

      expect(templateRepo.findOne).toHaveBeenCalled();
      expect(cacheManager.set).toHaveBeenCalledWith(
        `template:${sendOpts.templateCode}:${sendOpts.channel}:${sendOpts.language}`,
        template,
        600_000,
      );
      expect(notificationRepo.save).toHaveBeenCalled();
    });

    it('logs warn and skips when Redis miss + DB miss + file missing', async () => {
      cacheManager.get.mockResolvedValue(null);
      templateRepo.findOne.mockResolvedValue(null);

      await service.send(sendOpts);

      expect(notificationRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('getStats() — US-076', () => {
    const mockQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
    };

    beforeEach(() => {
      notificationRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQb);
      jest.clearAllMocks();
      mockQb.select.mockReturnThis();
      mockQb.addSelect.mockReturnThis();
      mockQb.groupBy.mockReturnThis();
      mockQb.andWhere.mockReturnThis();
    });

    it('returns cached result on cache hit', async () => {
      const cached = {
        total: 10,
        byStatus: { sent: 8, failed: 2, pending: 0 },
        from: null,
        to: null,
        generatedAt: '2026-01-01T00:00:00.000Z',
      };
      cacheManager.get = jest.fn().mockResolvedValue(cached);

      const result = await service.getStats();

      expect(cacheManager.get).toHaveBeenCalledWith('stats:notifications:all:all');
      expect(notificationRepo.createQueryBuilder).not.toHaveBeenCalled();
      expect(result).toEqual(cached);
    });

    it('queries DB, caches result, and returns stats on cache miss', async () => {
      cacheManager.get = jest.fn().mockResolvedValue(null);
      cacheManager.set = jest.fn();
      mockQb.getRawMany.mockResolvedValue([
        { status: 'sent', count: '5' },
        { status: 'failed', count: '3' },
        { status: 'pending', count: '2' },
      ]);

      const result = await service.getStats();

      expect(result.total).toBe(10);
      expect(result.byStatus).toEqual({ sent: 5, failed: 3, pending: 2 });
      expect(cacheManager.set).toHaveBeenCalledWith(
        'stats:notifications:all:all',
        expect.objectContaining({ total: 10 }),
        300_000,
      );
    });

    it('applies from/to date filter to query builder', async () => {
      cacheManager.get = jest.fn().mockResolvedValue(null);
      cacheManager.set = jest.fn();
      mockQb.getRawMany.mockResolvedValue([]);

      await service.getStats('2026-01-01', '2026-03-31');

      expect(mockQb.andWhere).toHaveBeenCalledWith('n.created_at >= :from', { from: '2026-01-01' });
      expect(mockQb.andWhere).toHaveBeenCalledWith('n.created_at <= :to', { to: '2026-03-31' });
      expect(cacheManager.get).toHaveBeenCalledWith('stats:notifications:2026-01-01:2026-03-31');
    });
  });
});
