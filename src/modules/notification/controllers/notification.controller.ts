import { Controller, Get, Param, Query, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { NotificationService } from '../services/notification.service';
import { NotificationHistoryQueryDto } from '../dto/notification-history-query.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
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
