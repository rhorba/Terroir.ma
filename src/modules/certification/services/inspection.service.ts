import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PagedResult } from '../../../common/dto/pagination.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inspection } from '../entities/inspection.entity';
import { InspectionReport } from '../entities/inspection-report.entity';
import { Certification, CertificationStatus } from '../entities/certification.entity';
import { ScheduleInspectionDto } from '../dto/schedule-inspection.dto';
import { CompleteInspectionDto } from '../dto/complete-inspection.dto';
import { FileInspectionReportDto } from '../dto/file-inspection-report.dto';
import { CertificationProducer } from '../events/certification.producer';

/**
 * Inspection service — schedules and records field inspections for certifications.
 */
@Injectable()
export class InspectionService {
  private readonly logger = new Logger(InspectionService.name);

  constructor(
    @InjectRepository(Inspection)
    private readonly inspectionRepo: Repository<Inspection>,
    @InjectRepository(InspectionReport)
    private readonly reportRepo: Repository<InspectionReport>,
    @InjectRepository(Certification)
    private readonly certRepo: Repository<Certification>,
    private readonly producer: CertificationProducer,
  ) {}

  async scheduleInspection(
    dto: ScheduleInspectionDto,
    createdBy: string,
    correlationId: string,
  ): Promise<Inspection> {
    const cert = await this.certRepo.findOne({ where: { id: dto.certificationId } });
    if (!cert) {
      throw new NotFoundException({
        code: 'CERTIFICATION_NOT_FOUND',
        message: `Certification ${dto.certificationId} not found`,
      });
    }

    const inspection = this.inspectionRepo.create({
      certificationId: dto.certificationId,
      cooperativeId: cert.cooperativeId,
      inspectorId: dto.inspectorId,
      inspectorName: dto.inspectorName ?? null,
      scheduledDate: dto.scheduledDate,
      farmIds: dto.farmIds,
      status: 'scheduled',
      createdBy,
    });

    const saved = await this.inspectionRepo.save(inspection);

    await this.certRepo.update(
      { id: dto.certificationId },
      { currentStatus: CertificationStatus.INSPECTION_SCHEDULED },
    );
    await this.producer.publishInspectionScheduled(saved, correlationId);

    this.logger.log(
      { inspectionId: saved.id, certificationId: dto.certificationId },
      'Inspection scheduled',
    );

    return saved;
  }

  async completeInspection(
    id: string,
    dto: CompleteInspectionDto,
    inspectorId: string,
    _correlationId: string,
  ): Promise<InspectionReport> {
    const inspection = await this.inspectionRepo.findOne({ where: { id } });
    if (!inspection) {
      throw new NotFoundException({
        code: 'INSPECTION_NOT_FOUND',
        message: `Inspection ${id} not found`,
      });
    }

    if (inspection.status !== 'scheduled' && inspection.status !== 'in_progress') {
      throw new BadRequestException({
        code: 'INVALID_INSPECTION_STATUS',
        message: `Cannot complete inspection in status: ${inspection.status}`,
      });
    }

    const completedAt = new Date();

    await this.inspectionRepo.update(
      { id },
      { status: 'completed', completedAt, passed: dto.passed },
    );

    const report = this.reportRepo.create({
      inspectionId: id,
      certificationId: inspection.certificationId,
      cooperativeId: inspection.cooperativeId,
      inspectorId,
      passed: dto.passed,
      summary: dto.summary,
      farmFindings: dto.farmFindings ?? [],
      nonConformities: dto.nonConformities ?? [],
      completedAt,
    });

    const savedReport = await this.reportRepo.save(report);

    await this.certRepo.update(
      { id: inspection.certificationId },
      { currentStatus: CertificationStatus.INSPECTION_COMPLETE },
    );

    this.logger.log({ inspectionId: id, passed: dto.passed }, 'Inspection completed');

    return savedReport;
  }

  async findById(id: string): Promise<Inspection> {
    const inspection = await this.inspectionRepo.findOne({ where: { id } });
    if (!inspection) {
      throw new NotFoundException({
        code: 'INSPECTION_NOT_FOUND',
        message: `Inspection ${id} not found`,
      });
    }
    return inspection;
  }

  async findByCertification(certificationId: string): Promise<Inspection[]> {
    return this.inspectionRepo.find({
      where: { certificationId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Returns paginated inspections assigned to a specific inspector.
   * Used by the inspector /my endpoint to show their scheduled workload (US-043).
   */
  async findByInspectorId(
    inspectorId: string,
    page: number,
    limit: number,
  ): Promise<PagedResult<Inspection>> {
    const [data, total] = await this.inspectionRepo.findAndCount({
      where: { inspectorId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, meta: { page, limit, total } };
  }

  async fileReport(
    id: string,
    dto: FileInspectionReportDto,
    inspectorId: string,
    correlationId: string,
  ): Promise<Inspection> {
    const completeDto: CompleteInspectionDto = {
      passed: dto.passed,
      summary: dto.reportSummary,
      farmFindings: [],
      nonConformities: dto.nonConformities
        ? [{ code: 'NC-001', description: dto.nonConformities, severity: 'minor' }]
        : [],
    };
    await this.completeInspection(id, completeDto, inspectorId, correlationId);
    return this.findById(id);
  }
}
