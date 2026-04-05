import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inspection } from '../entities/inspection.entity';
import { InspectionReport } from '../entities/inspection-report.entity';
import { Certification } from '../entities/certification.entity';
import { ScheduleInspectionDto } from '../dto/schedule-inspection.dto';
import { CompleteInspectionDto } from '../dto/complete-inspection.dto';
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

    await this.certRepo.update({ id: dto.certificationId }, { status: 'inspection_scheduled' });
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
    correlationId: string,
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
      { status: 'inspection_completed' },
    );

    this.logger.log(
      { inspectionId: id, passed: dto.passed },
      'Inspection completed',
    );

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
}
