import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type {
  CertificationDecisionGrantedEvent,
  CertificationInspectionScheduledEvent,
  InspectionInspectorAssignedEvent,
  LabTestCompletedEvent,
} from '../../../common/interfaces/events/certification.events';
import type { CooperativeDeactivatedEvent } from '../../../common/interfaces/events/cooperative.events';
import { KafkaConsumerService } from '../../../common/kafka/kafka-consumer.service';
import { NotificationService } from '../services/notification.service';

/**
 * Notification module Kafka listener.
 * Consumer group: notification-group
 * Consumes: certification.decision.granted, lab.test.completed,
 *           certification.inspection.scheduled, cooperative.cooperative.deactivated,
 *           certification.inspection.inspector-assigned
 */
@Injectable()
export class NotificationListener implements OnModuleInit {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly kafkaConsumerService: KafkaConsumerService,
  ) {}

  onModuleInit(): void {
    this.kafkaConsumerService.subscribe('certification.decision.granted', (p) =>
      this.handleCertificationGranted(p as CertificationDecisionGrantedEvent),
    );
    this.kafkaConsumerService.subscribe('lab.test.completed', (p) =>
      this.handleLabTestCompleted(p as LabTestCompletedEvent),
    );
    this.kafkaConsumerService.subscribe('cooperative.cooperative.deactivated', (p) =>
      this.handleCooperativeDeactivated(p as CooperativeDeactivatedEvent),
    );
    this.kafkaConsumerService.subscribe('certification.inspection.inspector-assigned', (p) =>
      this.handleInspectorAssigned(p as InspectionInspectorAssignedEvent),
    );
    this.kafkaConsumerService.subscribe('certification.inspection.scheduled', (p) =>
      this.handleInspectionScheduled(p as CertificationInspectionScheduledEvent),
    );
  }

  async handleCertificationGranted(data: CertificationDecisionGrantedEvent): Promise<void> {
    try {
      this.logger.log(
        { eventId: data.eventId, certificationId: data.certificationId },
        'Certification granted — sending notification',
      );
      await this.notificationService.send({
        recipientId: data.cooperativeId,
        channel: 'email',
        templateCode: 'certification-granted',
        language: 'fr-MA',
        context: {
          certificationNumber: data.certificationNumber,
          productName: data.productName,
          cooperativeName: data.cooperativeName,
          grantedAt: data.grantedAt,
        },
        triggerEventId: data.eventId,
        correlationId: data.correlationId,
      });
    } catch (error) {
      this.logger.error(
        { error, eventId: data.eventId },
        'Failed to process certification.decision.granted',
      );
    }
  }

  async handleLabTestCompleted(data: LabTestCompletedEvent): Promise<void> {
    try {
      this.logger.log(
        { eventId: data.eventId, batchId: data.batchId, passed: data.passed },
        'Lab test completed — sending notification',
      );
      await this.notificationService.send({
        recipientId: data.cooperativeId,
        channel: 'email',
        templateCode: 'lab-test-completed',
        language: 'fr-MA',
        context: {
          batchReference: data.batchReference,
          productName: data.productName,
          passed: data.passed,
          completedAt: data.completedAt,
          labName: data.labName,
        },
        triggerEventId: data.eventId,
        correlationId: data.correlationId,
      });
    } catch (error) {
      this.logger.error({ error, eventId: data.eventId }, 'Failed to process lab.test.completed');
    }
  }

  async handleCooperativeDeactivated(data: CooperativeDeactivatedEvent): Promise<void> {
    try {
      this.logger.log(
        { eventId: data.eventId, cooperativeId: data.cooperativeId },
        'Cooperative deactivated — sending notification',
      );
      await this.notificationService.send({
        recipientId: data.cooperativeId,
        channel: 'email',
        templateCode: 'cooperative-deactivated',
        language: 'fr-MA',
        context: {
          cooperativeName: data.cooperativeName,
          reason: data.reason ?? 'Non spécifié',
          deactivatedBy: data.deactivatedBy,
        },
        triggerEventId: data.eventId,
        correlationId: data.correlationId,
      });
    } catch (error) {
      this.logger.error(
        { error, eventId: data.eventId },
        'Failed to process cooperative.cooperative.deactivated',
      );
    }
  }

  async handleInspectorAssigned(data: InspectionInspectorAssignedEvent): Promise<void> {
    try {
      this.logger.log(
        { eventId: data.eventId, inspectionId: data.inspectionId, inspectorId: data.inspectorId },
        'Inspector assigned — sending notification',
      );
      await this.notificationService.send({
        recipientId: data.inspectorId,
        channel: 'email',
        templateCode: 'inspection-assigned',
        language: 'fr-MA',
        context: {
          inspectorName: data.inspectorName,
          scheduledDate: data.scheduledDate,
          certificationId: data.certificationId,
        },
        triggerEventId: data.eventId,
        correlationId: data.correlationId,
      });
    } catch (error) {
      this.logger.error(
        { error, eventId: data.eventId },
        'Failed to process certification.inspection.inspector-assigned',
      );
    }
  }

  async handleInspectionScheduled(data: CertificationInspectionScheduledEvent): Promise<void> {
    try {
      this.logger.log(
        { eventId: data.eventId, inspectionId: data.inspectionId },
        'Inspection scheduled — sending notification',
      );
      await this.notificationService.send({
        recipientId: data.cooperativeId,
        channel: 'email',
        templateCode: 'inspection-scheduled',
        language: 'fr-MA',
        context: {
          cooperativeName: data.cooperativeName,
          inspectorName: data.inspectorName,
          scheduledDate: data.scheduledDate,
          location: data.location,
        },
        triggerEventId: data.eventId,
        correlationId: data.correlationId,
      });
    } catch (error) {
      this.logger.error(
        { error, eventId: data.eventId },
        'Failed to process certification.inspection.scheduled',
      );
    }
  }
}
