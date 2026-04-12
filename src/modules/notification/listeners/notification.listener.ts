import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, KafkaContext } from '@nestjs/microservices';
import type {
  CertificationDecisionGrantedEvent,
  LabTestCompletedEvent,
  CertificationInspectionScheduledEvent,
  CooperativeDeactivatedEvent,
  InspectionInspectorAssignedEvent,
} from '../../../common/interfaces/events';
import { NotificationService } from '../services/notification.service';

/**
 * Notification module Kafka listener.
 * Consumer group: notification-group
 * Consumes: certification.decision.granted, lab.test.completed,
 *           certification.inspection.scheduled, cooperative.cooperative.deactivated,
 *           certification.inspection.inspector-assigned
 */
@Controller()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(private readonly notificationService: NotificationService) {}

  @EventPattern('certification.decision.granted')
  async handleCertificationGranted(
    @Payload() data: CertificationDecisionGrantedEvent,
    @Ctx() _context: KafkaContext,
  ): Promise<void> {
    try {
      this.logger.log(
        { eventId: data.eventId, certificationId: data.certificationId },
        'Certification granted — sending notification',
      );

      // Send email in all three supported languages; language is stored on the recipient profile.
      // For now we default to fr-MA and trust the template resolver to fall back.
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

      // ack handled automatically by NestJS Kafka transport
    } catch (error) {
      this.logger.error(
        { error, eventId: data.eventId },
        'Failed to process certification.decision.granted',
      );
    }
  }

  @EventPattern('lab.test.completed')
  async handleLabTestCompleted(
    @Payload() data: LabTestCompletedEvent,
    @Ctx() _context: KafkaContext,
  ): Promise<void> {
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

      // ack handled automatically by NestJS Kafka transport
    } catch (error) {
      this.logger.error({ error, eventId: data.eventId }, 'Failed to process lab.test.completed');
    }
  }

  /** US-010 — Notify cooperative-admin when cooperative is deactivated */
  @EventPattern('cooperative.cooperative.deactivated')
  async handleCooperativeDeactivated(
    @Payload() data: CooperativeDeactivatedEvent,
    @Ctx() _context: KafkaContext,
  ): Promise<void> {
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

  /** US-044 — Notify inspector when assigned to an inspection */
  @EventPattern('certification.inspection.inspector-assigned')
  async handleInspectorAssigned(
    @Payload() data: InspectionInspectorAssignedEvent,
    @Ctx() _context: KafkaContext,
  ): Promise<void> {
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

  @EventPattern('certification.inspection.scheduled')
  async handleInspectionScheduled(
    @Payload() data: CertificationInspectionScheduledEvent,
    @Ctx() _context: KafkaContext,
  ): Promise<void> {
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

      // ack handled automatically by NestJS Kafka transport
    } catch (error) {
      this.logger.error(
        { error, eventId: data.eventId },
        'Failed to process certification.inspection.scheduled',
      );
    }
  }
}
