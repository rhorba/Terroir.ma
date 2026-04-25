import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductionBatch } from '../entities/production-batch.entity';
import { LabTest } from '../entities/lab-test.entity';
import { LabTestResult } from '../entities/lab-test-result.entity';
import type { LabTestCompletedEvent } from '../events/product-events';
import { KafkaConsumerService } from '../../../common/kafka/kafka-consumer.service';

/**
 * Product module Kafka listener.
 * Handles lab.test.completed events to update batch status.
 */
@Injectable()
export class ProductListener implements OnModuleInit {
  private readonly logger = new Logger(ProductListener.name);

  constructor(
    @InjectRepository(ProductionBatch)
    private readonly batchRepo: Repository<ProductionBatch>,
    @InjectRepository(LabTest)
    private readonly labTestRepo: Repository<LabTest>,
    @InjectRepository(LabTestResult)
    private readonly labTestResultRepo: Repository<LabTestResult>,
    private readonly kafkaConsumerService: KafkaConsumerService,
  ) {}

  onModuleInit(): void {
    this.kafkaConsumerService.subscribe('lab.test.completed', (p) =>
      this.handleLabTestCompleted(p as LabTestCompletedEvent),
    );
  }

  /**
   * Update batch status when a lab test is completed externally (e.g., from a lab portal).
   * testValues arrives as a JSON string on the Avro wire — JSON.parse before persisting to JSONB.
   */
  async handleLabTestCompleted(data: LabTestCompletedEvent): Promise<void> {
    this.logger.log(
      { eventId: data.eventId, labTestId: data.labTestId, passed: data.passed },
      'Lab test completed event received',
    );

    try {
      await this.labTestRepo.update({ id: data.labTestId }, { status: 'completed' });

      const result = this.labTestResultRepo.create({
        labTestId: data.labTestId,
        batchId: data.batchId,
        productTypeCode: data.productTypeCode,
        passed: data.passed,
        testValues: JSON.parse(data.testValues as unknown as string),
        failedParameters: data.failedParameters,
        technicianName: data.technician,
        technicianId: data.correlationId,
        completedAt: new Date(data.completedAt),
      });
      await this.labTestResultRepo.save(result);

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
    }
  }
}
