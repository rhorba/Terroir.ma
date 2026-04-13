import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { LabService } from '../services/lab.service';
import { CreateLabDto } from '../dto/create-lab.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Lab } from '../entities/lab.entity';

/**
 * Lab controller — manages ONSSA-accredited laboratory registry.
 * US-030
 */
@ApiTags('labs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('labs')
export class LabController {
  constructor(private readonly labService: LabService) {}

  /** US-030: Register a new laboratory (super-admin only). */
  @Post()
  @UseGuards(RolesGuard)
  @Roles('super-admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'US-030: Register a new ONSSA laboratory' })
  async create(@Body() dto: CreateLabDto): Promise<Lab> {
    return this.labService.create(dto);
  }

  /** US-030: List all laboratories. */
  @Get()
  @UseGuards(RolesGuard)
  @Roles('super-admin', 'certification-body')
  @ApiOperation({ summary: 'US-030: List all laboratories' })
  async findAll(): Promise<Lab[]> {
    return this.labService.findAll();
  }

  /** US-030: Get laboratory by ID. */
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('super-admin', 'certification-body')
  @ApiOperation({ summary: 'US-030: Get laboratory by ID' })
  async findOne(@Param('id') id: string): Promise<Lab> {
    return this.labService.findById(id);
  }

  /** US-030: Grant ONSSA accreditation to a laboratory. */
  @Post(':id/accredit')
  @UseGuards(RolesGuard)
  @Roles('super-admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'US-030: Grant ONSSA accreditation' })
  async accredit(@Param('id') id: string): Promise<Lab> {
    return this.labService.accredit(id);
  }

  /** US-030: Revoke ONSSA accreditation from a laboratory. */
  @Post(':id/revoke')
  @UseGuards(RolesGuard)
  @Roles('super-admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'US-030: Revoke ONSSA accreditation' })
  async revoke(@Param('id') id: string): Promise<Lab> {
    return this.labService.revoke(id);
  }
}
