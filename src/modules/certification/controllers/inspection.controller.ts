import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Param,
  Body,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { InspectionService } from '../services/inspection.service';
import { ScheduleInspectionDto } from '../dto/schedule-inspection.dto';
import { FileInspectionReportDto } from '../dto/file-inspection-report.dto';
import { AssignInspectorDto } from '../dto/assign-inspector.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { Inspection } from '../entities/inspection.entity';
import { PaginationDto, PagedResult } from '../../../common/dto/pagination.dto';

/**
 * Inspection controller — manages scheduling and reporting of field inspections.
 */
@ApiTags('inspections')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inspections')
export class InspectionController {
  constructor(private readonly inspectionService: InspectionService) {}

  /**
   * US-043 — Inspector views their scheduled inspections.
   * Scoped to the inspector's Keycloak sub (user ID stored as inspectorId on the entity).
   */
  @Get('my')
  @UseGuards(RolesGuard)
  @Roles('inspector')
  @ApiOperation({ summary: 'US-043: List inspections assigned to the calling inspector' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findMyInspections(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: PaginationDto,
  ): Promise<PagedResult<Inspection>> {
    return this.inspectionService.findByInspectorId(user.sub, query.page, query.limit);
  }

  /** Schedule a field inspection */
  @Post()
  @UseGuards(RolesGuard)
  @Roles('certification-body', 'inspector')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Schedule a field inspection' })
  async scheduleInspection(
    @Body() dto: ScheduleInspectionDto,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-correlation-id') correlationId = '',
  ): Promise<Inspection> {
    return this.inspectionService.scheduleInspection(dto, user.sub, correlationId);
  }

  /** US-044 — Assign inspector to an inspection (super-admin) */
  @Put(':id/assign-inspector')
  @UseGuards(RolesGuard)
  @Roles('super-admin')
  @ApiOperation({ summary: 'US-044: Assign inspector to inspection (super-admin)' })
  async assignInspector(
    @Param('id') id: string,
    @Body() dto: AssignInspectorDto,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-correlation-id') correlationId = '',
  ): Promise<Inspection> {
    return this.inspectionService.assignInspector(
      id,
      dto.inspectorId,
      dto.inspectorName,
      user.sub,
      correlationId,
    );
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
    @Headers('x-correlation-id') correlationId = '',
  ): Promise<Inspection> {
    return this.inspectionService.fileReport(id, dto, user.sub, correlationId);
  }
}
