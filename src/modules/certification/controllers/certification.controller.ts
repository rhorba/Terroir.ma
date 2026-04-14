import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { CertificationService } from '../services/certification.service';
import { CertificationPdfService } from '../services/certification-pdf.service';
import { StatsQueryDto } from '../dto/stats-query.dto';
import { ExportQueryDto } from '../dto/export-query.dto';
import { ReportQueryDto } from '../dto/report-query.dto';
import { ComplianceExportQueryDto } from '../dto/compliance-export-query.dto';
import {
  CertificationStats,
  CooperativeComplianceRow,
  OnssaCertRow,
  CertificationAnalytics,
} from '../interfaces/certification-stats.interface';
import { RequestCertificationDto } from '../dto/request-certification.dto';
import { GrantCertificationDto } from '../dto/grant-certification.dto';
import { DenyCertificationDto } from '../dto/deny-certification.dto';
import { SubmitCertificationDto } from '../dto/submit-certification.dto';
import { StartReviewDto } from '../dto/start-review.dto';
import { ScheduleInspectionDto } from '../dto/schedule-inspection.dto';
import { StartInspectionDto } from '../dto/start-inspection.dto';
import { CompleteInspectionDto } from '../dto/complete-inspection.dto';
import { RequestLabDto } from '../dto/request-lab.dto';
import { StartFinalReviewDto } from '../dto/start-final-review.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { Certification, CertificationStatus } from '../entities/certification.entity';
import { PaginationDto, PagedResult } from '../../../common/dto/pagination.dto';

/**
 * Certification module HTTP controller.
 * Manages the request → inspect → decide workflow.
 */
@ApiTags('certifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('certifications')
export class CertificationController {
  constructor(
    private readonly certificationService: CertificationService,
    private readonly certificationPdfService: CertificationPdfService,
  ) {}

  /**
   * US-048 — Super-admin views certification statistics by status, region, and product type.
   * Results cached in Redis for 5 minutes.
   */
  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles('super-admin')
  @ApiOperation({ summary: 'US-048: Certification statistics by status / region / product type' })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'YYYY-MM-DD' })
  async getStats(@Query() query: StatsQueryDto): Promise<CertificationStats> {
    return this.certificationService.getStats(query.from, query.to);
  }

  /**
   * US-047 — Generate and download a trilingual PDF conformity certificate.
   * Available for GRANTED and RENEWED certifications only.
   */
  @Get(':id/certificate.pdf')
  @UseGuards(RolesGuard)
  @Roles('cooperative-admin', 'certification-body', 'super-admin')
  @ApiOperation({ summary: 'US-047: Download PDF conformity certificate (AR/FR/ZGH)' })
  @ApiParam({ name: 'id', description: 'Certification UUID' })
  async downloadCertificatePdf(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const buffer = await this.certificationPdfService.generateCertificatePdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="certificate.pdf"',
    });
    return new StreamableFile(buffer);
  }

  /**
   * US-042 — Certification body officer views all pending certification requests.
   * Returns certifications in actionable statuses: SUBMITTED, DOCUMENT_REVIEW, LAB_RESULTS_RECEIVED, UNDER_REVIEW.
   */
  @Get('pending')
  @UseGuards(RolesGuard)
  @Roles('certification-body', 'super-admin')
  @ApiOperation({ summary: 'US-042: List pending certification requests (cert-body view)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findPending(@Query() query: PaginationDto): Promise<PagedResult<Certification>> {
    return this.certificationService.findPending(query.page, query.limit);
  }

  /**
   * US-049 — Cooperative admin views all certifications for their cooperative.
   * Scoped to the cooperative from the JWT claim.
   */
  @Get('my')
  @UseGuards(RolesGuard)
  @Roles('cooperative-admin')
  @ApiOperation({ summary: 'US-049: List certifications for the calling cooperative' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findMyCertifications(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: PaginationDto,
  ): Promise<PagedResult<Certification>> {
    const cooperativeId = user.cooperative_id ?? user.sub;
    return this.certificationService.findByCooperativePaginated(
      cooperativeId,
      query.page,
      query.limit,
    );
  }

  /**
   * US-084 — Export certifications as JSON for MAPMDREF regulatory reporting.
   * Returns up to 10,000 rows with optional date range and status filters.
   * Content-Disposition: attachment so the browser/client downloads the file.
   * Registered before GET /:id (literal-before-param rule).
   */
  @Get('export')
  @UseGuards(RolesGuard)
  @Roles('super-admin', 'certification-body')
  @ApiOperation({ summary: 'US-084: Export certifications as JSON for MAPMDREF' })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'status', required: false, enum: CertificationStatus })
  async exportForMapmdref(
    @Query() query: ExportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Certification[]> {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    res.set({
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="certifications-export-${date}.json"`,
    });
    return this.certificationService.exportForMapmdref(query);
  }

  /**
   * US-082: Certification analytics — counts grouped by region and product type.
   * Registered before GET /:id (literal-before-param rule).
   */
  @Get('analytics')
  @UseGuards(RolesGuard)
  @Roles('super-admin', 'certification-body')
  @ApiOperation({ summary: 'US-082: Certification analytics by region and product type' })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'YYYY-MM-DD' })
  async getAnalytics(
    @Query() query: ReportQueryDto,
  ): Promise<{ success: boolean; data: CertificationAnalytics }> {
    const data = await this.certificationService.getAnalytics(query.from, query.to);
    return { success: true, data };
  }

  /**
   * US-083: Cooperative compliance report — certification counts grouped by cooperative.
   * Registered before GET /:id (literal-before-param rule).
   */
  @Get('compliance-report')
  @UseGuards(RolesGuard)
  @Roles('super-admin', 'certification-body')
  @ApiOperation({ summary: 'US-083: Cooperative compliance report (grouped by cooperative)' })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'YYYY-MM-DD' })
  async complianceReport(@Query() query: ReportQueryDto): Promise<CooperativeComplianceRow[]> {
    return this.certificationService.complianceReport(query.from, query.to);
  }

  /**
   * US-089: ONSSA active certifications report — all GRANTED certifications.
   * Registered before GET /:id (literal-before-param rule).
   */
  @Get('onssa-report')
  @UseGuards(RolesGuard)
  @Roles('super-admin', 'certification-body')
  @ApiOperation({ summary: 'US-089: Active certifications report for ONSSA' })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'YYYY-MM-DD' })
  async onssaReport(@Query() query: ReportQueryDto): Promise<OnssaCertRow[]> {
    return this.certificationService.onssaReport(query.from, query.to);
  }

  /**
   * US-050: Export certification compliance report as CSV.
   * Registered before GET /:id to avoid NestJS param collision.
   */
  @Get('compliance-export')
  @UseGuards(RolesGuard)
  @Roles('super-admin', 'certification-body')
  @ApiOperation({ summary: 'US-050: Export certification compliance report (CSV)' })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  async exportComplianceReport(
    @Query() query: ComplianceExportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const csv = await this.certificationService.exportComplianceReport(
      query.from,
      query.to,
      query.status,
    );
    const date = new Date().toISOString().slice(0, 10);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="compliance-${date}.csv"`,
    });
    return new StreamableFile(Buffer.from(csv, 'utf-8'));
  }

  /** Request a new certification for a production batch */
  @Post('request')
  @UseGuards(RolesGuard)
  @Roles('cooperative-admin', 'cooperative-member')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Request certification for a production batch' })
  async requestCertification(
    @Body() dto: RequestCertificationDto,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-correlation-id') correlationId = '',
  ): Promise<Certification> {
    return this.certificationService.requestCertification(dto, user.sub, correlationId);
  }

  /** Get a certification by ID */
  @Get(':id')
  @ApiOperation({ summary: 'Get certification by ID' })
  @ApiParam({ name: 'id', description: 'Certification UUID' })
  async findOne(@Param('id') id: string): Promise<Certification> {
    return this.certificationService.findById(id);
  }

  /** Grant a certification (certification body only) */
  @Patch(':id/grant')
  @UseGuards(RolesGuard)
  @Roles('certification-body')
  @ApiOperation({ summary: 'Grant certification decision' })
  async grantCertification(
    @Param('id') id: string,
    @Body() dto: GrantCertificationDto,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-correlation-id') correlationId = '',
  ): Promise<Certification> {
    const role = user.realm_access?.roles?.[0] ?? 'certification-body';
    return this.certificationService.grantCertification(id, dto, user.sub, role, correlationId);
  }

  /** Deny a certification */
  @Patch(':id/deny')
  @UseGuards(RolesGuard)
  @Roles('certification-body')
  @ApiOperation({ summary: 'Deny certification decision' })
  async denyCertification(
    @Param('id') id: string,
    @Body() dto: DenyCertificationDto,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-correlation-id') correlationId = '',
  ): Promise<Certification> {
    const role = user.realm_access?.roles?.[0] ?? 'certification-body';
    return this.certificationService.denyCertification(id, dto, user.sub, role, correlationId);
  }

  // ─── State Machine Endpoints ──────────────────────────────────────────────

  /** Step 1: Submit a DRAFT certification request (cooperative-admin) */
  @Post(':id/submit')
  @UseGuards(RolesGuard)
  @Roles('cooperative-admin', 'cooperative-member')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 1: Submit a draft certification request' })
  @ApiParam({ name: 'id', description: 'Certification UUID' })
  async submitRequest(
    @Param('id') id: string,
    @Body() _dto: SubmitCertificationDto,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-correlation-id') correlationId = '',
  ): Promise<Certification> {
    const role = user.realm_access?.roles?.[0] ?? 'cooperative-admin';
    return this.certificationService.submitRequest(id, user.sub, role, correlationId);
  }

  /** Step 2: Certification body starts document review */
  @Post(':id/start-review')
  @UseGuards(RolesGuard)
  @Roles('certification-body')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 2: Start document review' })
  @ApiParam({ name: 'id', description: 'Certification UUID' })
  async startReview(
    @Param('id') id: string,
    @Body() dto: StartReviewDto,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-correlation-id') correlationId = '',
  ): Promise<Certification> {
    const role = user.realm_access?.roles?.[0] ?? 'certification-body';
    return this.certificationService.startReview(
      id,
      dto.remarks ?? null,
      user.sub,
      role,
      correlationId,
    );
  }

  /** Step 3: Certification body schedules a field inspection */
  @Post(':id/schedule-inspection')
  @UseGuards(RolesGuard)
  @Roles('certification-body')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 3: Schedule a field inspection' })
  @ApiParam({ name: 'id', description: 'Certification UUID' })
  async scheduleInspectionChain(
    @Param('id') id: string,
    @Body() dto: ScheduleInspectionDto,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-correlation-id') correlationId = '',
  ): Promise<Certification> {
    const role = user.realm_access?.roles?.[0] ?? 'certification-body';
    return this.certificationService.scheduleInspectionChain(
      id,
      dto,
      user.sub,
      role,
      correlationId,
    );
  }

  /** Step 4: Inspector starts the field visit */
  @Post(':id/start-inspection')
  @UseGuards(RolesGuard)
  @Roles('inspector')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 4: Inspector starts the field visit' })
  @ApiParam({ name: 'id', description: 'Certification UUID' })
  async startInspection(
    @Param('id') id: string,
    @Body() _dto: StartInspectionDto,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-correlation-id') correlationId = '',
  ): Promise<Certification> {
    const role = user.realm_access?.roles?.[0] ?? 'inspector';
    return this.certificationService.startInspection(id, user.sub, role, correlationId);
  }

  /** Step 5: Inspector files the completed inspection report */
  @Post(':id/complete-inspection')
  @UseGuards(RolesGuard)
  @Roles('inspector')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 5: Inspector files the inspection report' })
  @ApiParam({ name: 'id', description: 'Certification UUID' })
  async completeInspectionChain(
    @Param('id') id: string,
    @Body() dto: CompleteInspectionDto,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-correlation-id') correlationId = '',
  ): Promise<Certification> {
    const role = user.realm_access?.roles?.[0] ?? 'inspector';
    return this.certificationService.completeInspectionChain(
      id,
      dto,
      user.sub,
      role,
      correlationId,
    );
  }

  /** Step 6: Certification body requests lab testing */
  @Post(':id/request-lab')
  @UseGuards(RolesGuard)
  @Roles('certification-body')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 6: Send batch to lab testing' })
  @ApiParam({ name: 'id', description: 'Certification UUID' })
  async requestLab(
    @Param('id') id: string,
    @Body() dto: RequestLabDto,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-correlation-id') correlationId = '',
  ): Promise<Certification> {
    const role = user.realm_access?.roles?.[0] ?? 'certification-body';
    return this.certificationService.requestLab(
      id,
      dto.labId ?? null,
      dto.remarks ?? null,
      user.sub,
      role,
      correlationId,
    );
  }

  /** Step 8: Certification body starts final review after lab results received */
  @Post(':id/start-final-review')
  @UseGuards(RolesGuard)
  @Roles('certification-body')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 8: Start final review of lab results' })
  @ApiParam({ name: 'id', description: 'Certification UUID' })
  async startFinalReview(
    @Param('id') id: string,
    @Body() _dto: StartFinalReviewDto,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-correlation-id') correlationId = '',
  ): Promise<Certification> {
    const role = user.realm_access?.roles?.[0] ?? 'certification-body';
    return this.certificationService.startFinalReview(id, user.sub, role, correlationId);
  }

  /** Step 12: Cooperative admin renews a granted certification */
  @Post(':id/renew')
  @UseGuards(RolesGuard)
  @Roles('cooperative-admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 12: Renew a granted certification' })
  @ApiParam({ name: 'id', description: 'Certification UUID' })
  async renewCertification(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-correlation-id') correlationId = '',
  ): Promise<Certification> {
    const role = user.realm_access?.roles?.[0] ?? 'cooperative-admin';
    return this.certificationService.renewCertification(id, user.sub, role, correlationId);
  }

  /** Revoke a granted certification */
  @Patch(':id/revoke')
  @UseGuards(RolesGuard)
  @Roles('certification-body', 'super-admin')
  @ApiOperation({ summary: 'Revoke a granted certification' })
  async revokeCertification(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-correlation-id') correlationId = '',
  ): Promise<Certification> {
    const role = user.realm_access?.roles?.[0] ?? 'certification-body';
    return this.certificationService.revokeCertification(id, reason, user.sub, role, correlationId);
  }
}
