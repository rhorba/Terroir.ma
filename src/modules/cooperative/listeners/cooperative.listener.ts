import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, KafkaContext } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cooperative } from '../entities/cooperative.entity';
import type { CooperativeRegistrationVerifiedEvent } from '../events/cooperative-events';

/**
 * Listens for Kafka events that affect the cooperative module.
 * Topic: cooperative.registration.verified
 */
@Controller()
export class CooperativeListener {
  private readonly logger = new Logger(CooperativeListener.name);

  constructor(
    @InjectRepository(Cooperative)
    private readonly cooperativeRepo: Repository<Cooperative>,
  ) {}

  /**
   * Handle verification events — update cooperative status to 'active'.
   */
  @EventPattern('cooperative.registration.verified')
  async handleRegistrationVerified(
    @Payload() data: CooperativeRegistrationVerifiedEvent,
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    this.logger.log(
      { eventId: data.eventId, cooperativeId: data.cooperativeId },
      'Cooperative registration verified event received',
    );

    try {
      await this.cooperativeRepo.update(
        { id: data.cooperativeId },
        {
          status: 'active',
          verifiedAt: new Date(data.verifiedAt),
          verifiedBy: data.verifiedBy,
        },
      );
      this.logger.log(
        { cooperativeId: data.cooperativeId },
        'Cooperative status updated to active',
      );
    } catch (error) {
      this.logger.error(
        { error, cooperativeId: data.cooperativeId },
        'Failed to update cooperative status',
      );
    } finally {
      context.getMessage().ack?.();
    }
  }
}
