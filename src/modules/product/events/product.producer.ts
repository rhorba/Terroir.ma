import { Injectable, Inject, Logger } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { v4 as uuidv4 } from 'uuid';
import { Harvest } from '../entities/harvest.entity';
import { ProductionBatch } from '../entities/production-batch.entity';
import { LabTest } from '../entities/lab-test.entity';
import { LabTestResult } from '../entities/lab-test-result.entity';
import { ProcessingStep } from '../entities/processing-step.entity';
import type {
  ProductHarvestLoggedEvent,
  ProductBatchCreatedEvent,
  ProductBatchProcessingStepAddedEvent,
  LabTestSubmittedEvent,
  LabTestCompletedEvent,
} from './product-events';

/**
 * Publishes Kafka events for the product module.
 * Topics: product.harvest.logged, product.batch.created, lab.test.submitted
 */
@Injectable()
export class ProductProducer {
  private readonly logger = new Logger(ProductProducer.name);

  constructor(
    @Inject('KAFKA_CLIENT')
    private readonly kafkaClient: ClientKafka,
  ) {}

  async publishHarvestLogged(harvest: Harvest, correlationId: string): Promise<void> {
    const event: ProductHarvestLoggedEvent = {
      eventId: uuidv4(),
      correlationId,
      timestamp: new Date().toISOString(),
      version: 1,
      source: 'product',
      harvestId: harvest.id,
      farmId: harvest.farmId,
      cooperativeId: harvest.cooperativeId,
      productTypeCode: harvest.productTypeCode,
      quantityKg: Number(harvest.quantityKg),
      harvestDate: harvest.harvestDate,
      campaignYear: harvest.campaignYear,
      method: harvest.method,
    };

    try {
      await this.kafkaClient.emit('product.harvest.logged', event).toPromise();
      this.logger.log(
        { eventId: event.eventId, harvestId: harvest.id },
        'Harvest logged event published',
      );
    } catch (error) {
      this.logger.error({ error, harvestId: harvest.id }, 'Failed to publish harvest event');
    }
  }

  async publishBatchCreated(batch: ProductionBatch, correlationId: string): Promise<void> {
    const event: ProductBatchCreatedEvent = {
      eventId: uuidv4(),
      correlationId,
      timestamp: new Date().toISOString(),
      version: 1,
      source: 'product',
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      cooperativeId: batch.cooperativeId,
      productTypeCode: batch.productTypeCode,
      harvestIds: batch.harvestIds,
      totalQuantityKg: Number(batch.totalQuantityKg),
      processingDate: batch.processingDate,
    };

    try {
      await this.kafkaClient.emit('product.batch.created', event).toPromise();
      this.logger.log(
        { eventId: event.eventId, batchId: batch.id },
        'Batch created event published',
      );
    } catch (error) {
      this.logger.error({ error, batchId: batch.id }, 'Failed to publish batch event');
    }
  }

  async publishLabTestSubmitted(
    labTest: LabTest,
    correlationId: string,
    expectedResultDate: string | null,
  ): Promise<void> {
    const event: LabTestSubmittedEvent = {
      eventId: uuidv4(),
      correlationId,
      timestamp: new Date().toISOString(),
      version: 1,
      source: 'product',
      labTestId: labTest.id,
      batchId: labTest.batchId,
      cooperativeId: labTest.cooperativeId,
      productTypeCode: labTest.productTypeCode,
      laboratoryId: labTest.laboratoryId ?? '',
      submittedBy: labTest.submittedBy,
      expectedResultDate: expectedResultDate ?? '',
    };

    try {
      await this.kafkaClient.emit('lab.test.submitted', event).toPromise();
      this.logger.log(
        { eventId: event.eventId, labTestId: labTest.id },
        'Lab test submitted event published',
      );
    } catch (error) {
      this.logger.error({ error, labTestId: labTest.id }, 'Failed to publish lab test event');
    }
  }

  /**
   * Publish product.batch.processing_step_added after a cooperative records a processing step.
   * US-019.
   */
  async publishProcessingStepAdded(step: ProcessingStep, correlationId: string): Promise<void> {
    const event: ProductBatchProcessingStepAddedEvent = {
      eventId: uuidv4(),
      correlationId,
      timestamp: new Date().toISOString(),
      version: 1,
      source: 'product',
      batchId: step.batchId,
      processingStepId: step.id,
      cooperativeId: step.cooperativeId,
      stepType: step.stepType,
      doneAt: step.doneAt.toISOString(),
      doneBy: step.doneBy,
      notes: step.notes,
    };

    try {
      await this.kafkaClient.emit('product.batch.processing_step_added', event).toPromise();
      this.logger.log(
        { eventId: event.eventId, batchId: step.batchId },
        'Processing step event published',
      );
    } catch (error) {
      this.logger.error(
        { error, batchId: step.batchId },
        'Failed to publish processing step event',
      );
    }
  }

  /**
   * Publish lab.test.completed event after technician records results.
   * Consumed by: notification-group (triggers email to cooperative admin).
   */
  async publishLabTestCompleted(
    labTest: LabTest,
    result: LabTestResult,
    correlationId: string,
  ): Promise<void> {
    const event: LabTestCompletedEvent = {
      eventId: uuidv4(),
      correlationId,
      timestamp: new Date().toISOString(),
      version: 1,
      source: 'product',
      labTestId: labTest.id,
      batchId: labTest.batchId,
      batchReference: labTest.batchId,
      cooperativeId: labTest.cooperativeId,
      productTypeCode: labTest.productTypeCode,
      productName: labTest.productTypeCode,
      passed: result.passed,
      testValues: result.testValues,
      failedParameters: result.failedParameters,
      completedAt: result.completedAt.toISOString(),
      technician: result.technicianName,
      labName: labTest.laboratoryId ?? '',
    };

    try {
      await this.kafkaClient.emit('lab.test.completed', event).toPromise();
      this.logger.log(
        { eventId: event.eventId, labTestId: labTest.id, passed: result.passed },
        'Lab test completed event published',
      );
    } catch (error) {
      this.logger.error(
        { error, labTestId: labTest.id },
        'Failed to publish lab test completed event',
      );
    }
  }
}
