import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cooperative } from '../entities/cooperative.entity';
import type { CooperativeRegistrationVerifiedEvent } from '../events/cooperative-events';
import { KafkaConsumerService } from '../../../common/kafka/kafka-consumer.service';

/**
 * Listens for Kafka events that affect the cooperative module.
 * Topic: cooperative.registration.verified
 */
@Injectable()
export class CooperativeListener implements OnModuleInit {
  private readonly logger = new Logger(CooperativeListener.name);

  constructor(
    @InjectRepository(Cooperative)
    private readonly cooperativeRepo: Repository<Cooperative>,
    private readonly kafkaConsumerService: KafkaConsumerService,
  ) {}

  onModuleInit(): void {
    this.kafkaConsumerService.subscribe('cooperative.registration.verified', (p) =>
      this.handleRegistrationVerified(p as CooperativeRegistrationVerifiedEvent),
    );
  }

  /**
   * Handle verification events — update cooperative status to 'active'.
   */
  async handleRegistrationVerified(data: CooperativeRegistrationVerifiedEvent): Promise<void> {
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
    }
  }
}
