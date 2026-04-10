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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ExportDocumentService } from '../services/export-document.service';
import { GenerateExportDocDto } from '../dto/generate-export-doc.dto';
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
  constructor(private readonly exportDocumentService: ExportDocumentService) {}

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
