import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Certification, CertificationStatus } from '../entities/certification.entity';
import { RequestCertificationDto } from '../dto/request-certification.dto';
import { GrantCertificationDto } from '../dto/grant-certification.dto';
import { DenyCertificationDto } from '../dto/deny-certification.dto';
import { CertificationProducer } from '../events/certification.producer';
import { QrCodeService } from './qr-code.service';

/**
 * Certification service — manages the full certification lifecycle.
 * Certifications follow the state machine: pending -> inspection_scheduled ->
 * inspection_completed -> granted | denied | revoked | expired | renewed
 */
@Injectable()
export class CertificationService {
  private readonly logger = new Logger(CertificationService.name);

  constructor(
    @InjectRepository(Certification)
    private readonly certRepo: Repository<Certification>,
    private readonly producer: CertificationProducer,
    private readonly qrCodeService: QrCodeService,
    private readonly dataSource: DataSource,
  ) {}

  async requestCertification(
    dto: RequestCertificationDto,
    requestedBy: string,
    correlationId: string,
  ): Promise<Certification> {
    const certification = this.certRepo.create({
      cooperativeId: requestedBy, // In real flow, derived from user's cooperative
      cooperativeName: dto.cooperativeName,
      batchId: dto.batchId,
      productTypeCode: dto.productTypeCode,
      certificationType: dto.certificationType,
      regionCode: dto.regionCode,
      requestedBy,
      requestedAt: new Date(),
      status: 'pending',
      createdBy: requestedBy,
    });

    const saved = await this.certRepo.save(certification);
    await this.producer.publishCertificationRequested(saved, correlationId);
    return saved;
  }

  async findById(id: string): Promise<Certification> {
    const cert = await this.certRepo.findOne({ where: { id } });
    if (!cert) {
      throw new NotFoundException({
        code: 'CERTIFICATION_NOT_FOUND',
        message: `Certification ${id} not found`,
      });
    }
    return cert;
  }

  async findByCooperative(cooperativeId: string): Promise<Certification[]> {
    return this.certRepo.find({
      where: { cooperativeId },
      order: { createdAt: 'DESC' },
    });
  }

  async grantCertification(
    id: string,
    dto: GrantCertificationDto,
    grantedBy: string,
    correlationId: string,
  ): Promise<Certification> {
    const certification = await this.findById(id);

    if (!['pending', 'inspection_completed'].includes(certification.status)) {
      throw new BadRequestException({
        code: 'INVALID_CERTIFICATION_STATUS',
        message: `Cannot grant certification in status: ${certification.status}`,
      });
    }

    const certificationNumber = await this.generateCertificationNumber(certification);

    await this.certRepo.update(
      { id },
      {
        status: 'granted',
        certificationNumber,
        grantedBy,
        grantedAt: new Date(),
        validFrom: dto.validFrom,
        validUntil: dto.validUntil,
      },
    );

    const updated = await this.findById(id);

    // Generate QR code for the granted certification
    const qrCode = await this.qrCodeService.generateQrCode(id, correlationId);

    await this.producer.publishCertificationGranted(updated, qrCode.id, grantedBy, correlationId);

    this.logger.log(
      { certificationId: id, certificationNumber },
      'Certification granted',
    );

    return updated;
  }

  async denyCertification(
    id: string,
    dto: DenyCertificationDto,
    deniedBy: string,
    correlationId: string,
  ): Promise<Certification> {
    const certification = await this.findById(id);

    if (certification.status !== 'pending' && certification.status !== 'inspection_completed') {
      throw new BadRequestException({
        code: 'INVALID_CERTIFICATION_STATUS',
        message: `Cannot deny certification in status: ${certification.status}`,
      });
    }

    await this.certRepo.update(
      { id },
      {
        status: 'denied',
        deniedBy,
        deniedAt: new Date(),
        denialReason: dto.reason,
      },
    );

    const updated = await this.findById(id);
    await this.producer.publishCertificationDenied(updated, deniedBy, dto.reason, correlationId);
    return updated;
  }

  async revokeCertification(
    id: string,
    reason: string,
    revokedBy: string,
    correlationId: string,
  ): Promise<Certification> {
    const certification = await this.findById(id);

    if (certification.status !== 'granted') {
      throw new BadRequestException({
        code: 'INVALID_CERTIFICATION_STATUS',
        message: 'Only granted certifications can be revoked',
      });
    }

    await this.certRepo.update(
      { id },
      {
        status: 'revoked',
        revokedBy,
        revokedAt: new Date(),
        revocationReason: reason,
      },
    );

    // Deactivate the associated QR code so consumers scanning it get a revoked response
    await this.qrCodeService.deactivateByCertificationId(id);

    const updated = await this.findById(id);
    await this.producer.publishCertificationRevoked(updated, revokedBy, reason, correlationId);
    return updated;
  }

  /**
   * Generate a sequential certification number via a DB-backed counter.
   * Uses SELECT ... FOR UPDATE on certification_seq to avoid race conditions.
   * Format: TERROIR-{AOP|IGP|LA}-{REGION_CODE}-{YEAR}-{SEQ3}
   * Example: TERROIR-IGP-SFI-2025-042
   */
  private async generateCertificationNumber(certification: Certification): Promise<string> {
    const typeAbbr =
      certification.certificationType === 'LABEL_AGRICOLE'
        ? 'LA'
        : certification.certificationType;
    const year = new Date().getFullYear();

    const seq = await this.dataSource.transaction(async (manager) => {
      // Upsert the counter row, then lock it for atomic increment
      await manager.query(
        `INSERT INTO certification.certification_seq
           (certification_type, region_code, year, last_seq)
         VALUES ($1, $2, $3, 0)
         ON CONFLICT (certification_type, region_code, year) DO NOTHING`,
        [typeAbbr, certification.regionCode, year],
      );

      const rows = await manager.query(
        `UPDATE certification.certification_seq
            SET last_seq = last_seq + 1
          WHERE certification_type = $1
            AND region_code = $2
            AND year = $3
          RETURNING last_seq`,
        [typeAbbr, certification.regionCode, year],
      );

      return (rows[0] as { last_seq: number }).last_seq;
    });

    return `TERROIR-${typeAbbr}-${certification.regionCode}-${year}-${String(seq).padStart(3, '0')}`;
  }
}
