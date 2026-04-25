import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-yet';
import { NotificationService } from './services/notification.service';
import { NotificationTemplateService } from './services/notification-template.service';
import { EmailService } from './services/email.service';
import { SmsService } from './services/sms.service';
import { Notification } from './entities/notification.entity';
import { NotificationTemplate } from './entities/notification-template.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { NotificationListener } from './listeners/notification.listener';
import { NotificationController } from './controllers/notification.controller';
import { NotificationTemplateController } from './controllers/notification-template.controller';

/**
 * Notification module — trilingual (ar/fr/zgh) email + SMS notifications.
 * PostgreSQL schema: notification
 * Consumer group: notification-group
 * Consumes: certification.decision.granted, lab.test.completed, certification.inspection.scheduled
 * Template lookup order: Redis cache (600s TTL) → DB record → .hbs file in assets/templates/
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, NotificationTemplate, NotificationPreference]),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        store: redisStore,
        url: config.get<string>('redis.url'),
        ttl: 0,
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [NotificationController, NotificationTemplateController],
  providers: [
    NotificationService,
    NotificationTemplateService,
    EmailService,
    SmsService,
    NotificationListener, // registers Kafka handlers via KafkaConsumerService in onModuleInit()
  ],
  exports: [],
})
export class NotificationModule {}
