import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { NotificationTemplateService } from '../services/notification-template.service';
import { CreateNotificationTemplateDto } from '../dto/create-notification-template.dto';
import { UpdateNotificationTemplateDto } from '../dto/update-notification-template.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { NotificationTemplate } from '../entities/notification-template.entity';

/**
 * Super-admin management of notification templates.
 * Supports DB-override + file fallback pattern — changes here persist to DB
 * and take priority over bundled .hbs files at runtime.
 * US-075
 */
@ApiTags('notification-templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super-admin')
@Controller('notification-templates')
export class NotificationTemplateController {
  constructor(private readonly templateService: NotificationTemplateService) {}

  @Get()
  @ApiOperation({
    summary: 'US-075: List notification templates (filterable by code/channel/language)',
  })
  @ApiQuery({ name: 'code', required: false })
  @ApiQuery({ name: 'channel', required: false })
  @ApiQuery({ name: 'language', required: false })
  async findAll(
    @Query('code') code?: string,
    @Query('channel') channel?: string,
    @Query('language') language?: string,
  ): Promise<NotificationTemplate[]> {
    return this.templateService.findAll({ code, channel, language });
  }

  @Get(':id')
  @ApiOperation({ summary: 'US-075: Get notification template by ID' })
  async findOne(@Param('id') id: string): Promise<NotificationTemplate> {
    return this.templateService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'US-075: Create notification template' })
  async create(@Body() dto: CreateNotificationTemplateDto): Promise<NotificationTemplate> {
    return this.templateService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'US-075: Update notification template (invalidates Redis cache)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateNotificationTemplateDto,
  ): Promise<NotificationTemplate> {
    return this.templateService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'US-075: Deactivate notification template (soft delete, sets isActive=false)',
  })
  async deactivate(@Param('id') id: string): Promise<NotificationTemplate> {
    return this.templateService.deactivate(id);
  }

  @Post('seed')
  @ApiOperation({ summary: 'US-075: Seed templates from .hbs files into DB' })
  async seed(): Promise<{ seeded: number }> {
    return this.templateService.seed();
  }
}
