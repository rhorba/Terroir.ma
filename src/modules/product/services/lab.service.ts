import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lab } from '../entities/lab.entity';
import { CreateLabDto } from '../dto/create-lab.dto';

/**
 * Lab service — manages the ONSSA-accredited laboratory registry.
 * Accreditation is metadata only in v1; no enforcement on lab-test submission (Phase 2).
 * US-030
 */
@Injectable()
export class LabService {
  private readonly logger = new Logger(LabService.name);

  constructor(
    @InjectRepository(Lab)
    private readonly labRepo: Repository<Lab>,
  ) {}

  /** Register a new laboratory. */
  async create(dto: CreateLabDto): Promise<Lab> {
    const lab = this.labRepo.create({
      name: dto.name,
      onssaAccreditationNumber: dto.onssaAccreditationNumber ?? null,
      isAccredited: false,
      accreditedAt: null,
    });
    return this.labRepo.save(lab);
  }

  /** List all laboratories, newest first. */
  async findAll(): Promise<Lab[]> {
    return this.labRepo.find({ order: { createdAt: 'DESC' } });
  }

  /** Find a laboratory by ID. */
  async findById(id: string): Promise<Lab> {
    const lab = await this.labRepo.findOne({ where: { id } });
    if (!lab) {
      throw new NotFoundException({ code: 'LAB_NOT_FOUND', message: `Lab ${id} not found` });
    }
    return lab;
  }

  /** Grant ONSSA accreditation to a laboratory. */
  async accredit(id: string): Promise<Lab> {
    const lab = await this.findById(id);
    if (lab.isAccredited) {
      throw new ConflictException({
        code: 'LAB_ALREADY_ACCREDITED',
        message: 'Lab is already accredited',
      });
    }
    await this.labRepo.update({ id }, { isAccredited: true, accreditedAt: new Date() });
    this.logger.log({ labId: id }, 'Lab accredited');
    return this.findById(id);
  }

  /** Revoke ONSSA accreditation from a laboratory. */
  async revoke(id: string): Promise<Lab> {
    const lab = await this.findById(id);
    if (!lab.isAccredited) {
      throw new ConflictException({
        code: 'LAB_NOT_ACCREDITED',
        message: 'Lab is not accredited',
      });
    }
    await this.labRepo.update({ id }, { isAccredited: false, accreditedAt: null });
    this.logger.log({ labId: id }, 'Lab accreditation revoked');
    return this.findById(id);
  }
}
