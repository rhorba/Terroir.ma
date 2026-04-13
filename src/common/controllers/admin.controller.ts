import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { KafkaAdminService, DlqTopicStats } from '../services/kafka-admin.service';
import { DashboardService } from '../services/dashboard.service';
import { AuditLogService } from '../services/audit-log.service';
import { AuditLogQueryDto } from '../dto/audit-log-query.dto';
import { AuditLog } from '../entities/audit-log.entity';

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
}
