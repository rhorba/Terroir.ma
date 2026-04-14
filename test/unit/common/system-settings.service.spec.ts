import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { SystemSettingsService } from '../../../src/common/services/system-settings.service';
import { SystemSetting } from '../../../src/common/entities/system-setting.entity';

const makeRepo = () => ({
  find: jest.fn(),
  upsert: jest.fn(),
});

const makeCache = () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
});

describe('SystemSettingsService', () => {
  let service: SystemSettingsService;
  let repo: ReturnType<typeof makeRepo>;
  let cache: ReturnType<typeof makeCache>;

  beforeEach(async () => {
    repo = makeRepo();
    cache = makeCache();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemSettingsService,
        { provide: getRepositoryToken(SystemSetting), useValue: repo },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();
    service = module.get(SystemSettingsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(service).toBeDefined());

  describe('getCampaignSettings()', () => {
    it('returns cache hit without DB call', async () => {
      const cached = {
        currentCampaignYear: '2025-2026',
        campaignStartMonth: 10,
        campaignEndMonth: 9,
      };
      cache.get.mockResolvedValue(cached);
      const result = await service.getCampaignSettings();
      expect(result).toEqual(cached);
      expect(repo.find).not.toHaveBeenCalled();
    });

    it('reads DB on cache miss and applies defaults', async () => {
      repo.find.mockResolvedValue([
        { settingKey: 'current_campaign_year', settingValue: '2026-2027' },
        { settingKey: 'campaign_start_month', settingValue: '10' },
        { settingKey: 'campaign_end_month', settingValue: '9' },
      ]);
      const result = await service.getCampaignSettings();
      expect(result.currentCampaignYear).toBe('2026-2027');
      expect(cache.set).toHaveBeenCalledWith('settings:campaign', result, 300_000);
    });
  });

  describe('updateCampaignSettings()', () => {
    it('upserts rows and invalidates cache', async () => {
      repo.find.mockResolvedValue([]);
      const dto = { currentCampaignYear: '2026-2027', campaignStartMonth: 10, campaignEndMonth: 9 };
      await service.updateCampaignSettings(dto, 'user-123');
      expect(repo.upsert).toHaveBeenCalled();
      expect(cache.del).toHaveBeenCalledWith('settings:campaign');
    });
  });

  describe('getPlatformSettings()', () => {
    it('parses boolean correctly', async () => {
      repo.find.mockResolvedValue([
        { settingKey: 'maintenance_mode', settingValue: 'true' },
        { settingKey: 'support_email', settingValue: 'admin@terroir.ma' },
      ]);
      const result = await service.getPlatformSettings();
      expect(result.maintenanceMode).toBe(true);
      expect(result.supportEmail).toBe('admin@terroir.ma');
    });

    it('returns false for maintenance_mode when value is not "true"', async () => {
      repo.find.mockResolvedValue([
        { settingKey: 'maintenance_mode', settingValue: 'false' },
        { settingKey: 'support_email', settingValue: 'support@terroir.ma' },
      ]);
      const result = await service.getPlatformSettings();
      expect(result.maintenanceMode).toBe(false);
    });
  });

  describe('getCertificationSettings()', () => {
    it('reads numeric values from DB and caches them', async () => {
      repo.find.mockResolvedValue([
        { settingKey: 'default_validity_days', settingValue: '730' },
        { settingKey: 'max_renewal_grace_days', settingValue: '60' },
      ]);
      const result = await service.getCertificationSettings();
      expect(result.defaultValidityDays).toBe(730);
      expect(result.maxRenewalGraceDays).toBe(60);
      expect(cache.set).toHaveBeenCalledWith('settings:certification', result, 300_000);
    });
  });
});
