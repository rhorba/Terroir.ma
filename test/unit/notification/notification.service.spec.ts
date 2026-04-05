import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationService } from '../../../src/modules/notification/services/notification.service';
import { Notification } from '../../../src/modules/notification/entities/notification.entity';
import { NotificationTemplate } from '../../../src/modules/notification/entities/notification-template.entity';
import { EmailService } from '../../../src/modules/notification/services/email.service';
import { SmsService } from '../../../src/modules/notification/services/sms.service';

const mockRepo = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn().mockImplementation((dto) => dto),
  update: jest.fn(),
});

const mockEmailService = () => ({ send: jest.fn() });
const mockSmsService = () => ({ send: jest.fn() });

describe('NotificationService', () => {
  let service: NotificationService;
  let notificationRepo: ReturnType<typeof mockRepo>;
  let templateRepo: ReturnType<typeof mockRepo>;
  let emailService: ReturnType<typeof mockEmailService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: getRepositoryToken(Notification), useFactory: mockRepo },
        { provide: getRepositoryToken(NotificationTemplate), useFactory: mockRepo },
        { provide: EmailService, useFactory: mockEmailService },
        { provide: SmsService, useFactory: mockSmsService },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    notificationRepo = module.get(getRepositoryToken(Notification));
    templateRepo = module.get(getRepositoryToken(NotificationTemplate));
    emailService = module.get<EmailService>(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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
});
