import { Injectable, NotFoundException, Logger, Inject } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { CertificationStatus } from '../entities/certification.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { QrCode } from '../entities/qr-code.entity';
import { Certification } from '../entities/certification.entity';
import { CertificationProducer } from '../events/certification.producer';

export interface QrDownloadResult {
  buffer: Buffer;
  mimeType: string;
  filename: string;
}

export interface QrVerificationResult {
  valid: boolean;
  certification: Certification | null;
  qrCode: QrCode | null;
  message: string;
  newCertificationNumber?: string | null; // populated when certification is RENEWED
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
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
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
    await this.qrCodeRepo.update({ certificationId, isActive: true }, { isActive: false });

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
      expiresAt: certification.validUntil ? new Date(certification.validUntil) : null,
    });

    const saved = await this.qrCodeRepo.save(qrCode);

    await this.producer.publishQrCodeGenerated(
      saved,
      certification.certificationNumber ?? '',
      certification.cooperativeId,
      correlationId,
    );

    this.logger.log({ qrCodeId: saved.id, certificationId }, 'QR code generated');

    return saved;
  }

  /**
   * Verify a QR code by its HMAC signature.
   * Returns the full certification chain if valid.
   * Increments the scan counter on each verification.
   */
  async verifyQrCode(hmacSignature: string, scannedFromIp?: string): Promise<QrVerificationResult> {
    const cacheKey = `qr:verify:${hmacSignature}`;
    const cached = await this.cacheManager.get<QrVerificationResult>(cacheKey);
    if (cached) {
      this.logger.debug({ hmacSignature }, 'QR verify cache hit');
      return cached;
    }

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

    if (!certification) {
      return {
        valid: false,
        certification: null,
        qrCode,
        message: 'Certification not found',
      };
    }

    if (certification.currentStatus === CertificationStatus.RENEWED) {
      // Find successor cert to surface its number to the consumer
      const successor = await this.certificationRepo.findOne({
        where: { renewedFromId: certification.id },
      });
      await this.qrCodeRepo.increment({ id: qrCode.id }, 'scansCount', 1);
      const renewedResult: QrVerificationResult = {
        valid: false,
        certification,
        qrCode: { ...qrCode, scansCount: qrCode.scansCount + 1 },
        newCertificationNumber: successor?.certificationNumber ?? null,
        message: successor?.certificationNumber
          ? `Certificate renewed. New certificate: ${successor.certificationNumber}`
          : 'Certificate has been renewed. New certificate pending issuance.',
      };
      await this.cacheManager.set(cacheKey, renewedResult, 300_000);
      return renewedResult;
    }

    if (certification.currentStatus !== CertificationStatus.GRANTED) {
      return {
        valid: false,
        certification,
        qrCode,
        message: `Certification is not active (status: ${certification.currentStatus})`,
      };
    }

    // Increment scan counter
    await this.qrCodeRepo.increment({ id: qrCode.id }, 'scansCount', 1);

    this.logger.log(
      { qrCodeId: qrCode.id, certificationId: qrCode.certificationId, scannedFromIp },
      'QR code scanned',
    );

    const grantedResult: QrVerificationResult = {
      valid: true,
      certification,
      qrCode: { ...qrCode, scansCount: qrCode.scansCount + 1 },
      message: 'Certification is valid and active',
    };
    await this.cacheManager.set(cacheKey, grantedResult, 300_000);
    return grantedResult;
  }

  async findByCertificationId(certificationId: string): Promise<QrCode | null> {
    return this.qrCodeRepo.findOne({
      where: { certificationId, isActive: true },
    });
  }

  /**
   * Deactivate all QR codes for a certification.
   * Called when a certification is revoked so QR scans immediately return an error.
   * Evicts the Redis cache entry before deactivating so the next scan hits the DB.
   */
  async deactivateByCertificationId(certificationId: string): Promise<void> {
    const qr = await this.qrCodeRepo.findOne({ where: { certificationId, isActive: true } });
    if (qr) {
      await this.cacheManager.del(`qr:verify:${qr.hmacSignature}`);
    }
    await this.qrCodeRepo.update({ certificationId, isActive: true }, { isActive: false });
    this.logger.log({ certificationId }, 'QR codes deactivated for revoked certification');
  }

  /**
   * Evict cached QR verification result for a certification.
   * Called when a certification transitions to RENEWED so the old token
   * immediately stops returning valid: true to consumers.
   */
  async evictQrCache(certificationId: string): Promise<void> {
    const qr = await this.qrCodeRepo.findOne({ where: { certificationId, isActive: true } });
    if (qr) {
      await this.cacheManager.del(`qr:verify:${qr.hmacSignature}`);
      this.logger.debug({ certificationId }, 'QR cache evicted on renewal');
    }
  }

  /**
   * Generate a QR code image for download by cooperative admins (US-057).
   * Returns a PNG buffer or SVG buffer for the active QR code of a certification.
   * Certification must be GRANTED or RENEWED.
   */
  async downloadQrCode(certificationId: string, format: 'png' | 'svg'): Promise<QrDownloadResult> {
    const certification = await this.certificationRepo.findOne({
      where: { id: certificationId },
    });
    if (
      !certification ||
      (certification.currentStatus !== CertificationStatus.GRANTED &&
        certification.currentStatus !== CertificationStatus.RENEWED)
    ) {
      throw new NotFoundException({
        code: 'CERTIFICATION_NOT_FOUND_OR_NOT_GRANTED',
        message: `Certification ${certificationId} not found or not in GRANTED/RENEWED status`,
      });
    }

    const qrCode = await this.qrCodeRepo.findOne({
      where: { certificationId, isActive: true },
    });
    if (!qrCode) {
      throw new NotFoundException({
        code: 'QR_CODE_NOT_FOUND',
        message: `No active QR code found for certification ${certificationId}`,
      });
    }

    const filename = `${certification.certificationNumber ?? certificationId}.${format}`;

    if (format === 'svg') {
      const svgString = await QRCode.toString(qrCode.verificationUrl, { type: 'svg' });
      return { buffer: Buffer.from(svgString), mimeType: 'image/svg+xml', filename };
    }

    const buffer = await QRCode.toBuffer(qrCode.verificationUrl);
    return { buffer, mimeType: 'image/png', filename };
  }
}
