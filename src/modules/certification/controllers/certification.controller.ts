import {
  Controller, Get, Post, Patch, Param, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';
import { CertificationService } from '../services/certification.service';
import { RequestCertificationDto } from '../dto/request-certification.dto';
import { GrantCertificationDto } from '../dto/grant-certification.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { Certification } from '../entities/certification.entity';

/**
 * Certification module HTTP controller.
 * Manages the request → inspect → decide workflow.
 */
@ApiTags('certifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('certifications')
export class CertificationController {
  constructor(private readonly certificationService: CertificationService) {}

  /** Request a new certification for a production batch */
  @Post('request')
  @UseGuards(RolesGuard)
  @Roles('cooperative-admin', 'cooperative-member')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Request certification for a production batch' })
  async requestCertification(
    @Body() dto: RequestCertificationDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<Certification> {
    return this.certificationService.requestCertification(dto, user.sub);
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
  ): Promise<Certification> {
    return this.certificationService.grantCertification(id, dto, user.sub);
  }

  /** Deny a certification */
  @Patch(':id/deny')
  @UseGuards(RolesGuard)
  @Roles('certification-body')
  @ApiOperation({ summary: 'Deny certification decision' })
  async denyCertification(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<Certification> {
    return this.certificationService.denyCertification(id, reason, user.sub);
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
  ): Promise<Certification> {
    return this.certificationService.revokeCertification(id, reason, user.sub);
  }
}
