import { Controller, Get, Post, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';
import { QrCodeService } from '../services/qr-code.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../../common/decorators/current-user.decorator';

/**
 * QR Code controller.
 * POST /qr-codes/:certificationId — generate QR (auth required)
 * GET  /verify/:uuid              — public QR verification (no auth)
 */
@ApiTags('qr-codes')
@Controller()
export class QrCodeController {
  constructor(private readonly qrCodeService: QrCodeService) {}

  /** Generate a QR code for a granted certification */
  @Post('qr-codes/:certificationId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('certification-body', 'super-admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Generate QR code for a granted certification' })
  @ApiParam({ name: 'certificationId', description: 'Certification UUID' })
  async generateQrCode(
    @Param('certificationId') certificationId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<{ qrCodeDataUrl: string; verificationUrl: string }> {
    return this.qrCodeService.generateQrCode(certificationId, user.sub);
  }

  /**
   * Public QR verification — no authentication required.
   * Returns full certification chain for the given QR UUID.
   * Target: < 200ms via Redis cache.
   */
  @Get('verify/:uuid')
  @ApiOperation({ summary: 'Verify QR code and return certification chain (public)' })
  @ApiParam({ name: 'uuid', description: 'QR code UUID from scanned QR' })
  async verifyQrCode(@Param('uuid') uuid: string): Promise<Record<string, unknown>> {
    return this.qrCodeService.verifyQrCode(uuid);
  }
}
