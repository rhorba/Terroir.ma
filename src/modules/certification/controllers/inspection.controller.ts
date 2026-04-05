import {
  Controller, Get, Post, Patch, Param, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InspectionService } from '../services/inspection.service';
import { ScheduleInspectionDto } from '../dto/schedule-inspection.dto';
import { FileInspectionReportDto } from '../dto/file-inspection-report.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { Inspection } from '../entities/inspection.entity';

/**
 * Inspection controller — manages scheduling and reporting of field inspections.
 */
@ApiTags('inspections')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inspections')
export class InspectionController {
  constructor(private readonly inspectionService: InspectionService) {}

  /** Schedule a field inspection */
  @Post()
  @UseGuards(RolesGuard)
  @Roles('certification-body', 'inspector')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Schedule a field inspection' })
  async scheduleInspection(
    @Body() dto: ScheduleInspectionDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<Inspection> {
    return this.inspectionService.scheduleInspection(dto, user.sub);
  }

  /** Get inspection by ID */
  @Get(':id')
  @ApiOperation({ summary: 'Get inspection by ID' })
  async findOne(@Param('id') id: string): Promise<Inspection> {
    return this.inspectionService.findById(id);
  }

  /** File an inspection report */
  @Patch(':id/report')
  @UseGuards(RolesGuard)
  @Roles('inspector')
  @ApiOperation({ summary: 'File inspection report after field visit' })
  async fileReport(
    @Param('id') id: string,
    @Body() dto: FileInspectionReportDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<Inspection> {
    return this.inspectionService.fileReport(id, dto, user.sub);
  }
}
