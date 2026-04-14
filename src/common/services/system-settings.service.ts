import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { SystemSetting } from '../entities/system-setting.entity';
import { CampaignSettingsDto } from '../dto/settings/campaign-settings.dto';
import { CertificationSettingsDto } from '../dto/settings/certification-settings.dto';
import { PlatformSettingsDto } from '../dto/settings/platform-settings.dto';

type SettingsGroup = 'campaign' | 'certification' | 'platform';

/**
 * US-090: Reads and writes grouped platform settings.
 * Backed by common.system_setting. Each group is Redis-cached for 300s.
 * Cache key: settings:{group}. Invalidated on PATCH.
 */
@Injectable()
export class SystemSettingsService {
  constructor(
    @InjectRepository(SystemSetting)
    private readonly settingRepo: Repository<SystemSetting>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /** Read all rows for a group and return as a plain key-value map. */
  private async readGroup(group: SettingsGroup): Promise<Record<string, string>> {
    const rows = await this.settingRepo.find({ where: { settingGroup: group } });
    return Object.fromEntries(rows.map((r) => [r.settingKey, r.settingValue]));
  }

  /** Upsert all key-value pairs from a DTO into the given group. */
  private async upsertGroup(
    group: SettingsGroup,
    dto: Record<string, unknown>,
    updatedBy: string,
  ): Promise<void> {
    for (const [key, value] of Object.entries(dto)) {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      await this.settingRepo.upsert(
        {
          settingGroup: group,
          settingKey: snakeKey,
          settingValue: String(value),
          updatedBy,
        },
        { conflictPaths: ['settingGroup', 'settingKey'] },
      );
    }
    await this.cacheManager.del(`settings:${group}`);
  }

  /** US-090: Read campaign settings. */
  async getCampaignSettings(): Promise<CampaignSettingsDto> {
    const cached = await this.cacheManager.get<CampaignSettingsDto>('settings:campaign');
    if (cached) return cached;
    const kv = await this.readGroup('campaign');
    const result: CampaignSettingsDto = {
      currentCampaignYear: kv['current_campaign_year'] ?? '2025-2026',
      campaignStartMonth: Number(kv['campaign_start_month'] ?? 10),
      campaignEndMonth: Number(kv['campaign_end_month'] ?? 9),
    };
    await this.cacheManager.set('settings:campaign', result, 300_000);
    return result;
  }

  /** US-090: Persist campaign settings. */
  async updateCampaignSettings(
    dto: CampaignSettingsDto,
    updatedBy: string,
  ): Promise<CampaignSettingsDto> {
    await this.upsertGroup('campaign', dto as unknown as Record<string, unknown>, updatedBy);
    return this.getCampaignSettings();
  }

  /** US-090: Read certification settings. */
  async getCertificationSettings(): Promise<CertificationSettingsDto> {
    const cached = await this.cacheManager.get<CertificationSettingsDto>('settings:certification');
    if (cached) return cached;
    const kv = await this.readGroup('certification');
    const result: CertificationSettingsDto = {
      defaultValidityDays: Number(kv['default_validity_days'] ?? 365),
      maxRenewalGraceDays: Number(kv['max_renewal_grace_days'] ?? 90),
    };
    await this.cacheManager.set('settings:certification', result, 300_000);
    return result;
  }

  /** US-090: Persist certification settings. */
  async updateCertificationSettings(
    dto: CertificationSettingsDto,
    updatedBy: string,
  ): Promise<CertificationSettingsDto> {
    await this.upsertGroup('certification', dto as unknown as Record<string, unknown>, updatedBy);
    return this.getCertificationSettings();
  }

  /** US-090: Read platform settings. */
  async getPlatformSettings(): Promise<PlatformSettingsDto> {
    const cached = await this.cacheManager.get<PlatformSettingsDto>('settings:platform');
    if (cached) return cached;
    const kv = await this.readGroup('platform');
    const result: PlatformSettingsDto = {
      maintenanceMode: kv['maintenance_mode'] === 'true',
      supportEmail: kv['support_email'] ?? 'support@terroir.ma',
    };
    await this.cacheManager.set('settings:platform', result, 300_000);
    return result;
  }

  /** US-090: Persist platform settings. */
  async updatePlatformSettings(
    dto: PlatformSettingsDto,
    updatedBy: string,
  ): Promise<PlatformSettingsDto> {
    await this.upsertGroup('platform', dto as unknown as Record<string, unknown>, updatedBy);
    return this.getPlatformSettings();
  }
}
