import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProcessingStep } from '../entities/processing-step.entity';
import { ProductionBatch } from '../entities/production-batch.entity';
import { AddProcessingStepDto } from '../dto/add-processing-step.dto';
import { ProductProducer } from '../events/product.producer';

/**
 * Records and retrieves post-harvest processing steps for production batches.
 * Steps are immutable (append-only) — mirrors CertificationEvent pattern.
 * US-019.
 */
@Injectable()
export class ProcessingStepService {
  private readonly logger = new Logger(ProcessingStepService.name);

  constructor(
    @InjectRepository(ProcessingStep)
    private readonly stepRepo: Repository<ProcessingStep>,
    @InjectRepository(ProductionBatch)
    private readonly batchRepo: Repository<ProductionBatch>,
    private readonly producer: ProductProducer,
  ) {}

  /**
   * Record a post-harvest processing step for a batch.
   * @throws NotFoundException if batchId does not exist
   */
  async addStep(
    batchId: string,
    dto: AddProcessingStepDto,
    cooperativeId: string,
    actorId: string,
    correlationId: string,
  ): Promise<ProcessingStep> {
    const batch = await this.batchRepo.findOne({ where: { id: batchId } });
    if (!batch) {
      throw new NotFoundException({
        code: 'BATCH_NOT_FOUND',
        message: `Batch ${batchId} not found`,
      });
    }

    const step = this.stepRepo.create({
      batchId,
      cooperativeId,
      stepType: dto.stepType,
      doneAt: new Date(dto.doneAt),
      doneBy: actorId,
      notes: dto.notes ?? null,
    });

    const saved = await this.stepRepo.save(step);

    await this.producer.publishProcessingStepAdded(saved, correlationId);

    this.logger.log({ batchId, stepType: dto.stepType }, 'Processing step recorded');
    return saved;
  }

  /**
   * Return all processing steps for a batch ordered by doneAt ascending.
   */
  async findByBatch(batchId: string): Promise<ProcessingStep[]> {
    return this.stepRepo.find({
      where: { batchId },
      order: { doneAt: 'ASC' },
    });
  }
}
