import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Handlebars from 'handlebars';
import { Notification, NotificationChannel } from '../entities/notification.entity';
import { NotificationTemplate } from '../entities/notification-template.entity';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';

export interface SendNotificationOptions {
  recipientId: string;
  recipientEmail?: string;
  recipientPhone?: string;
  channel: NotificationChannel;
  templateCode: string;
  language?: string;
  context: Record<string, unknown>;
  correlationId?: string;
  triggerEventId?: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(NotificationTemplate)
    private readonly templateRepo: Repository<NotificationTemplate>,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
  ) {}

  async send(opts: SendNotificationOptions): Promise<void> {
    const language = opts.language ?? 'fr-MA';

    const template = await this.templateRepo.findOne({
      where: { code: opts.templateCode, channel: opts.channel, language, isActive: true },
    });

    if (!template) {
      this.logger.warn(
        { templateCode: opts.templateCode, channel: opts.channel, language },
        'Notification template not found — skipping',
      );
      return;
    }

    const renderedBody = Handlebars.compile(template.bodyTemplate)(opts.context);
    const renderedSubject = template.subjectTemplate
      ? Handlebars.compile(template.subjectTemplate)(opts.context)
      : null;

    const notification = this.notificationRepo.create({
      recipientId: opts.recipientId,
      recipientEmail: opts.recipientEmail ?? null,
      recipientPhone: opts.recipientPhone ?? null,
      channel: opts.channel,
      templateCode: opts.templateCode,
      language,
      subject: renderedSubject,
      body: renderedBody,
      contextData: opts.context,
      status: 'pending',
      correlationId: opts.correlationId ?? null,
      triggerEventId: opts.triggerEventId ?? null,
    });

    await this.notificationRepo.save(notification);

    try {
      if (opts.channel === 'email' && opts.recipientEmail) {
        await this.emailService.send({
          to: opts.recipientEmail,
          subject: renderedSubject ?? '',
          html: renderedBody,
        });
      } else if (opts.channel === 'sms' && opts.recipientPhone) {
        await this.smsService.send({ to: opts.recipientPhone, body: renderedBody });
      }

      await this.notificationRepo.update(notification.id, {
        status: 'sent',
        sentAt: new Date(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error({ notificationId: notification.id, error: message }, 'Notification delivery failed');
      await this.notificationRepo.update(notification.id, {
        status: 'failed',
        errorMessage: message,
      });
    }
  }
}
