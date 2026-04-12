import { Injectable, Inject, Logger } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { v4 as uuidv4 } from 'uuid';
import { Certification } from '../entities/certification.entity';
import { Inspection } from '../entities/inspection.entity';
import { QrCode } from '../entities/qr-code.entity';
import type {
  CertificationRequestSubmittedEvent,
  CertificationInspectionScheduledEvent,
  CertificationDecisionGrantedEvent,
  CertificationDecisionDeniedEvent,
  CertificationDecisionRevokedEvent,
  CertificationFinalReviewStartedEvent,
  CertificationRenewedEvent,
  QrCodeGeneratedEvent,
} from './certification-events';
import { CertificationType } from '../../../common/interfaces/morocco.interface';

/**
 * Publishes Kafka events for the certification module.
 */
@Injectable()
export class CertificationProducer {
  private readonly logger = new Logger(CertificationProducer.name);

  constructor(
    @Inject('KAFKA_CLIENT')
    private readonly kafkaClient: ClientKafka,
  ) {}

  async publishCertificationRequested(
    certification: Certification,
    correlationId: string,
  ): Promise<void> {
    const event: CertificationRequestSubmittedEvent = {
      eventId: uuidv4(),
      correlationId,
      timestamp: new Date().toISOString(),
      version: 1,
      source: 'certification',
      certificationRequestId: certification.id,
      cooperativeId: certification.cooperativeId,
      batchId: certification.batchId,
      productTypeCode: certification.productTypeCode,
      certificationType: certification.certificationType,
      requestedBy: certification.requestedBy,
    };

    try {
      await this.kafkaClient.emit('certification.request.submitted', event).toPromise();
      this.logger.log(
        { eventId: event.eventId, certificationId: certification.id },
        'Certification request event published',
      );
    } catch (error) {
      this.logger.error(
        { error, certificationId: certification.id },
        'Failed to publish certification request',
      );
    }
  }

  async publishInspectionScheduled(inspection: Inspection, correlationId: string): Promise<void> {
    const event: CertificationInspectionScheduledEvent = {
      eventId: uuidv4(),
      correlationId,
      timestamp: new Date().toISOString(),
      version: 1,
      source: 'certification',
      inspectionId: inspection.id,
      certificationRequestId: inspection.certificationId,
      cooperativeId: inspection.cooperativeId,
      cooperativeName: '',
      inspectorId: inspection.inspectorId,
      inspectorName: inspection.inspectorName ?? '',
      scheduledDate: inspection.scheduledDate,
      location: '',
      farmIds: inspection.farmIds,
    };

    try {
      await this.kafkaClient.emit('certification.inspection.scheduled', event).toPromise();
      this.logger.log(
        { eventId: event.eventId, inspectionId: inspection.id },
        'Inspection scheduled event published',
      );
    } catch (error) {
      this.logger.error(
        { error, inspectionId: inspection.id },
        'Failed to publish inspection scheduled event',
      );
    }
  }

  async publishCertificationGranted(
    certification: Certification,
    qrCodeId: string,
    grantedBy: string,
    correlationId: string,
  ): Promise<void> {
    const event: CertificationDecisionGrantedEvent = {
      eventId: uuidv4(),
      correlationId,
      timestamp: new Date().toISOString(),
      version: 1,
      source: 'certification',
      certificationId: certification.id,
      certificationNumber: certification.certificationNumber ?? '',
      certificationType: certification.certificationType as CertificationType,
      cooperativeId: certification.cooperativeId,
      cooperativeName: certification.cooperativeName,
      productName: certification.productTypeCode,
      productTypeCode: certification.productTypeCode,
      batchId: certification.batchId,
      regionCode: certification.regionCode,
      grantedBy,
      grantedAt: certification.grantedAt?.toISOString() ?? new Date().toISOString(),
      validFrom: certification.validFrom ?? '',
      validUntil: certification.validUntil ?? '',
      qrCodeId,
    };

    try {
      await this.kafkaClient.emit('certification.decision.granted', event).toPromise();
      this.logger.log(
        { eventId: event.eventId, certificationId: certification.id },
        'Certification granted event published',
      );
    } catch (error) {
      this.logger.error(
        { error, certificationId: certification.id },
        'Failed to publish certification granted event',
      );
    }
  }

  async publishCertificationDenied(
    certification: Certification,
    deniedBy: string,
    reason: string,
    correlationId: string,
  ): Promise<void> {
    const event: CertificationDecisionDeniedEvent = {
      eventId: uuidv4(),
      correlationId,
      timestamp: new Date().toISOString(),
      version: 1,
      source: 'certification',
      certificationRequestId: certification.id,
      cooperativeId: certification.cooperativeId,
      batchId: certification.batchId,
      deniedBy,
      reason,
      deniedAt: new Date().toISOString(),
    };

    try {
      await this.kafkaClient.emit('certification.decision.denied', event).toPromise();
      this.logger.log(
        { eventId: event.eventId, certificationId: certification.id },
        'Certification denied event published',
      );
    } catch (error) {
      this.logger.error(
        { error, certificationId: certification.id },
        'Failed to publish certification denied event',
      );
    }
  }

  async publishCertificationRevoked(
    certification: Certification,
    revokedBy: string,
    reason: string,
    correlationId: string,
  ): Promise<void> {
    const event: CertificationDecisionRevokedEvent = {
      eventId: uuidv4(),
      correlationId,
      timestamp: new Date().toISOString(),
      version: 1,
      source: 'certification',
      certificationId: certification.id,
      certificationNumber: certification.certificationNumber ?? '',
      cooperativeId: certification.cooperativeId,
      revokedBy,
      reason,
      revokedAt: new Date().toISOString(),
    };

    try {
      await this.kafkaClient.emit('certification.decision.revoked', event).toPromise();
      this.logger.log(
        { eventId: event.eventId, certificationId: certification.id },
        'Certification revoked event published',
      );
    } catch (error) {
      this.logger.error(
        { error, certificationId: certification.id },
        'Failed to publish certification revoked event',
      );
    }
  }

  async publishQrCodeGenerated(
    qrCode: QrCode,
    certificationNumber: string,
    cooperativeId: string,
    correlationId: string,
  ): Promise<void> {
    const event: QrCodeGeneratedEvent = {
      eventId: uuidv4(),
      correlationId,
      timestamp: new Date().toISOString(),
      version: 1,
      source: 'certification',
      qrCodeId: qrCode.id,
      certificationId: qrCode.certificationId,
      certificationNumber,
      cooperativeId,
      verificationUrl: qrCode.verificationUrl,
      generatedAt: new Date().toISOString(),
    };

    try {
      await this.kafkaClient.emit('qrcode.generated', event).toPromise();
      this.logger.log(
        { eventId: event.eventId, qrCodeId: qrCode.id },
        'QR code generated event published',
      );
    } catch (error) {
      this.logger.error(
        { error, qrCodeId: qrCode.id },
        'Failed to publish QR code generated event',
      );
    }
  }

  async publishFinalReviewStarted(
    certification: Certification,
    actorId: string,
    correlationId: string,
  ): Promise<void> {
    const event: CertificationFinalReviewStartedEvent = {
      eventId: uuidv4(),
      correlationId,
      timestamp: new Date().toISOString(),
      version: 1,
      source: 'certification',
      certificationId: certification.id,
      cooperativeId: certification.cooperativeId,
      actorId,
    };
    try {
      await this.kafkaClient.emit('certification.review.final-started', event).toPromise();
      this.logger.log(
        { eventId: event.eventId, certificationId: certification.id },
        'Final review started event published',
      );
    } catch (error) {
      this.logger.error(
        { error, certificationId: certification.id },
        'Failed to publish final review started event',
      );
    }
  }

  async publishCertificationRenewed(
    oldCertification: Certification,
    newCertificationId: string,
    renewedBy: string,
    correlationId: string,
  ): Promise<void> {
    const event: CertificationRenewedEvent = {
      eventId: uuidv4(),
      correlationId,
      timestamp: new Date().toISOString(),
      version: 1,
      source: 'certification',
      oldCertificationId: oldCertification.id,
      newCertificationId,
      cooperativeId: oldCertification.cooperativeId,
      renewedBy,
    };
    try {
      await this.kafkaClient.emit('certification.renewed', event).toPromise();
      this.logger.log(
        { eventId: event.eventId, oldCertificationId: oldCertification.id, newCertificationId },
        'Certification renewed event published',
      );
    } catch (error) {
      this.logger.error(
        { error, oldCertificationId: oldCertification.id },
        'Failed to publish certification renewed event',
      );
    }
  }
}
