import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BatchService } from '../services/batch.service';
import { ProcessingStepService } from '../services/processing-step.service';
import { CreateBatchDto } from '../dto/create-batch.dto';
import { AddProcessingStepDto } from '../dto/add-processing-step.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { ProductionBatch } from '../entities/production-batch.entity';
import { ProcessingStep } from '../entities/processing-step.entity';

@ApiTags('batches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('batches')
export class BatchController {
  constructor(
    private readonly batchService: BatchService,
    private readonly processingStepService: ProcessingStepService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('cooperative-admin', 'cooperative-member')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new production batch from harvests' })
  async create(
    @Body() dto: CreateBatchDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ProductionBatch> {
    const cooperativeId = user.cooperative_id ?? '';
    return this.batchService.createBatch(dto, cooperativeId, user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get production batch by ID' })
  async findOne(@Param('id') id: string): Promise<ProductionBatch> {
    return this.batchService.findById(id);
  }

  @Get('cooperative/:cooperativeId')
  @ApiOperation({ summary: 'List all production batches for a cooperative' })
  async findByCooperative(
    @Param('cooperativeId') cooperativeId: string,
  ): Promise<ProductionBatch[]> {
    return this.batchService.findByCooperative(cooperativeId);
  }

  /** US-019: Record a post-harvest processing step for a batch */
  @Post(':id/processing-steps')
  @UseGuards(RolesGuard)
  @Roles('cooperative-admin', 'cooperative-member')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'US-019: Add a post-harvest processing step to a batch' })
  async addProcessingStep(
    @Param('id') batchId: string,
    @Body() dto: AddProcessingStepDto,
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-correlation-id') correlationId = '',
  ): Promise<ProcessingStep> {
    const cooperativeId = user.cooperative_id ?? '';
    return this.processingStepService.addStep(
      batchId,
      dto,
      cooperativeId,
      user.sub,
      correlationId || user.sub,
    );
  }

  /** US-019: List all processing steps for a batch */
  @Get(':id/processing-steps')
  @UseGuards(RolesGuard)
  @Roles(
    'cooperative-admin',
    'cooperative-member',
    'inspector',
    'certification-body',
    'super-admin',
  )
  @ApiOperation({ summary: 'US-019: List post-harvest processing steps for a batch' })
  async listProcessingSteps(@Param('id') batchId: string): Promise<ProcessingStep[]> {
    return this.processingStepService.findByBatch(batchId);
  }
}
