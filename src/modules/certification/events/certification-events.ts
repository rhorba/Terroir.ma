// Re-export from common interfaces for module-local use
export type {
  CertificationRequestSubmittedEvent,
  CertificationInspectionScheduledEvent,
  CertificationInspectionCompletedEvent,
  CertificationDecisionGrantedEvent,
  CertificationDecisionDeniedEvent,
  CertificationDecisionRevokedEvent,
  CertificationDecisionRenewedEvent,
  CertificationFinalReviewStartedEvent,
  CertificationRenewedEvent,
  LabTestCompletedEvent,
} from '../../../common/interfaces/events/certification.events';

export type {
  QrCodeGeneratedEvent,
  ExportDocumentGeneratedEvent,
} from '../../../common/interfaces/events/verification.events';
