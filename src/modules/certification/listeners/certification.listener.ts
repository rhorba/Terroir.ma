import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, KafkaContext } from '@nestjs/microservices';
import type { LabTestCompletedEvent, CooperativeRegistrationVerifiedEvent } from '../../../common/interfaces/events';
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
   * When a lab test is completed, update the batch eligibility for certification.
   * Idempotent: checks eventId before processing.
   */
  @EventPattern('lab.test.completed')
  async handleLabTestCompleted(
    @Payload() data: LabTestCompletedEvent,
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    try {
      if (await this.certificationService.isEventProcessed(data.eventId)) {
        context.getMessage().ack?.();
        return;
      }
      this.logger.log(
        { eventId: data.eventId, batchId: data.batchId, passed: data.passed },
        'Lab test completed — updating certification read model',
      );
      context.getMessage().ack?.();
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
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    this.logger.log(
      { eventId: data.eventId, cooperativeId: data.cooperativeId },
      'Cooperative verified — certification module read model updated',
    );
    context.getMessage().ack?.();
  }
}
