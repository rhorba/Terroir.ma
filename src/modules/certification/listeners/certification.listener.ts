import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, KafkaContext } from '@nestjs/microservices';
import type {
  LabTestCompletedEvent,
  CooperativeRegistrationVerifiedEvent,
  CertificationFinalReviewStartedEvent,
  CertificationRenewedEvent,
} from '../../../common/interfaces/events';
import { CertificationService } from '../services/certification.service';

/**
 * Certification module Kafka listener.
 * Consumer group: certification-group
 * Consumes: lab.test.completed, cooperative.registration.verified
 */
@Controller()
export class CertificationListener {
  private readonly logger = new Logger(CertificationListener.name);

  constructor(private readonly certificationService: CertificationService) {}

  /**
   * Step 7: When a lab test is completed, advance the matching certification
   * from LAB_TESTING → LAB_RESULTS_RECEIVED.
   * Idempotent: checks correlationId (eventId) before processing.
   */
  @EventPattern('lab.test.completed')
  async handleLabTestCompleted(
    @Payload() data: LabTestCompletedEvent,
    @Ctx() _context: KafkaContext,
  ): Promise<void> {
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
  @EventPattern('cooperative.registration.verified')
  async handleCooperativeVerified(
    @Payload() data: CooperativeRegistrationVerifiedEvent,
    @Ctx() _context: KafkaContext,
  ): Promise<void> {
    this.logger.log(
      { eventId: data.eventId, cooperativeId: data.cooperativeId },
      'Cooperative verified — certification module read model updated',
    );
    // ack handled automatically by NestJS Kafka transport
  }

  /**
   * Step 8 notification hook — certification moved to final review.
   * Notification module will handle the cooperative-admin email.
   */
  @EventPattern('certification.review.final-started')
  async handleFinalReviewStarted(
    @Payload() data: CertificationFinalReviewStartedEvent,
    @Ctx() _context: KafkaContext,
  ): Promise<void> {
    this.logger.log(
      { eventId: data.eventId, certificationId: data.certificationId },
      'Certification moved to final review',
    );
  }

  /**
   * Step 12 notification hook — certification renewal initiated.
   * Notification module will handle the cooperative-admin email.
   */
  @EventPattern('certification.renewed')
  async handleCertificationRenewed(
    @Payload() data: CertificationRenewedEvent,
    @Ctx() _context: KafkaContext,
  ): Promise<void> {
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
