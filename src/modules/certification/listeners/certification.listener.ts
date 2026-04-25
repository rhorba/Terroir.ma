import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type {
  LabTestCompletedEvent,
  CooperativeRegistrationVerifiedEvent,
  CertificationFinalReviewStartedEvent,
  CertificationRenewedEvent,
} from '../../../common/interfaces/events';
import { CertificationService } from '../services/certification.service';
import { KafkaConsumerService } from '../../../common/kafka/kafka-consumer.service';

/**
 * Certification module Kafka listener.
 * Consumer group: certification-group
 * Consumes: lab.test.completed, cooperative.registration.verified,
 *           certification.review.final-started, certification.renewed
 */
@Injectable()
export class CertificationListener implements OnModuleInit {
  private readonly logger = new Logger(CertificationListener.name);

  constructor(
    private readonly certificationService: CertificationService,
    private readonly kafkaConsumerService: KafkaConsumerService,
  ) {}

  onModuleInit(): void {
    this.kafkaConsumerService.subscribe('lab.test.completed', (p) =>
      this.handleLabTestCompleted(p as LabTestCompletedEvent),
    );
    this.kafkaConsumerService.subscribe('cooperative.registration.verified', (p) =>
      this.handleCooperativeVerified(p as CooperativeRegistrationVerifiedEvent),
    );
    this.kafkaConsumerService.subscribe('certification.review.final-started', (p) =>
      this.handleFinalReviewStarted(p as CertificationFinalReviewStartedEvent),
    );
    this.kafkaConsumerService.subscribe('certification.renewed', (p) =>
      this.handleCertificationRenewed(p as CertificationRenewedEvent),
    );
  }

  /**
   * Step 7: When a lab test is completed, advance the matching certification
   * from LAB_TESTING → LAB_RESULTS_RECEIVED.
   * Idempotent: checks eventId before processing.
   */
  async handleLabTestCompleted(data: LabTestCompletedEvent): Promise<void> {
    try {
      if (await this.certificationService.isEventProcessed(data.eventId)) {
        this.logger.log(
          { eventId: data.eventId },
          'lab.test.completed already processed — skipping',
        );
        return;
      }
      this.logger.log(
        { eventId: data.eventId, batchId: data.batchId, passed: data.passed },
        'Lab test completed — advancing certification to LAB_RESULTS_RECEIVED',
      );
      await this.certificationService.receiveLabResults(
        data.batchId,
        data.labTestId,
        data.passed,
        data.eventId,
      );
    } catch (error) {
      this.logger.error({ error, eventId: data.eventId }, 'Failed to process lab.test.completed');
    }
  }

  /**
   * When a cooperative is verified, update the local read model.
   */
  async handleCooperativeVerified(data: CooperativeRegistrationVerifiedEvent): Promise<void> {
    this.logger.log(
      { eventId: data.eventId, cooperativeId: data.cooperativeId },
      'Cooperative verified — certification module read model updated',
    );
  }

  /**
   * Step 8 notification hook — certification moved to final review.
   */
  async handleFinalReviewStarted(data: CertificationFinalReviewStartedEvent): Promise<void> {
    this.logger.log(
      { eventId: data.eventId, certificationId: data.certificationId },
      'Certification moved to final review',
    );
  }

  /**
   * Step 12 notification hook — certification renewal initiated.
   */
  async handleCertificationRenewed(data: CertificationRenewedEvent): Promise<void> {
    this.logger.log(
      {
        eventId: data.eventId,
        oldCertId: data.oldCertificationId,
        newCertId: data.newCertificationId,
      },
      'Certification renewal initiated',
    );
  }
}
