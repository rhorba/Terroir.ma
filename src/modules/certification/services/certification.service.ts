import { Injectable, NotFoundException, BadRequestException, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, FindOptionsWhere, Between } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import {
  CertificationStats,
  CooperativeComplianceRow,
  OnssaCertRow,
  CertificationAnalytics,
} from '../interfaces/certification-stats.interface';
import { ExportQueryDto } from '../dto/export-query.dto';
import { PagedResult } from '../../../common/dto/pagination.dto';
import {
  Certification,
  CertificationStatus,
  CertificationEventType,
} from '../entities/certification.entity';
import { CertificationEvent } from '../entities/certification-event.entity';
import { RequestCertificationDto } from '../dto/request-certification.dto';
import { GrantCertificationDto } from '../dto/grant-certification.dto';
import { DenyCertificationDto } from '../dto/deny-certification.dto';
import { ScheduleInspectionDto } from '../dto/schedule-inspection.dto';
import { CompleteInspectionDto } from '../dto/complete-inspection.dto';
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
    @InjectRepository(CertificationEvent)
    private readonly eventRepo: Repository<CertificationEvent>,
    private readonly producer: CertificationProducer,
    private readonly qrCodeService: QrCodeService,
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * Idempotency guard — returns true if an event with this correlationId has already
   * been recorded in the certification_events ledger, preventing duplicate processing.
   */
  async isEventProcessed(correlationId: string): Promise<boolean> {
    const count = await this.eventRepo.count({ where: { correlationId } });
    return count > 0;
  }

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
      currentStatus: CertificationStatus.DRAFT,
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

  /**
   * Returns paginated certifications with actionable statuses for certification-body officers.
   * "Pending" = any status where the cert body has an outstanding action to take.
   */
  async findPending(page: number, limit: number): Promise<PagedResult<Certification>> {
    const pendingStatuses = [
      CertificationStatus.SUBMITTED,
      CertificationStatus.DOCUMENT_REVIEW,
      CertificationStatus.LAB_RESULTS_RECEIVED,
      CertificationStatus.UNDER_REVIEW,
    ];
    const [data, total] = await this.certRepo.findAndCount({
      where: { currentStatus: In(pendingStatuses) },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, meta: { page, limit, total } };
  }

  /**
   * Returns all certifications for a cooperative with pagination.
   * Used by cooperative-admin to view their full certification portfolio (US-049).
   */
  async findByCooperativePaginated(
    cooperativeId: string,
    page: number,
    limit: number,
  ): Promise<PagedResult<Certification>> {
    const [data, total] = await this.certRepo.findAndCount({
      where: { cooperativeId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, meta: { page, limit, total } };
  }

  async grantCertification(
    id: string,
    dto: GrantCertificationDto,
    grantedBy: string,
    actorRole: string,
    correlationId: string,
  ): Promise<Certification> {
    const cert = await this.findById(id);
    this.assertStatus(cert, CertificationStatus.UNDER_REVIEW);

    const certificationNumber = await this.generateCertificationNumber(cert);

    // Set audit fields on entity before applyTransition saves atomically
    cert.certificationNumber = certificationNumber;
    cert.grantedBy = grantedBy;
    cert.grantedAt = new Date();
    cert.validFrom = dto.validFrom;
    cert.validUntil = dto.validUntil;

    const updated = await this.applyTransition(
      cert,
      CertificationEventType.DECISION_GRANTED,
      CertificationStatus.GRANTED,
      grantedBy,
      actorRole,
      { certificationNumber, validFrom: dto.validFrom, validUntil: dto.validUntil },
      correlationId,
    );

    const qrCode = await this.qrCodeService.generateQrCode(updated.id, correlationId);
    await this.producer.publishCertificationGranted(updated, qrCode.id, grantedBy, correlationId);

    this.logger.log({ certificationId: id, certificationNumber }, 'Certification granted');
    return updated;
  }

  async denyCertification(
    id: string,
    dto: DenyCertificationDto,
    deniedBy: string,
    actorRole: string,
    correlationId: string,
  ): Promise<Certification> {
    const cert = await this.findById(id);
    this.assertStatus(cert, CertificationStatus.UNDER_REVIEW);

    cert.deniedBy = deniedBy;
    cert.deniedAt = new Date();
    cert.denialReason = dto.reason;

    const updated = await this.applyTransition(
      cert,
      CertificationEventType.DECISION_DENIED,
      CertificationStatus.DENIED,
      deniedBy,
      actorRole,
      { reason: dto.reason },
      correlationId,
    );

    await this.producer.publishCertificationDenied(updated, deniedBy, dto.reason, correlationId);
    return updated;
  }

  async revokeCertification(
    id: string,
    reason: string,
    revokedBy: string,
    actorRole: string,
    correlationId: string,
  ): Promise<Certification> {
    const cert = await this.findById(id);
    this.assertStatus(cert, CertificationStatus.GRANTED);

    cert.revokedBy = revokedBy;
    cert.revokedAt = new Date();
    cert.revocationReason = reason;

    const updated = await this.applyTransition(
      cert,
      CertificationEventType.CERTIFICATE_REVOKED,
      CertificationStatus.REVOKED,
      revokedBy,
      actorRole,
      { reason },
      correlationId,
    );

    // Deactivate the associated QR code so consumers scanning it get a revoked response
    await this.qrCodeService.deactivateByCertificationId(updated.id);
    await this.producer.publishCertificationRevoked(updated, revokedBy, reason, correlationId);
    return updated;
  }

  // ─── State Machine: Steps 1–7 ─────────────────────────────────────────────

  /**
   * Step 1: cooperative-admin submits a DRAFT certification request.
   * DRAFT → SUBMITTED
   */
  async submitRequest(
    id: string,
    actorId: string,
    actorRole: string,
    correlationId: string,
  ): Promise<Certification> {
    const cert = await this.findById(id);
    this.assertStatus(cert, CertificationStatus.DRAFT);
    const updated = await this.applyTransition(
      cert,
      CertificationEventType.REQUEST_SUBMITTED,
      CertificationStatus.SUBMITTED,
      actorId,
      actorRole,
      null,
      correlationId,
    );
    await this.producer.publishCertificationRequested(updated, correlationId);
    return updated;
  }

  /**
   * Step 2: certification-body starts document review.
   * SUBMITTED → DOCUMENT_REVIEW
   */
  async startReview(
    id: string,
    remarks: string | null,
    actorId: string,
    actorRole: string,
    correlationId: string,
  ): Promise<Certification> {
    const cert = await this.findById(id);
    this.assertStatus(cert, CertificationStatus.SUBMITTED);
    return this.applyTransition(
      cert,
      CertificationEventType.REVIEW_STARTED,
      CertificationStatus.DOCUMENT_REVIEW,
      actorId,
      actorRole,
      { remarks },
      correlationId,
    );
  }

  /**
   * Step 3: certification-body schedules a field inspection.
   * DOCUMENT_REVIEW → INSPECTION_SCHEDULED
   */
  async scheduleInspectionChain(
    id: string,
    dto: ScheduleInspectionDto,
    actorId: string,
    actorRole: string,
    correlationId: string,
  ): Promise<Certification> {
    const cert = await this.findById(id);
    this.assertStatus(cert, CertificationStatus.DOCUMENT_REVIEW);
    return this.applyTransition(
      cert,
      CertificationEventType.INSPECTION_SCHEDULED,
      CertificationStatus.INSPECTION_SCHEDULED,
      actorId,
      actorRole,
      { inspectorId: dto.inspectorId, scheduledDate: dto.scheduledDate, farmIds: dto.farmIds },
      correlationId,
    );
  }

  /**
   * Step 4: inspector starts the field visit.
   * INSPECTION_SCHEDULED → INSPECTION_IN_PROGRESS
   */
  async startInspection(
    id: string,
    actorId: string,
    actorRole: string,
    correlationId: string,
  ): Promise<Certification> {
    const cert = await this.findById(id);
    this.assertStatus(cert, CertificationStatus.INSPECTION_SCHEDULED);
    return this.applyTransition(
      cert,
      CertificationEventType.INSPECTION_STARTED,
      CertificationStatus.INSPECTION_IN_PROGRESS,
      actorId,
      actorRole,
      { startedAt: new Date().toISOString() },
      correlationId,
    );
  }

  /**
   * Step 5: inspector files the completed inspection report.
   * INSPECTION_IN_PROGRESS → INSPECTION_COMPLETE
   */
  async completeInspectionChain(
    id: string,
    dto: CompleteInspectionDto,
    actorId: string,
    actorRole: string,
    correlationId: string,
  ): Promise<Certification> {
    const cert = await this.findById(id);
    this.assertStatus(cert, CertificationStatus.INSPECTION_IN_PROGRESS);
    return this.applyTransition(
      cert,
      CertificationEventType.INSPECTION_COMPLETED,
      CertificationStatus.INSPECTION_COMPLETE,
      actorId,
      actorRole,
      { passed: dto.passed, summary: dto.summary },
      correlationId,
    );
  }

  /**
   * Step 6: certification-body requests lab testing.
   * INSPECTION_COMPLETE → LAB_TESTING
   */
  async requestLab(
    id: string,
    labId: string | null,
    remarks: string | null,
    actorId: string,
    actorRole: string,
    correlationId: string,
  ): Promise<Certification> {
    const cert = await this.findById(id);
    this.assertStatus(cert, CertificationStatus.INSPECTION_COMPLETE);
    return this.applyTransition(
      cert,
      CertificationEventType.LAB_REQUESTED,
      CertificationStatus.LAB_TESTING,
      actorId,
      actorRole,
      { labId, remarks },
      correlationId,
    );
  }

  /**
   * Step 7 (internal — called from Kafka listener, not REST).
   * LAB_TESTING → LAB_RESULTS_RECEIVED
   * Triggered by product.lab.test.completed event.
   */
  async receiveLabResults(
    batchId: string,
    labTestId: string,
    passed: boolean,
    correlationId: string,
  ): Promise<void> {
    const cert = await this.certRepo.findOne({
      where: { batchId, currentStatus: CertificationStatus.LAB_TESTING },
    });
    if (!cert) {
      this.logger.warn({ batchId }, 'No LAB_TESTING certification found for this batch — skipping');
      return;
    }
    await this.applyTransition(
      cert,
      CertificationEventType.LAB_RESULTS_RECEIVED,
      CertificationStatus.LAB_RESULTS_RECEIVED,
      'system',
      'service-account',
      { labTestId, passed, receivedAt: new Date().toISOString() },
      correlationId,
    );
  }

  /**
   * Step 12: cooperative-admin renews a granted certification.
   * Old cert: GRANTED → RENEWED (QR stays active — returns "superseded" to consumers).
   * New cert: created in DRAFT with renewedFromId pointing to old cert.
   * Returns the new DRAFT certification.
   */
  async renewCertification(
    id: string,
    actorId: string,
    actorRole: string,
    correlationId: string,
  ): Promise<Certification> {
    const oldCert = await this.findById(id);
    this.assertStatus(oldCert, CertificationStatus.GRANTED);

    // Move old cert to RENEWED — QR stays active, returns "superseded" response
    await this.applyTransition(
      oldCert,
      CertificationEventType.CERTIFICATE_RENEWED,
      CertificationStatus.RENEWED,
      actorId,
      actorRole,
      null,
      correlationId,
    );

    // Evict cached QR result — old cert is now RENEWED, cache must not serve valid: true
    await this.qrCodeService.evictQrCache(oldCert.id);

    // Create new DRAFT cert linked to old cert
    const newCert = this.certRepo.create({
      cooperativeId: oldCert.cooperativeId,
      cooperativeName: oldCert.cooperativeName,
      batchId: oldCert.batchId,
      productTypeCode: oldCert.productTypeCode,
      certificationType: oldCert.certificationType,
      regionCode: oldCert.regionCode,
      requestedBy: actorId,
      requestedAt: new Date(),
      currentStatus: CertificationStatus.DRAFT,
      createdBy: actorId,
      renewedFromId: oldCert.id,
    });
    const saved = await this.certRepo.save(newCert);

    await this.producer.publishCertificationRenewed(oldCert, saved.id, actorId, correlationId);

    this.logger.log(
      { oldCertId: oldCert.id, newCertId: saved.id },
      'Certification renewal initiated',
    );
    return saved;
  }

  /**
   * Step 8: certification-body moves to final review.
   * LAB_RESULTS_RECEIVED → UNDER_REVIEW
   */
  async startFinalReview(
    id: string,
    actorId: string,
    actorRole: string,
    correlationId: string,
  ): Promise<Certification> {
    const cert = await this.findById(id);
    this.assertStatus(cert, CertificationStatus.LAB_RESULTS_RECEIVED);
    const updated = await this.applyTransition(
      cert,
      CertificationEventType.FINAL_REVIEW_STARTED,
      CertificationStatus.UNDER_REVIEW,
      actorId,
      actorRole,
      null,
      correlationId,
    );
    await this.producer.publishFinalReviewStarted(updated, actorId, correlationId);
    return updated;
  }

  /**
   * Returns certification counts grouped by status, region, and product type.
   * Results cached in Redis for 300s. US-048.
   */
  async getStats(from?: string, to?: string): Promise<CertificationStats> {
    const fromKey = from ?? 'all';
    const toKey = to ?? 'all';
    const cacheKey = `stats:certifications:${fromKey}:${toKey}`;

    const cached = await this.cacheManager.get<CertificationStats>(cacheKey);
    if (cached) return cached;

    const params: string[] = from && to ? [from, to] : [];
    const dateFilter = from && to ? `WHERE requested_at BETWEEN $1::date AND $2::date` : '';

    const [byStatus, byRegion, byProductType] = await Promise.all([
      this.dataSource.query<{ current_status: string; count: string }[]>(
        `SELECT current_status, COUNT(*)::int AS count
         FROM certification.certification ${dateFilter}
         GROUP BY current_status ORDER BY count DESC`,
        params,
      ),
      this.dataSource.query<{ region_code: string; count: string }[]>(
        `SELECT region_code, COUNT(*)::int AS count
         FROM certification.certification ${dateFilter}
         GROUP BY region_code ORDER BY count DESC`,
        params,
      ),
      this.dataSource.query<{ product_type_code: string; count: string }[]>(
        `SELECT product_type_code, COUNT(*)::int AS count
         FROM certification.certification ${dateFilter}
         GROUP BY product_type_code ORDER BY count DESC`,
        params,
      ),
    ]);

    const stats: CertificationStats = {
      period: { from: from ?? null, to: to ?? null },
      byStatus: byStatus.map((r) => ({ status: r.current_status, count: Number(r.count) })),
      byRegion: byRegion.map((r) => ({ regionCode: r.region_code, count: Number(r.count) })),
      byProductType: byProductType.map((r) => ({
        productTypeCode: r.product_type_code,
        count: Number(r.count),
      })),
    };

    await this.cacheManager.set(cacheKey, stats, 300_000);
    return stats;
  }

  /**
   * Export all certifications as a flat array for MAPMDREF regulatory reporting.
   * US-084: super-admin and certification-body.
   * Capped at 10,000 rows. Optional date range and status filters.
   */
  async exportForMapmdref(query: ExportQueryDto): Promise<Certification[]> {
    const where: FindOptionsWhere<Certification> = {};
    if (query.status) where.currentStatus = query.status;
    if (query.from && query.to) {
      where.requestedAt = Between(new Date(query.from), new Date(query.to));
    }

    return this.certRepo.find({
      where,
      order: { requestedAt: 'DESC' },
      take: 10_000,
    });
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  /**
   * Guards a state transition — throws BadRequestException if the certification
   * is not in the expected status. Call at the top of every transition method.
   */
  private assertStatus(cert: Certification, expected: CertificationStatus): void {
    if (cert.currentStatus !== expected) {
      throw new BadRequestException(
        `Invalid transition: certification ${cert.id} is in status ` +
          `${cert.currentStatus}, expected ${expected}`,
      );
    }
  }

  /**
   * Atomically: inserts a CertificationEvent row, updates currentStatus on Certification,
   * then returns the updated entity — all within a single DB transaction.
   * Kafka publishing happens AFTER the transaction succeeds.
   */
  private async applyTransition(
    cert: Certification,
    eventType: CertificationEventType,
    toStatus: CertificationStatus,
    actorId: string,
    actorRole: string,
    payload: Record<string, unknown> | null,
    correlationId: string,
  ): Promise<Certification> {
    return this.dataSource.transaction(async (em) => {
      const event = em.create(CertificationEvent, {
        certificationId: cert.id,
        eventType,
        fromStatus: cert.currentStatus,
        toStatus,
        actorId,
        actorRole,
        payload: payload,
        correlationId,
      });
      await em.save(CertificationEvent, event);
      cert.currentStatus = toStatus;
      return em.save(Certification, cert);
    });
  }

  /**
   * Generate a sequential certification number via a DB-backed counter.
   * Uses SELECT ... FOR UPDATE on certification_seq to avoid race conditions.
   * Format: TERROIR-{AOP|IGP|LA}-{REGION_CODE}-{YEAR}-{SEQ3}
   * Example: TERROIR-IGP-SFI-2025-042
   */
  private async generateCertificationNumber(certification: Certification): Promise<string> {
    const typeAbbr =
      certification.certificationType === 'LABEL_AGRICOLE' ? 'LA' : certification.certificationType;
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

      // TypeORM manager.query() for DML returns [resultRows, affectedCount]
      const [resultRows] = (await manager.query(
        `UPDATE certification.certification_seq
            SET last_seq = last_seq + 1
          WHERE certification_type = $1
            AND region_code = $2
            AND year = $3
          RETURNING last_seq`,
        [typeAbbr, certification.regionCode, year],
      )) as [{ last_seq: number }[], number];

      if (!resultRows[0]) {
        throw new Error(
          `certification_seq counter missing for ${typeAbbr}/${certification.regionCode}/${year}`,
        );
      }
      return resultRows[0].last_seq;
    });

    return `TERROIR-${typeAbbr}-${certification.regionCode}-${year}-${String(seq).padStart(3, '0')}`;
  }

  /**
   * US-083: Aggregate certification counts grouped by cooperative.
   * cooperativeName is denormalized on the Certification entity — no cross-module join needed.
   * Optional date range filters on requested_at.
   */
  async complianceReport(from?: string, to?: string): Promise<CooperativeComplianceRow[]> {
    const params: string[] = [];
    let dateFilter = '';
    if (from && to) {
      params.push(from, to);
      dateFilter = `AND requested_at BETWEEN $1::date AND $2::date + INTERVAL '1 day'`;
    }

    const rows = await this.dataSource.query<Record<string, unknown>[]>(
      `SELECT
        cooperative_id AS "cooperativeId",
        cooperative_name AS "cooperativeName",
        COUNT(*) AS "totalRequests",
        COUNT(*) FILTER (WHERE current_status IN (
          'SUBMITTED','DOCUMENT_REVIEW','INSPECTION_SCHEDULED',
          'INSPECTION_IN_PROGRESS','INSPECTION_COMPLETE',
          'LAB_TESTING','LAB_RESULTS_RECEIVED','UNDER_REVIEW'
        )) AS pending,
        COUNT(*) FILTER (WHERE current_status = 'GRANTED') AS granted,
        COUNT(*) FILTER (WHERE current_status = 'DENIED') AS denied,
        COUNT(*) FILTER (WHERE current_status = 'REVOKED') AS revoked,
        COUNT(*) FILTER (WHERE current_status = 'RENEWED') AS renewed
       FROM certification.certification
       WHERE deleted_at IS NULL ${dateFilter}
       GROUP BY cooperative_id, cooperative_name
       ORDER BY "totalRequests" DESC`,
      params,
    );

    return rows.map((r) => ({
      cooperativeId: r['cooperativeId'] as string,
      cooperativeName: r['cooperativeName'] as string,
      totalRequests: Number(r['totalRequests']),
      pending: Number(r['pending']),
      granted: Number(r['granted']),
      denied: Number(r['denied']),
      revoked: Number(r['revoked']),
      renewed: Number(r['renewed']),
    }));
  }

  /**
   * US-089: List all currently GRANTED certifications for ONSSA compliance verification.
   * Optional date range filters on granted_at.
   */
  async onssaReport(from?: string, to?: string): Promise<OnssaCertRow[]> {
    const params: string[] = [];
    let dateFilter = '';
    if (from && to) {
      params.push(from, to);
      dateFilter = `AND granted_at BETWEEN $1::date AND $2::date + INTERVAL '1 day'`;
    }

    return this.dataSource.query<OnssaCertRow[]>(
      `SELECT
        certification_number AS "certificationNumber",
        cooperative_name AS "cooperativeName",
        product_type_code AS "productTypeCode",
        region_code AS "regionCode",
        certification_type AS "certificationType",
        granted_at AS "grantedAt",
        valid_from AS "validFrom",
        valid_until AS "validUntil"
       FROM certification.certification
       WHERE current_status = 'GRANTED'
         AND deleted_at IS NULL
         ${dateFilter}
       ORDER BY granted_at DESC`,
      params,
    );
  }

  /**
   * US-082: Returns certification counts grouped by region and by product type.
   * Supports optional date range filter. Redis-cached for 300s.
   */
  async getAnalytics(from?: string, to?: string): Promise<CertificationAnalytics> {
    const cacheKey = `analytics:certifications:${from ?? 'all'}:${to ?? 'all'}`;
    const cached = await this.cacheManager.get<CertificationAnalytics>(cacheKey);
    if (cached) return cached;

    const params: string[] = [];
    let dateFilter = '';
    if (from && to) {
      params.push(from, to);
      dateFilter = `AND created_at BETWEEN $1::date AND $2::date + INTERVAL '1 day'`;
    } else if (from) {
      params.push(from);
      dateFilter = `AND created_at >= $1::date`;
    } else if (to) {
      params.push(to);
      dateFilter = `AND created_at <= $1::date + INTERVAL '1 day'`;
    }

    const [regionRows, productRows] = await Promise.all([
      this.dataSource.query<Array<Record<string, string>>>(
        `SELECT
          region_code AS region,
          COUNT(*) FILTER (WHERE current_status = 'GRANTED') AS granted,
          COUNT(*) FILTER (WHERE current_status = 'DENIED') AS denied,
          COUNT(*) FILTER (WHERE current_status = 'REVOKED') AS revoked,
          COUNT(*) AS total
        FROM certification.certification
        WHERE deleted_at IS NULL ${dateFilter}
        GROUP BY region_code
        ORDER BY total DESC`,
        params,
      ),
      this.dataSource.query<Array<Record<string, string>>>(
        `SELECT
          product_type_code AS product_type,
          COUNT(*) FILTER (WHERE current_status = 'GRANTED') AS granted,
          COUNT(*) FILTER (WHERE current_status = 'DENIED') AS denied,
          COUNT(*) FILTER (WHERE current_status = 'REVOKED') AS revoked,
          COUNT(*) AS total
        FROM certification.certification
        WHERE deleted_at IS NULL ${dateFilter}
        GROUP BY product_type_code
        ORDER BY total DESC`,
        params,
      ),
    ]);

    const n = (v: string | undefined) => Number(v ?? 0);

    const result: CertificationAnalytics = {
      period: { from: from ?? null, to: to ?? null },
      byRegion: regionRows.map((r) => ({
        region: r['region'] ?? '',
        granted: n(r['granted']),
        denied: n(r['denied']),
        revoked: n(r['revoked']),
        total: n(r['total']),
      })),
      byProductType: productRows.map((r) => ({
        productType: r['product_type'] ?? '',
        granted: n(r['granted']),
        denied: n(r['denied']),
        revoked: n(r['revoked']),
        total: n(r['total']),
      })),
      generatedAt: new Date().toISOString(),
    };

    await this.cacheManager.set(cacheKey, result, 300_000);
    return result;
  }

  /**
   * US-050: Export certification compliance report as a CSV string.
   * Columns: certificationNumber, cooperativeName, productTypeCode, regionCode,
   *          certificationType, currentStatus, validFrom, validUntil, grantedAt
   */
  async exportComplianceReport(from?: string, to?: string, status?: string): Promise<string> {
    const qb = this.certRepo
      .createQueryBuilder('c')
      .select('c.certificationNumber', 'certificationNumber')
      .addSelect('c.cooperativeName', 'cooperativeName')
      .addSelect('c.productTypeCode', 'productTypeCode')
      .addSelect('c.regionCode', 'regionCode')
      .addSelect('c.certificationType', 'certificationType')
      .addSelect('c.currentStatus', 'currentStatus')
      .addSelect('c.validFrom', 'validFrom')
      .addSelect('c.validUntil', 'validUntil')
      .addSelect('c.grantedAt', 'grantedAt')
      .where('c.deletedAt IS NULL')
      .orderBy('c.grantedAt', 'DESC');

    if (from) qb.andWhere('c.createdAt >= :from', { from });
    if (to) qb.andWhere('c.createdAt <= :to', { to });
    if (status) qb.andWhere('c.currentStatus = :status', { status });

    const rows = await qb.getRawMany<{
      certificationNumber: string | null;
      cooperativeName: string;
      productTypeCode: string;
      regionCode: string;
      certificationType: string;
      currentStatus: string;
      validFrom: Date | null;
      validUntil: Date | null;
      grantedAt: Date | null;
    }>();

    const header =
      'certificationNumber,cooperativeName,productTypeCode,regionCode,' +
      'certificationType,currentStatus,validFrom,validUntil,grantedAt';

    const csvRows = rows.map((r) =>
      [
        r.certificationNumber ?? '',
        `"${r.cooperativeName.replace(/"/g, '""')}"`,
        r.productTypeCode,
        r.regionCode,
        r.certificationType,
        r.currentStatus,
        r.validFrom ? r.validFrom.toISOString() : '',
        r.validUntil ? r.validUntil.toISOString() : '',
        r.grantedAt ? r.grantedAt.toISOString() : '',
      ].join(','),
    );

    return [header, ...csvRows].join('\n');
  }
}
