import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { QrCodeService, QrVerificationResult } from '../services/qr-code.service';
import {
  isSupportedLang,
  DEFAULT_LANG,
  SupportedLang,
  isRtlLang,
  VERIFICATION_STATUS_I18N,
  VERIFICATION_MESSAGE_I18N,
  resolveMessageKey,
} from '../../../common/constants/i18n-verification.constants';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { QrCode } from '../entities/qr-code.entity';

/**
 * QR Code controller.
 * POST /qr-codes/:certificationId — generate QR (auth required)
 * GET  /verify/:uuid              — public QR verification (no auth)
 */
@ApiTags('qr-codes')
@Controller()
export class QrCodeController {
  constructor(private readonly qrCodeService: QrCodeService) {}

  /**
   * US-057 — Download QR code image for packaging.
   * Returns PNG (default) or SVG binary stream.
   * Certification must be GRANTED or RENEWED.
   */
  @Get('qr-codes/:certificationId/download')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('cooperative-admin', 'certification-body', 'super-admin')
  @ApiOperation({ summary: 'US-057: Download QR code as PNG or SVG for packaging' })
  @ApiParam({ name: 'certificationId', description: 'Certification UUID' })
  @ApiQuery({
    name: 'format',
    required: false,
    enum: ['png', 'svg'],
    description: 'Image format (default: png)',
  })
  async downloadQrCode(
    @Param('certificationId') certificationId: string,
    @Query('format') format: string = 'png',
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const safeFormat = format === 'svg' ? 'svg' : 'png';
    const result = await this.qrCodeService.downloadQrCode(certificationId, safeFormat);
    res.set({
      'Content-Type': result.mimeType,
      'Content-Disposition': `attachment; filename="${result.filename}"`,
    });
    return new StreamableFile(result.buffer);
  }

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
  ): Promise<QrCode> {
    return this.qrCodeService.generateQrCode(certificationId, user.sub);
  }

  /**
   * Public QR verification — no authentication required.
   * Path param is the HMAC signature embedded in the QR code URL.
   * Optional ?sig= query param: if provided, used as the HMAC lookup key instead.
   * Optional ?lang= query param: ar | fr | zgh — defaults to fr. Adds statusDisplay, message, rtl fields.
   * Returns full certification chain if valid; 403 if signature mismatch, 404 if not found.
   * Target: < 200ms via Redis cache (cache is language-neutral; i18n applied after retrieval).
   */
  @Get('verify/:uuid')
  @ApiOperation({ summary: 'Verify QR code and return certification chain (public)' })
  @ApiParam({ name: 'uuid', description: 'QR code HMAC signature or UUID from scanned QR' })
  @ApiQuery({ name: 'sig', required: false, description: 'HMAC signature for verification' })
  @ApiQuery({
    name: 'lang',
    required: false,
    enum: ['ar', 'fr', 'zgh'],
    description: 'Response language (default: fr)',
  })
  async verifyQrCode(
    @Param('uuid') uuid: string,
    @Query('sig') sig?: string,
    @Query('lang') lang?: string,
  ): Promise<QrVerificationResult & { statusDisplay?: string; lang: SupportedLang; rtl: boolean }> {
    const resolvedLang: SupportedLang = isSupportedLang(lang ?? '')
      ? (lang as SupportedLang)
      : DEFAULT_LANG;
    const lookupKey = sig ?? uuid;
    const result = await this.qrCodeService.verifyQrCode(lookupKey);

    const certStatus = result.certification?.currentStatus;
    const qrExpired = !!(result.qrCode?.expiresAt && new Date() > result.qrCode.expiresAt);
    const messageKey = resolveMessageKey(result.valid, certStatus, qrExpired);
    const translatedMessage = VERIFICATION_MESSAGE_I18N[messageKey][resolvedLang];
    const statusDisplay =
      certStatus && VERIFICATION_STATUS_I18N[certStatus]
        ? VERIFICATION_STATUS_I18N[certStatus][resolvedLang]
        : undefined;

    if (!result.valid) {
      if (sig !== undefined) {
        throw new ForbiddenException({
          code: 'QR_INVALID_SIGNATURE',
          message: translatedMessage,
          lang: resolvedLang,
          rtl: isRtlLang(resolvedLang),
        });
      }
      throw new NotFoundException({
        code: 'QR_NOT_FOUND',
        message: translatedMessage,
        lang: resolvedLang,
        rtl: isRtlLang(resolvedLang),
      });
    }

    return {
      ...result,
      message: translatedMessage,
      statusDisplay,
      lang: resolvedLang,
      rtl: isRtlLang(resolvedLang),
    };
  }
}
