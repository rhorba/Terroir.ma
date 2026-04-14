import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { ExportDocumentService } from '../services/export-document.service';
import { ExportDocumentPdfService } from '../services/export-document-pdf.service';
import { GenerateExportDocDto } from '../dto/generate-export-doc.dto';
import { ClearancesReportQueryDto } from '../dto/clearances-report-query.dto';
import { HsCodeQueryDto } from '../dto/hs-code-query.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { ExportDocument } from '../entities/export-document.entity';
import { PaginationDto, PagedResult } from '../../../common/dto/pagination.dto';

/**
 * Export document controller — generates and validates customs export documentation.
 */
@ApiTags('export-documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('export-documents')
export class ExportDocumentController {
  constructor(
    private readonly exportDocumentService: ExportDocumentService,
    private readonly exportDocumentPdfService: ExportDocumentPdfService,
  ) {}

  /**
   * US-067 — Super-admin views all export clearances across all cooperatives.
   */
  @Get()
  @UseGuards(RolesGuard)
  @Roles('super-admin')
  @ApiOperation({ summary: 'US-067: List all export documents (super-admin)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(@Query() query: PaginationDto): Promise<PagedResult<ExportDocument>> {
    return this.exportDocumentService.findAll(query.page, query.limit);
  }

  /**
   * US-066 — Cooperative admin views all export documentation requests for their cooperative.
   * Scoped to the cooperative from the JWT claim.
   */
  @Get('my')
  @UseGuards(RolesGuard)
  @Roles('cooperative-admin')
  @ApiOperation({ summary: 'US-066: List export documents for the calling cooperative' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findMyExportDocuments(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: PaginationDto,
  ): Promise<PagedResult<ExportDocument>> {
    const cooperativeId = user.cooperative_id ?? user.sub;
    return this.exportDocumentService.findByCooperativePaginated(
      cooperativeId,
      query.page,
      query.limit,
    );
  }

  /** Generate export documentation for a certified batch */
  @Post()
  @UseGuards(RolesGuard)
  @Roles('cooperative-admin', 'customs-agent')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Generate export documentation for certified batch' })
  async generateExportDoc(
    @Body() dto: GenerateExportDocDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ExportDocument> {
    return this.exportDocumentService.generateDocument(dto, user.sub);
  }

  /**
   * US-068: Generate and download a PDF export certificate.
   * Registered before GET /:id — but segment count differs so no collision.
   */
  @Get(':id/certificate.pdf')
  @UseGuards(RolesGuard)
  @Roles('customs-agent', 'cooperative-admin', 'super-admin')
  @ApiOperation({ summary: 'US-068: Download PDF export certificate' })
  async downloadExportCertificatePdf(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const buffer = await this.exportDocumentPdfService.generateExportCertificatePdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="export-cert-${id}.pdf"`,
    });
    return new StreamableFile(buffer);
  }

  /**
   * US-070: Export clearances by destination country as CSV.
   * Registered before GET /:id — literal segment, no collision.
   */
  @Get('clearances-report')
  @UseGuards(RolesGuard)
  @Roles('super-admin', 'customs-agent')
  @ApiOperation({ summary: 'US-070: Export clearances by destination country (CSV)' })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'destinationCountry', required: false, type: String })
  async exportClearancesReport(
    @Query() query: ClearancesReportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const csv = await this.exportDocumentService.exportClearancesReport(
      query.from,
      query.to,
      query.destinationCountry,
    );
    const date = new Date().toISOString().slice(0, 10);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="clearances-${date}.csv"`,
    });
    return new StreamableFile(Buffer.from(csv, 'utf-8'));
  }

  /**
   * US-069: View HS code assignments.
   * cooperative-admin is auto-scoped to their JWT cooperativeId.
   * customs-agent / super-admin: optional cooperativeId filter.
   * Registered before GET /:id.
   */
  @Get('hs-codes')
  @UseGuards(RolesGuard)
  @Roles('cooperative-admin', 'customs-agent', 'super-admin')
  @ApiOperation({ summary: 'US-069: List HS code assignments' })
  @ApiQuery({ name: 'cooperativeId', required: false, type: String })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  async getHsCodeAssignments(
    @Query() query: HsCodeQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ success: boolean; data: unknown[] }> {
    const roles: string[] = (user.realm_access?.roles ?? []) as string[];
    const cooperativeId = roles.includes('cooperative-admin')
      ? (user.cooperative_id ?? user.sub)
      : query.cooperativeId;

    const data = await this.exportDocumentService.getHsCodeAssignments(
      cooperativeId,
      query.from,
      query.to,
    );
    return { success: true, data };
  }

  /** Get export document by ID */
  @Get(':id')
  @ApiOperation({ summary: 'Get export document by ID' })
  async findOne(@Param('id') id: string): Promise<ExportDocument> {
    return this.exportDocumentService.findById(id);
  }

  /** Validate export document (customs clearance) */
  @Post(':id/validate')
  @UseGuards(RolesGuard)
  @Roles('customs-agent')
  @ApiOperation({ summary: 'Validate export document for customs clearance' })
  async validateDocument(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ExportDocument> {
    return this.exportDocumentService.validateDocument(id, user.sub);
  }
}
