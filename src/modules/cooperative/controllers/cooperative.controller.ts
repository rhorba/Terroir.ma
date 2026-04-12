import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CooperativeService } from '../services/cooperative.service';
import { CreateCooperativeDto } from '../dto/create-cooperative.dto';
import { UpdateCooperativeDto } from '../dto/update-cooperative.dto';
import { AddMemberDto } from '../dto/add-member.dto';
import { UpdateMemberDto } from '../dto/update-member.dto';
import { MapFarmDto } from '../dto/map-farm.dto';
import { DeactivateCooperativeDto } from '../dto/deactivate-cooperative.dto';
import { Member } from '../entities/member.entity';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { Cooperative } from '../entities/cooperative.entity';

/**
 * Cooperative module HTTP controller.
 * Manages cooperative registration, member management, and farm mapping.
 */
@ApiTags('cooperatives')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cooperatives')
export class CooperativeController {
  constructor(private readonly cooperativeService: CooperativeService) {}

  /** Register a new cooperative */
  @Post()
  @UseGuards(RolesGuard)
  @Roles('cooperative-admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new cooperative' })
  async register(
    @Body() dto: CreateCooperativeDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<Cooperative> {
    return this.cooperativeService.register(dto, user.sub);
  }

  /** Get a cooperative by ID */
  @Get(':id')
  @ApiOperation({ summary: 'Get cooperative by ID' })
  async findOne(@Param('id') id: string): Promise<Cooperative> {
    return this.cooperativeService.findById(id);
  }

  /** Update cooperative details */
  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('cooperative-admin')
  @ApiOperation({ summary: 'Update cooperative details' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCooperativeDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<Cooperative> {
    return this.cooperativeService.update(id, dto, user.sub);
  }

  /** Add a member to the cooperative */
  @Post(':id/members')
  @UseGuards(RolesGuard)
  @Roles('cooperative-admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a member to cooperative' })
  async addMember(
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<void> {
    await this.cooperativeService.addMember(id, dto, user.sub);
  }

  /** US-010 — Deactivate a cooperative (super-admin only) */
  @Put(':id/deactivate')
  @UseGuards(RolesGuard)
  @Roles('super-admin')
  @ApiOperation({ summary: 'US-010: Deactivate a cooperative (super-admin)' })
  async deactivate(
    @Param('id') id: string,
    @Body() dto: DeactivateCooperativeDto,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-correlation-id') correlationId = '',
  ): Promise<Cooperative> {
    return this.cooperativeService.deactivate(id, user.sub, dto.reason ?? null, correlationId);
  }

  /** Verify a cooperative (super-admin only) */
  @Patch(':id/verify')
  @UseGuards(RolesGuard)
  @Roles('super-admin')
  @ApiOperation({ summary: 'Verify a cooperative (super-admin only)' })
  async verify(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-correlation-id') correlationId: string,
  ): Promise<Cooperative> {
    return this.cooperativeService.verify(id, user.sub, correlationId ?? user.sub);
  }

  /** Map a farm to the cooperative */
  @Post(':id/farms')
  @UseGuards(RolesGuard)
  @Roles('cooperative-admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Map a farm to cooperative' })
  async mapFarm(
    @Param('id') id: string,
    @Body() dto: MapFarmDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<void> {
    await this.cooperativeService.mapFarm(id, dto, user.sub);
  }

  /** List active members of a cooperative (US-009) */
  @Get(':id/members')
  @UseGuards(RolesGuard)
  @Roles('cooperative-admin', 'super-admin')
  @ApiOperation({ summary: 'List all active members of a cooperative (US-009)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getMembers(
    @Param('id') id: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ): Promise<{
    success: boolean;
    data: Member[];
    meta: { page: number; limit: number; total: number };
  }> {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, parseInt(limit, 10) || 20);
    const [data, total] = await this.cooperativeService.getMembers(id, pageNum, limitNum);
    return { success: true, data, meta: { page: pageNum, limit: limitNum, total } };
  }

  /** Update own member profile (US-008) */
  @Patch(':id/members/:memberId')
  @UseGuards(RolesGuard)
  @Roles('cooperative-member')
  @ApiOperation({ summary: 'Update own member profile — phone and email only (US-008)' })
  async updateMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<Member> {
    return this.cooperativeService.updateMember(id, memberId, dto, user.sub);
  }
}
