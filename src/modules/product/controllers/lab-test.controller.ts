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
import { LabTestService } from '../services/lab-test.service';
import { SubmitLabTestDto, RecordLabTestResultDto } from '../dto/submit-lab-test.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../../common/decorators/current-user.decorator';
import { LabTest } from '../entities/lab-test.entity';
import { LabTestResult } from '../entities/lab-test-result.entity';

@ApiTags('lab-tests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('lab-tests')
export class LabTestController {
  constructor(private readonly labTestService: LabTestService) {}

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
