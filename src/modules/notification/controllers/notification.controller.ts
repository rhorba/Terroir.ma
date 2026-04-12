import { Controller, Get, Param, Query, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { NotificationService } from '../services/notification.service';
import { NotificationHistoryQueryDto } from '../dto/notification-history-query.dto';
import { NotificationStatsQueryDto } from '../dto/notification-stats-query.dto';
import { NotificationStats } from '../interfaces/notification-stats.interface';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { Notification } from '../entities/notification.entity';

/**
 * Notification module HTTP controller.
 * Allows authenticated users to view their own notification history.
 */
@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /** US-076 — Notification delivery stats (super-admin) */
  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles('super-admin')
  @ApiOperation({ summary: 'US-076: Notification delivery counts by status (super-admin)' })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  async getStats(@Query() query: NotificationStatsQueryDto): Promise<NotificationStats> {
    return this.notificationService.getStats(query.from, query.to);
  }

  /** List notifications for the current user */
  @Get()
  @ApiOperation({ summary: 'List notifications for the current user' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async findMine(
    @CurrentUser() user: CurrentUserPayload,
    @Query('limit') limit = 20,
    @Query('offset') offset = 0,
  ) {
    const [items, total] = await this.notificationService.findByRecipient(
      user.sub,
      Number(limit),
      Number(offset),
    );
    return { items, total };
  }

  /** Paginated notification history for the authenticated user (US-074) */
  @Get('history')
  @ApiOperation({ summary: 'Paginated notification history for the current user (US-074)' })
  async getHistory(
    @Query() dto: NotificationHistoryQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{
    success: boolean;
    data: Notification[];
    meta: { page: number; limit: number; total: number };
  }> {
    const page = Math.max(1, dto.page ?? 1);
    const limit = Math.min(dto.limit ?? 20, 100);
    const [data, total] = await this.notificationService.findByRecipient(
      user.sub,
      limit,
      (page - 1) * limit,
    );
    return { success: true, data, meta: { page, limit, total } };
  }

  /** Get a specific notification by ID (must belong to current user) */
  @Get(':id')
  @ApiOperation({ summary: 'Get a notification by ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    const notification = await this.notificationService.findById(id, user.sub);
    if (!notification) throw new NotFoundException('Notification not found');
    return notification;
  }
}
