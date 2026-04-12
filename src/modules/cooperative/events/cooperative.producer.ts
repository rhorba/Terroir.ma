import { Injectable, Inject, Logger } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { v4 as uuidv4 } from 'uuid';
import { Cooperative } from '../entities/cooperative.entity';
import { Farm } from '../entities/farm.entity';
import type {
  CooperativeRegistrationSubmittedEvent,
  CooperativeRegistrationVerifiedEvent,
  CooperativeFarmMappedEvent,
  CooperativeDeactivatedEvent,
} from './cooperative-events';

/**
 * Publishes Kafka events for the cooperative module.
 * Topics: cooperative.registration.submitted, cooperative.farm.mapped
 */
@Injectable()
export class CooperativeProducer {
  private readonly logger = new Logger(CooperativeProducer.name);

  constructor(
    @Inject('KAFKA_CLIENT')
    private readonly kafkaClient: ClientKafka,
  ) {}

  /** Publish cooperative registration submitted event */
  async publishRegistrationSubmitted(
    cooperative: Cooperative,
    correlationId: string,
  ): Promise<void> {
    const event: CooperativeRegistrationSubmittedEvent = {
      eventId: uuidv4(),
      correlationId,
      timestamp: new Date().toISOString(),
      version: 1,
      source: 'cooperative',
      cooperativeId: cooperative.id,
      cooperativeName: cooperative.name,
      ice: cooperative.ice,
      regionCode: cooperative.regionCode,
      presidentName: cooperative.presidentName,
      presidentCin: cooperative.presidentCin,
    };

    try {
      await this.kafkaClient.emit('cooperative.registration.submitted', event).toPromise();
      this.logger.log(
        { eventId: event.eventId, cooperativeId: cooperative.id },
        'Registration submitted event published',
      );
    } catch (error) {
      this.logger.error(
        { error, cooperativeId: cooperative.id },
        'Failed to publish registration event',
      );
    }
  }

  /** Publish cooperative registration verified event (super-admin action) */
  async publishRegistrationVerified(
    cooperative: Cooperative,
    verifiedBy: string,
    correlationId: string,
  ): Promise<void> {
    const event: CooperativeRegistrationVerifiedEvent = {
      eventId: uuidv4(),
      correlationId,
      timestamp: new Date().toISOString(),
      version: 1,
      source: 'cooperative',
      cooperativeId: cooperative.id,
      cooperativeName: cooperative.name,
      ice: cooperative.ice,
      regionCode: cooperative.regionCode,
      verifiedBy,
      verifiedAt: (cooperative.verifiedAt ?? new Date()).toISOString(),
    };

    try {
      await this.kafkaClient.emit('cooperative.registration.verified', event).toPromise();
      this.logger.log(
        { eventId: event.eventId, cooperativeId: cooperative.id },
        'Registration verified event published',
      );
    } catch (error) {
      this.logger.error(
        { error, cooperativeId: cooperative.id },
        'Failed to publish registration verified event',
      );
    }
  }

  /** US-010 — Publish cooperative deactivated event */
  async publishCooperativeDeactivated(
    cooperative: Cooperative,
    deactivatedBy: string,
    reason: string | null,
    correlationId: string,
  ): Promise<void> {
    const event: CooperativeDeactivatedEvent = {
      eventId: uuidv4(),
      correlationId,
      timestamp: new Date().toISOString(),
      version: 1,
      source: 'cooperative',
      cooperativeId: cooperative.id,
      cooperativeName: cooperative.name,
      ice: cooperative.ice,
      regionCode: cooperative.regionCode,
      deactivatedBy,
      reason,
    };
    try {
      await this.kafkaClient.emit('cooperative.cooperative.deactivated', event).toPromise();
      this.logger.log(
        { eventId: event.eventId, cooperativeId: cooperative.id },
        'Cooperative deactivated event published',
      );
    } catch (error) {
      this.logger.error(
        { error, cooperativeId: cooperative.id },
        'Failed to publish cooperative deactivated event',
      );
    }
  }

  /** Publish farm mapped event */
  async publishFarmMapped(farm: Farm, correlationId: string): Promise<void> {
    const event: CooperativeFarmMappedEvent = {
      eventId: uuidv4(),
      correlationId,
      timestamp: new Date().toISOString(),
      version: 1,
      source: 'cooperative',
      cooperativeId: farm.cooperativeId,
      farmId: farm.id,
      farmName: farm.name,
      latitude: farm.latitude ?? 0,
      longitude: farm.longitude ?? 0,
      areaHectares: Number(farm.areaHectares),
      cropTypes: farm.cropTypes,
    };

    try {
      await this.kafkaClient.emit('cooperative.farm.mapped', event).toPromise();
      this.logger.log({ eventId: event.eventId, farmId: farm.id }, 'Farm mapped event published');
    } catch (error) {
      this.logger.error({ error, farmId: farm.id }, 'Failed to publish farm mapped event');
    }
  }
}
