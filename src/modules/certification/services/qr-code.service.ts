import { Injectable, NotFoundException, UnauthorizedException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { QrCode } from '../entities/qr-code.entity';
import { Certification } from '../entities/certification.entity';
import { CertificationProducer } from '../events/certification.producer';

export interface QrVerificationResult {
  valid: boolean;
  certification: Certification | null;
  qrCode: QrCode | null;
  message: string;
}

/**
 * QR code service — generates and verifies HMAC-signed QR codes for certifications.
 * Uses HMAC-SHA256 with a server-side secret for tamper detection.
 */
@Injectable()
export class QrCodeService {
  private readonly logger = new Logger(QrCodeService.name);
  private readonly hmacSecret: string;
  private readonly baseUrl: string;

  constructor(
    @InjectRepository(QrCode)
    private readonly qrCodeRepo: Repository<QrCode>,
    @InjectRepository(Certification)
    private readonly certificationRepo: Repository<Certification>,
    private readonly configService: ConfigService,
    private readonly producer: CertificationProducer,
  ) {
    this.hmacSecret =
      this.configService.get<string>('app.qrHmacSecret') ??
      process.env.QR_HMAC_SECRET ??
      'terroir-ma-qr-secret-change-in-production';
    this.baseUrl =
      this.configService.get<string>('app.baseUrl') ??
      process.env.BASE_URL ??
      'https://api.terroir.ma';
  }

  /**
   * Generate a new QR code for a granted certification.
   * Creates an HMAC-SHA256 signature using certificationId + issuedAt.
   */
  async generateQrCode(certificationId: string, correlationId: string): Promise<QrCode> {
    const certification = await this.certificationRepo.findOne({
      where: { id: certificationId },
    });
    if (!certification) {
      throw new NotFoundException({
        code: 'CERTIFICATION_NOT_FOUND',
        message: `Certification ${certificationId} not found`,
      });
    }

    // Deactivate any existing QR codes for this certification
    await this.qrCodeRepo.update(
      { certificationId, isActive: true },
      { isActive: false },
    );

    const issuedAt = new Date();
    const payload = `${certificationId}:${issuedAt.toISOString()}`;
    const hmacSignature = crypto
      .createHmac('sha256', this.hmacSecret)
      .update(payload)
      .digest('hex');

    const verificationUrl = `${this.baseUrl}/verify/${hmacSignature}`;

    const qrCode = this.qrCodeRepo.create({
      certificationId,
      hmacSignature,
      verificationUrl,
      isActive: true,
      scansCount: 0,
      issuedAt,
      expiresAt: certification.validUntil
        ? new Date(certification.validUntil)
        : null,
    });

    const saved = await this.qrCodeRepo.save(qrCode);

    await this.producer.publishQrCodeGenerated(
      saved,
      certification.certificationNumber ?? '',
      certification.cooperativeId,
      correlationId,
    );

    this.logger.log(
      { qrCodeId: saved.id, certificationId },
      'QR code generated',
    );

    return saved;
  }

  /**
   * Verify a QR code by its HMAC signature.
   * Returns the full certification chain if valid.
   * Increments the scan counter on each verification.
   */
  async verifyQrCode(hmacSignature: string, scannedFromIp?: string): Promise<QrVerificationResult> {
    const qrCode = await this.qrCodeRepo.findOne({
      where: { hmacSignature, isActive: true },
    });

    if (!qrCode) {
      this.logger.warn({ hmacSignature }, 'QR code not found or inactive');
      return {
        valid: false,
        certification: null,
        qrCode: null,
        message: 'QR code not found or has been deactivated',
      };
    }

    // Check expiry
    if (qrCode.expiresAt && new Date() > qrCode.expiresAt) {
      this.logger.warn({ qrCodeId: qrCode.id }, 'QR code expired');
      return {
        valid: false,
        certification: null,
        qrCode,
        message: 'QR code has expired',
      };
    }

    const certification = await this.certificationRepo.findOne({
      where: { id: qrCode.certificationId },
    });

    if (!certification || certification.status !== 'granted') {
      return {
        valid: false,
        certification,
        qrCode,
        message: `Certification is not active (status: ${certification?.status ?? 'not found'})`,
      };
    }

    // Increment scan counter
    await this.qrCodeRepo.increment({ id: qrCode.id }, 'scansCount', 1);

    this.logger.log(
      { qrCodeId: qrCode.id, certificationId: qrCode.certificationId, scannedFromIp },
      'QR code scanned',
    );

    return {
      valid: true,
      certification,
      qrCode: { ...qrCode, scansCount: qrCode.scansCount + 1 },
      message: 'Certification is valid and active',
    };
  }

  async findByCertificationId(certificationId: string): Promise<QrCode | null> {
    return this.qrCodeRepo.findOne({
      where: { certificationId, isActive: true },
    });
  }

  /**
   * Deactivate all QR codes for a certification.
   * Called when a certification is revoked so QR scans immediately return an error.
   */
  async deactivateByCertificationId(certificationId: string): Promise<void> {
    await this.qrCodeRepo.update(
      { certificationId, isActive: true },
      { isActive: false },
    );
    this.logger.log({ certificationId }, 'QR codes deactivated for revoked certification');
  }
}
