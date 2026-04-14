import { Controller, Get, Query, UseGuards, Body, Patch } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { KafkaAdminService, DlqTopicStats } from '../services/kafka-admin.service';
import { DashboardService } from '../services/dashboard.service';
import { AuditLogService } from '../services/audit-log.service';
import { AuditLogQueryDto } from '../dto/audit-log-query.dto';
import { AuditLog } from '../entities/audit-log.entity';
import { SystemSettingsService } from '../services/system-settings.service';
import { CampaignSettingsDto } from '../dto/settings/campaign-settings.dto';
import { CertificationSettingsDto } from '../dto/settings/certification-settings.dto';
import { PlatformSettingsDto } from '../dto/settings/platform-settings.dto';
import { CurrentUser, CurrentUserPayload } from '../decorators/current-user.decorator';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super-admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly kafkaAdminService: KafkaAdminService,
    private readonly dashboardService: DashboardService,
    private readonly auditLogService: AuditLogService,
    private readonly systemSettingsService: SystemSettingsService,
  ) {}

  /**
   * US-087: View Kafka DLQ topic message counts.
   * Calls Redpanda Admin API and returns current high watermarks for all *.dlq topics.
   * Returns empty array if Admin API is unreachable (does not fail the request).
   */
  @Get('kafka/dlq-stats')
  @ApiOperation({ summary: 'US-087: Kafka DLQ topic message counts (super-admin)' })
  async getDlqStats(): Promise<{ success: boolean; data: DlqTopicStats[] }> {
    const data = await this.kafkaAdminService.getDlqStats();
    return { success: true, data };
  }

  /**
   * US-081: Platform metrics dashboard — counts across all 4 modules.
   * Redis-cached for 300s.
   */
  @Get('dashboard')
  @ApiOperation({ summary: 'US-081: Platform metrics dashboard (super-admin)' })
  async getDashboard(): Promise<{ success: boolean; data: unknown }> {
    const data = await this.dashboardService.getDashboard();
    return { success: true, data };
  }

  /**
   * US-085: Paginated user activity audit log.
   */
  @Get('audit-logs')
  @ApiOperation({ summary: 'US-085: Paginated user activity audit log (super-admin)' })
  async getAuditLogs(@Query() query: AuditLogQueryDto): Promise<{
    success: boolean;
    data: AuditLog[];
    meta: { page: number; limit: number; total: number };
  }> {
    const { data, total, page, limit } = await this.auditLogService.findAll(query);
    return { success: true, data, meta: { page, limit, total } };
  }

  /** US-090: Get campaign settings */
  @Get('settings/campaign')
  @ApiOperation({ summary: 'US-090: Get campaign settings (super-admin)' })
  async getCampaignSettings(): Promise<{ success: boolean; data: CampaignSettingsDto }> {
    const data = await this.systemSettingsService.getCampaignSettings();
    return { success: true, data };
  }

  /** US-090: Update campaign settings */
  @Patch('settings/campaign')
  @ApiOperation({ summary: 'US-090: Update campaign settings (super-admin)' })
  async updateCampaignSettings(
    @Body() dto: CampaignSettingsDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ success: boolean; data: CampaignSettingsDto }> {
    const data = await this.systemSettingsService.updateCampaignSettings(dto, user.sub);
    return { success: true, data };
  }

  /** US-090: Get certification settings */
  @Get('settings/certification')
  @ApiOperation({ summary: 'US-090: Get certification settings (super-admin)' })
  async getCertificationSettings(): Promise<{ success: boolean; data: CertificationSettingsDto }> {
    const data = await this.systemSettingsService.getCertificationSettings();
    return { success: true, data };
  }

  /** US-090: Update certification settings */
  @Patch('settings/certification')
  @ApiOperation({ summary: 'US-090: Update certification settings (super-admin)' })
  async updateCertificationSettings(
    @Body() dto: CertificationSettingsDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ success: boolean; data: CertificationSettingsDto }> {
    const data = await this.systemSettingsService.updateCertificationSettings(dto, user.sub);
    return { success: true, data };
  }

  /** US-090: Get platform settings */
  @Get('settings/platform')
  @ApiOperation({ summary: 'US-090: Get platform settings (super-admin)' })
  async getPlatformSettings(): Promise<{ success: boolean; data: PlatformSettingsDto }> {
    const data = await this.systemSettingsService.getPlatformSettings();
    return { success: true, data };
  }

  /** US-090: Update platform settings */
  @Patch('settings/platform')
  @ApiOperation({ summary: 'US-090: Update platform settings (super-admin)' })
  async updatePlatformSettings(
    @Body() dto: PlatformSettingsDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ success: boolean; data: PlatformSettingsDto }> {
    const data = await this.systemSettingsService.updatePlatformSettings(dto, user.sub);
    return { success: true, data };
  }
}
