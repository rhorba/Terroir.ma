import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { KafkaAdminService, DlqTopicStats } from '../services/kafka-admin.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super-admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly kafkaAdminService: KafkaAdminService) {}

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
}
