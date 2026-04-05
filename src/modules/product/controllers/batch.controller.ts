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
import { BatchService } from '../services/batch.service';
import { CreateBatchDto } from '../dto/create-batch.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../../common/decorators/current-user.decorator';
import { ProductionBatch } from '../entities/production-batch.entity';

@ApiTags('batches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('batches')
export class BatchController {
  constructor(private readonly batchService: BatchService) {}

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
}
