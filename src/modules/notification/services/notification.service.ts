import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { Notification, NotificationChannel } from '../entities/notification.entity';
import { NotificationTemplate } from '../entities/notification-template.entity';
import { NotificationPreference } from '../entities/notification-preference.entity';
import { NotificationStats } from '../interfaces/notification-stats.interface';
import { UpsertNotificationPreferenceDto } from '../dto/notification-preference.dto';
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

  private readonly templatesDir = path.join(process.cwd(), 'assets', 'templates');

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(NotificationTemplate)
    private readonly templateRepo: Repository<NotificationTemplate>,
    @InjectRepository(NotificationPreference)
    private readonly preferenceRepo: Repository<NotificationPreference>,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async findByRecipient(
    recipientId: string,
    limit = 20,
    offset = 0,
  ): Promise<[Notification[], number]> {
    return this.notificationRepo.findAndCount({
      where: { recipientId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async findById(id: string, recipientId: string): Promise<Notification | null> {
    return this.notificationRepo.findOne({ where: { id, recipientId } });
  }

  /**
   * US-076 + US-088 — Returns notification delivery counts grouped by status and channel.
   * US-088 adds byChannel with deliveryRate % per channel.
   * Redis-cached for 300s. Key: stats:notifications:{from|all}:{to|all}
   */
  async getStats(from?: string, to?: string): Promise<NotificationStats> {
    const cacheKey = `stats:notifications:${from ?? 'all'}:${to ?? 'all'}`;
    const cached = await this.cacheManager.get<NotificationStats>(cacheKey);
    if (cached) return cached;

    // Query 1: by status
    const statusQb = this.notificationRepo
      .createQueryBuilder('n')
      .select('n.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('n.status');
    if (from) statusQb.andWhere('n.created_at >= :from', { from });
    if (to) statusQb.andWhere('n.created_at <= :to', { to });
    const statusRows: Array<{ status: string; count: string }> = await statusQb.getRawMany();

    // Query 2: by channel — sent and failed counts per channel for delivery rate
    const channelQb = this.notificationRepo
      .createQueryBuilder('n')
      .select('n.channel', 'channel')
      .addSelect("COUNT(*) FILTER (WHERE n.status = 'sent')", 'sent')
      .addSelect("COUNT(*) FILTER (WHERE n.status = 'failed')", 'failed')
      .groupBy('n.channel');
    if (from) channelQb.andWhere('n.created_at >= :from', { from });
    if (to) channelQb.andWhere('n.created_at <= :to', { to });
    const channelRows: Array<{ channel: string; sent: string; failed: string }> =
      await channelQb.getRawMany();

    const byStatus = { sent: 0, failed: 0, pending: 0 };
    let total = 0;
    for (const row of statusRows) {
      const count = Number(row.count);
      total += count;
      if (row.status === 'sent') byStatus.sent = count;
      else if (row.status === 'failed') byStatus.failed = count;
      else if (row.status === 'pending') byStatus.pending = count;
    }

    const byChannel = channelRows.map((row) => {
      const sent = Number(row.sent);
      const failed = Number(row.failed);
      const deliveryRate = sent + failed === 0 ? 0 : Math.round((sent / (sent + failed)) * 100);
      return { channel: row.channel as 'email' | 'sms', sent, failed, deliveryRate };
    });

    const result: NotificationStats = {
      total,
      byStatus,
      byChannel,
      from: from ?? null,
      to: to ?? null,
      generatedAt: new Date().toISOString(),
    };

    await this.cacheManager.set(cacheKey, result, 300_000);
    return result;
  }

  /**
   * US-077: Get notification preferences for a user.
   * Returns in-memory defaults if no row exists — never throws.
   * Redis-cached for 300s per user. Key: pref:{userId}.
   */
  async getPreferences(userId: string): Promise<{ channels: string[]; language: string }> {
    const cacheKey = `pref:${userId}`;
    const cached = await this.cacheManager.get<{ channels: string[]; language: string }>(cacheKey);
    if (cached) return cached;

    const row = await this.preferenceRepo.findOne({ where: { userId } });
    const result = row
      ? { channels: row.channels, language: row.language }
      : { channels: ['email'], language: 'fr' };

    await this.cacheManager.set(cacheKey, result, 300_000);
    return result;
  }

  /**
   * US-077: Upsert notification preferences for a user.
   * Invalidates the Redis cache on update.
   */
  async upsertPreferences(
    userId: string,
    dto: UpsertNotificationPreferenceDto,
  ): Promise<{ channels: string[]; language: string }> {
    await this.preferenceRepo.upsert(
      { userId, channels: dto.channels, language: dto.language },
      { conflictPaths: ['userId'] },
    );
    await this.cacheManager.del(`pref:${userId}`);
    return { channels: dto.channels, language: dto.language };
  }

  async send(opts: SendNotificationOptions): Promise<void> {
    const language = opts.language ?? 'fr-MA';

    // US-077: Skip if channel not in user's preferences
    const prefs = await this.getPreferences(opts.recipientId);
    if (!prefs.channels.includes(opts.channel)) {
      this.logger.debug(
        { recipientId: opts.recipientId, channel: opts.channel },
        'Notification skipped — channel not in user preferences',
      );
      return;
    }
    const cacheKey = `template:${opts.templateCode}:${opts.channel}:${language}`;

    // 1. Redis cache check
    let template = await this.cacheManager.get<NotificationTemplate>(cacheKey);

    if (!template) {
      // 2. DB lookup
      const dbTemplate = await this.templateRepo.findOne({
        where: { code: opts.templateCode, channel: opts.channel, language, isActive: true },
      });

      if (dbTemplate) {
        await this.cacheManager.set(cacheKey, dbTemplate, 600_000);
        template = dbTemplate;
      } else {
        // 3. File fallback
        const filePath = path.join(
          this.templatesDir,
          `${opts.templateCode}.${opts.channel}.${language}.hbs`,
        );
        if (fs.existsSync(filePath)) {
          const bodyTemplate = fs.readFileSync(filePath, 'utf8');
          template = {
            code: opts.templateCode,
            channel: opts.channel,
            language,
            bodyTemplate,
            subjectTemplate: null,
            isActive: true,
          } as NotificationTemplate;
        }
      }
    }

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
      this.logger.error(
        { notificationId: notification.id, error: message },
        'Notification delivery failed',
      );
      await this.notificationRepo.update(notification.id, {
        status: 'failed',
        errorMessage: message,
      });
    }
  }
}
