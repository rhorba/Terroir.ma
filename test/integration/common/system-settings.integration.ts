/**
 * Integration test: SystemSetting entity with real PostgreSQL (Testcontainers).
 * Verifies composite PK, persist/read, and group-based queries.
 * US-090
 */
import { SystemSetting } from '../../../src/common/entities/system-setting.entity';
import {
  startTestDatabase,
  stopTestDatabase,
  TestDatabase,
} from '../helpers/test-containers.setup';

describe('SystemSetting (integration)', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await startTestDatabase([SystemSetting]);
  });

  afterAll(async () => {
    await stopTestDatabase(db);
  });

  afterEach(async () => {
    await db.dataSource.query(`TRUNCATE TABLE common.system_setting`);
  });

  it('should persist a system setting row', async () => {
    const repo = db.dataSource.getRepository(SystemSetting);
    await repo.save(
      repo.create({
        settingGroup: 'platform',
        settingKey: 'maintenanceMode',
        settingValue: 'false',
        updatedBy: null,
      }),
    );
    const found = await repo.findOneBy({
      settingGroup: 'platform',
      settingKey: 'maintenanceMode',
    });
    expect(found).not.toBeNull();
    expect(found?.settingValue).toBe('false');
  });

  it('should allow updating a setting value via save', async () => {
    const repo = db.dataSource.getRepository(SystemSetting);
    await repo.save(
      repo.create({
        settingGroup: 'platform',
        settingKey: 'maintenanceMode',
        settingValue: 'false',
        updatedBy: null,
      }),
    );
    await repo.save(
      repo.create({
        settingGroup: 'platform',
        settingKey: 'maintenanceMode',
        settingValue: 'true',
        updatedBy: null,
      }),
    );
    const found = await repo.findOneBy({ settingGroup: 'platform', settingKey: 'maintenanceMode' });
    expect(found?.settingValue).toBe('true');
  });

  it('should retrieve all settings for a group', async () => {
    const repo = db.dataSource.getRepository(SystemSetting);
    await repo.save([
      repo.create({
        settingGroup: 'campaign',
        settingKey: 'currentCampaignYear',
        settingValue: '2025-2026',
        updatedBy: null,
      }),
      repo.create({
        settingGroup: 'campaign',
        settingKey: 'campaignStartMonth',
        settingValue: '10',
        updatedBy: null,
      }),
      repo.create({
        settingGroup: 'campaign',
        settingKey: 'campaignEndMonth',
        settingValue: '9',
        updatedBy: null,
      }),
    ]);
    const rows = await repo.findBy({ settingGroup: 'campaign' });
    expect(rows.length).toBe(3);
    const keys = rows.map((r) => r.settingKey).sort();
    expect(keys).toEqual(['campaignEndMonth', 'campaignStartMonth', 'currentCampaignYear']);
  });
});
