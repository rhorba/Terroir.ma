import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../../../src/modules/notification/services/email.service';

// Mock nodemailer before importing EmailService
const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-msg-id' });
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail,
  })),
}));

const mockConfigService = {
  get: (key: string, def?: unknown) => {
    const config: Record<string, unknown> = {
      SMTP_HOST: 'localhost',
      SMTP_PORT: 1025,
      SMTP_FROM: 'Terroir.ma <noreply@terroir.ma>',
    };
    return config[key] ?? def;
  },
};

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailService, { provide: ConfigService, useValue: mockConfigService }],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('send()', () => {
    it('sends an email via nodemailer transporter', async () => {
      await service.send({
        to: 'recipient@coop.ma',
        subject: 'Certification accordée',
        html: '<p>Votre certification a été accordée.</p>',
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'recipient@coop.ma',
          subject: 'Certification accordée',
          html: '<p>Votre certification a été accordée.</p>',
        }),
      );
    });

    it('uses custom from address when provided', async () => {
      await service.send({
        to: 'recipient@coop.ma',
        subject: 'Test',
        html: '<p>Test</p>',
        from: 'custom@terroir.ma',
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ from: 'custom@terroir.ma' }),
      );
    });

    it('uses default from address when not provided', async () => {
      await service.send({
        to: 'recipient@coop.ma',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ from: 'Terroir.ma <noreply@terroir.ma>' }),
      );
    });
  });
});
