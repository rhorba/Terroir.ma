import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Headers,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  StreamableFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { LabTestService } from '../services/lab-test.service';
import { SubmitLabTestDto, RecordLabTestResultDto } from '../dto/submit-lab-test.dto';
import { LabTestListQueryDto } from '../dto/lab-test-list-query.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { LabTest } from '../entities/lab-test.entity';
import { LabTestResult } from '../entities/lab-test-result.entity';
import { PagedResult } from '../../../common/dto/pagination.dto';

@ApiTags('lab-tests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('lab-tests')
export class LabTestController {
  constructor(private readonly labTestService: LabTestService) {}

  /**
   * US-028: Paginated lab test history with optional filters.
   * cooperative-admin: server enforces own cooperativeId from JWT claim.
   * Registered before GET /:id to prevent NestJS param collision.
   */
  @Get()
  @UseGuards(RolesGuard)
  @Roles('cooperative-admin', 'inspector', 'certification-body', 'super-admin')
  @ApiOperation({ summary: 'US-028: List lab tests with optional filters' })
  @ApiQuery({ name: 'batchId', required: false })
  @ApiQuery({ name: 'cooperativeId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @Query() query: LabTestListQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<PagedResult<LabTest>> {
    // cooperative-admin can only see their own cooperative's lab tests
    const roles: string[] = user.realm_access?.roles ?? [];
    if (roles.includes('cooperative-admin') && !roles.includes('super-admin')) {
      query.cooperativeId = user.cooperative_id ?? query.cooperativeId;
    }
    return this.labTestService.findAll(query);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('cooperative-admin', 'lab-technician')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a new lab test for a production batch' })
  async submit(
    @Body() dto: SubmitLabTestDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<LabTest> {
    const cooperativeId = user.cooperative_id ?? '';
    return this.labTestService.submitLabTest(dto, cooperativeId, user.sub);
  }

  @Post(':id/results')
  @UseGuards(RolesGuard)
  @Roles('lab-technician')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record lab test result' })
  async recordResult(
    @Param('id') id: string,
    @Body() dto: RecordLabTestResultDto,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-correlation-id') correlationId: string,
  ): Promise<LabTestResult> {
    const dtoWithId: RecordLabTestResultDto = { ...dto, labTestId: id };
    return this.labTestService.recordResult(dtoWithId, user.sub, correlationId ?? user.sub);
  }

  /**
   * US-026: Upload a PDF lab report alongside structured results.
   * Only PDF MIME type accepted. Replaces any existing report.
   */
  @Post(':id/report')
  @UseGuards(RolesGuard)
  @Roles('lab-technician')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
    }),
  )
  @ApiOperation({ summary: 'US-026: Upload PDF lab report' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  async uploadReport(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<LabTest> {
    return this.labTestService.uploadReport(id, file);
  }

  /**
   * US-026: Download the PDF lab report (NestJS proxy stream).
   */
  @Get(':id/report')
  @UseGuards(RolesGuard)
  @Roles('lab-technician', 'cooperative-admin', 'inspector', 'certification-body', 'super-admin')
  @ApiOperation({ summary: 'US-026: Download PDF lab report' })
  async downloadReport(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { stream, fileName } = await this.labTestService.downloadReport(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
    });
    return new StreamableFile(stream);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get lab test by ID' })
  async findOne(@Param('id') id: string): Promise<LabTest> {
    return this.labTestService.findById(id);
  }

  @Get(':id/result')
  @ApiOperation({ summary: 'Get lab test result' })
  async findResult(@Param('id') id: string): Promise<LabTestResult | null> {
    return this.labTestService.findResultByLabTestId(id);
  }
}
