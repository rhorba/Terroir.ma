import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { NotificationService } from './services/notification.service';
import { EmailService } from './services/email.service';
import { SmsService } from './services/sms.service';
import { Notification } from './entities/notification.entity';
import { NotificationTemplate } from './entities/notification-template.entity';
import { NotificationListener } from './listeners/notification.listener';

/**
 * Notification module — trilingual (ar/fr/zgh) email + SMS notifications.
 * PostgreSQL schema: notification
 * Consumer group: notification-group
 * Consumes: certification.decision.granted, lab.test.completed, certification.inspection.scheduled
 */
@Module({
  imports: [TypeOrmModule.forFeature([Notification, NotificationTemplate])],
  providers: [NotificationService, EmailService, SmsService, NotificationListener],
  exports: [],
})
export class NotificationModule {}
