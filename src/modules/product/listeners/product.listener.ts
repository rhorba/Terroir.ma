import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, KafkaContext } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductionBatch } from '../entities/production-batch.entity';
import { LabTest } from '../entities/lab-test.entity';
import { LabTestResult } from '../entities/lab-test-result.entity';
import type { LabTestCompletedEvent } from '../events/product-events';

/**
 * Product module Kafka listener.
 * Handles lab.test.completed events to update batch status.
 */
@Controller()
export class ProductListener {
  private readonly logger = new Logger(ProductListener.name);

  constructor(
    @InjectRepository(ProductionBatch)
    private readonly batchRepo: Repository<ProductionBatch>,
    @InjectRepository(LabTest)
    private readonly labTestRepo: Repository<LabTest>,
    @InjectRepository(LabTestResult)
    private readonly labTestResultRepo: Repository<LabTestResult>,
  ) {}

  /**
   * Update batch status when a lab test is completed externally (e.g., from a lab portal).
   */
  @EventPattern('lab.test.completed')
  async handleLabTestCompleted(
    @Payload() data: LabTestCompletedEvent,
    @Ctx() _context: KafkaContext,
  ): Promise<void> {
    this.logger.log(
      { eventId: data.eventId, labTestId: data.labTestId, passed: data.passed },
      'Lab test completed event received',
    );

    try {
      // Update lab test status
      await this.labTestRepo.update({ id: data.labTestId }, { status: 'completed' });

      // Save result record
      const result = this.labTestResultRepo.create({
        labTestId: data.labTestId,
        batchId: data.batchId,
        productTypeCode: data.productTypeCode,
        passed: data.passed,
        testValues: data.testValues,
        failedParameters: data.failedParameters,
        technicianName: data.technician,
        technicianId: data.correlationId, // Use correlationId as proxy for technician id when external
        completedAt: new Date(data.completedAt),
      });
      await this.labTestResultRepo.save(result);

      // Update batch status
      await this.batchRepo.update(
        { id: data.batchId },
        { status: data.passed ? 'lab_passed' : 'lab_failed' },
      );

      this.logger.log(
        { batchId: data.batchId, passed: data.passed },
        'Batch status updated from lab test result',
      );
    } catch (error) {
      this.logger.error(
        { error, labTestId: data.labTestId },
        'Failed to process lab test completed event',
      );
    } finally {
      // ack handled automatically by NestJS Kafka transport
    }
  }
}
