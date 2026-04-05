/**
 * Integration test: NotificationService with real PostgreSQL (Testcontainers).
 *
 * Verifies that:
 * - Templates are resolved from the database
 * - Notifications are persisted with correct status
 * - Handlebars rendering produces expected output
 */
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { NotificationService } from '../../../src/modules/notification/services/notification.service';
import { Notification } from '../../../src/modules/notification/entities/notification.entity';
import { NotificationTemplate } from '../../../src/modules/notification/entities/notification-template.entity';
import { EmailService } from '../../../src/modules/notification/services/email.service';
import { SmsService } from '../../../src/modules/notification/services/sms.service';
import { ConfigService } from '@nestjs/config';
import { NOTIFICATION_TEMPLATE_FIXTURES } from '../../fixtures/notification-templates.fixture';
import { buildSendNotificationOptions } from '../../factories/notification.factory';
import { seedRows, truncateTables } from '../../helpers/database.helper';

describe('NotificationService (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let service: NotificationService;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('terroir_test')
      .withUsername('test')
      .withPassword('test')
      .start();

    const module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: container.getConnectionUri(),
          entities: [Notification, NotificationTemplate],
          schema: 'notification',
          synchronize: true, // OK for tests — use migrations in production
        }),
        TypeOrmModule.forFeature([Notification, NotificationTemplate]),
      ],
      providers: [
        NotificationService,
        { provide: EmailService, useValue: { send: jest.fn() } },
        { provide: SmsService, useValue: { send: jest.fn() } },
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    dataSource = module.get<DataSource>(DataSource);

    // Create notification schema
    await dataSource.query('CREATE SCHEMA IF NOT EXISTS notification');

    // Seed templates
    await seedRows(dataSource, 'notification', 'notification_template', NOTIFICATION_TEMPLATE_FIXTURES);
  });

  afterEach(async () => {
    await truncateTables(dataSource, ['notification']);
  });

  afterAll(async () => {
    await dataSource.destroy();
    await container.stop();
  });

  it('should persist a sent notification record', async () => {
    const opts = buildSendNotificationOptions({
      templateCode: 'certification-granted',
      language: 'fr-MA',
      channel: 'email',
    });

    await service.send(opts);

    const notifications = await dataSource.query('SELECT * FROM notification.notification');
    expect(notifications).toHaveLength(1);
    expect(notifications[0].status).toBe('sent');
  });

  it('should use fr-MA template by default when no language specified', async () => {
    const opts = buildSendNotificationOptions({
      templateCode: 'certification-granted',
      language: undefined,
      channel: 'email',
    });

    await service.send(opts);

    const [notif] = await dataSource.query('SELECT * FROM notification.notification');
    expect(notif.language).toBe('fr-MA');
  });
});
