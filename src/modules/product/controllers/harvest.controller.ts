import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { HarvestService } from '../services/harvest.service';
import { LogHarvestDto } from '../dto/log-harvest.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../../common/decorators/current-user.decorator';
import { Harvest } from '../entities/harvest.entity';

@ApiTags('harvests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('harvests')
export class HarvestController {
  constructor(private readonly harvestService: HarvestService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('cooperative-admin', 'cooperative-member')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Log a new harvest record' })
  async logHarvest(
    @Body() dto: LogHarvestDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<Harvest> {
    const cooperativeId = user.cooperative_id ?? '';
    return this.harvestService.logHarvest(dto, cooperativeId, user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get harvest by ID' })
  async findOne(@Param('id') id: string): Promise<Harvest> {
    return this.harvestService.findById(id);
  }

  @Get('farm/:farmId')
  @ApiOperation({ summary: 'List all harvests for a farm' })
  async findByFarm(@Param('farmId') farmId: string): Promise<Harvest[]> {
    return this.harvestService.findByFarm(farmId);
  }

  @Get('cooperative/:cooperativeId')
  @ApiOperation({ summary: 'List all harvests for a cooperative, optionally filtered by campaign year' })
  @ApiQuery({ name: 'campaignYear', required: false, example: '2025/2026' })
  async findByCooperative(
    @Param('cooperativeId') cooperativeId: string,
    @Query('campaignYear') campaignYear?: string,
  ): Promise<Harvest[]> {
    return this.harvestService.findByCooperative(cooperativeId, campaignYear);
  }
}
