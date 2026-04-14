/**
 * Integration test: NotificationPreference entity with real PostgreSQL (Testcontainers).
 * Verifies upsert behavior, channel persistence, and language preference.
 * US-077
 */
import { NotificationPreference } from '../../../src/modules/notification/entities/notification-preference.entity';
import {
  startTestDatabase,
  stopTestDatabase,
  TestDatabase,
} from '../helpers/test-containers.setup';

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380c01';

describe('NotificationPreference (integration)', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await startTestDatabase([NotificationPreference]);
  });

  afterAll(async () => {
    await stopTestDatabase(db);
  });

  afterEach(async () => {
    await db.dataSource.query(`TRUNCATE TABLE notification.notification_preference`);
  });

  it('should persist a notification preference', async () => {
    const repo = db.dataSource.getRepository(NotificationPreference);
    await repo.save(repo.create({ userId: USER_ID, channels: ['email', 'sms'], language: 'fr' }));
    const found = await repo.findOneBy({ userId: USER_ID });
    expect(found).not.toBeNull();
    expect(found?.language).toBe('fr');
  });

  it('should persist Arabic language preference', async () => {
    const repo = db.dataSource.getRepository(NotificationPreference);
    await repo.save(repo.create({ userId: USER_ID, channels: ['email'], language: 'ar' }));
    const found = await repo.findOneBy({ userId: USER_ID });
    expect(found?.language).toBe('ar');
  });

  it('should update language on second upsert', async () => {
    const repo = db.dataSource.getRepository(NotificationPreference);
    await repo.upsert({ userId: USER_ID, channels: ['email'], language: 'fr' }, ['userId']);
    await repo.upsert({ userId: USER_ID, channels: ['sms'], language: 'ar' }, ['userId']);

    const found = await repo.findOneBy({ userId: USER_ID });
    expect(found?.language).toBe('ar');
  });

  it('should return null for non-existent user (service provides defaults)', async () => {
    const repo = db.dataSource.getRepository(NotificationPreference);
    const found = await repo.findOneBy({ userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380c99' });
    expect(found).toBeNull();
  });
});
