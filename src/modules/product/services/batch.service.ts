import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ProductionBatch, BatchStatus } from '../entities/production-batch.entity';
import { CreateBatchDto } from '../dto/create-batch.dto';
import { ProductProducer } from '../events/product.producer';

/**
 * Batch service — manages production batch lifecycle.
 * A batch groups multiple harvests for lab testing and certification.
 */
@Injectable()
export class BatchService {
  constructor(
    @InjectRepository(ProductionBatch)
    private readonly batchRepo: Repository<ProductionBatch>,
    private readonly producer: ProductProducer,
  ) {}

  /**
   * Create a new production batch from harvests.
   * Generates a unique batch number.
   */
  async createBatch(
    dto: CreateBatchDto,
    cooperativeId: string,
    createdBy: string,
  ): Promise<ProductionBatch> {
    const batchNumber = this.generateBatchNumber(dto.productTypeCode);
    const batch = this.batchRepo.create({
      ...dto,
      batchNumber,
      cooperativeId,
      createdBy,
      status: 'created',
    });
    const saved = await this.batchRepo.save(batch);
    await this.producer.publishBatchCreated(saved, createdBy);
    return saved;
  }

  async findById(id: string): Promise<ProductionBatch> {
    const batch = await this.batchRepo.findOne({ where: { id } });
    if (!batch) {
      throw new NotFoundException({
        code: 'BATCH_NOT_FOUND',
        message: `Production batch ${id} not found`,
      });
    }
    return batch;
  }

  async findByCooperative(cooperativeId: string): Promise<ProductionBatch[]> {
    return this.batchRepo.find({
      where: { cooperativeId },
      order: { createdAt: 'DESC' },
    });
  }

  async updateStatus(id: string, status: BatchStatus): Promise<void> {
    const batch = await this.findById(id);
    if (batch.status === 'certified' && status !== 'recalled') {
      throw new BadRequestException({
        code: 'INVALID_BATCH_TRANSITION',
        message: 'Certified batches can only be recalled',
      });
    }
    await this.batchRepo.update({ id }, { status });
  }

  private generateBatchNumber(productTypeCode: string): string {
    const year = new Date().getFullYear();
    const seq = (uuidv4().split('-')[0] ?? 'XXXX').toUpperCase();
    return `BATCH-${productTypeCode}-${year}-${seq}`;
  }
}
