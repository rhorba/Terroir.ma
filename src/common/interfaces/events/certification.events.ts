import { BaseEvent } from '../kafka-event.interface';
import { CertificationType } from '../morocco.interface';

export interface LabTestSubmittedEvent extends BaseEvent {
  labTestId: string;
  batchId: string;
  cooperativeId: string;
  productTypeCode: string;
  laboratoryId: string;
  submittedBy: string;
  expectedResultDate: string;
}

export interface LabTestCompletedEvent extends BaseEvent {
  labTestId: string;
  batchId: string;
  batchReference: string;
  cooperativeId: string;
  productTypeCode: string;
  productName: string;
  passed: boolean;
  testValues: Record<string, number | string>;
  failedParameters: string[];
  completedAt: string;
  technician: string;
  labName: string;
}

export interface CertificationRequestSubmittedEvent extends BaseEvent {
  certificationRequestId: string;
  cooperativeId: string;
  batchId: string;
  productTypeCode: string;
  certificationType: CertificationType;
  requestedBy: string;
}

export interface CertificationInspectionScheduledEvent extends BaseEvent {
  inspectionId: string;
  certificationRequestId: string;
  cooperativeId: string;
  cooperativeName: string;
  inspectorId: string;
  inspectorName: string;
  scheduledDate: string;
  location: string;
  farmIds: string[];
}

export interface CertificationInspectionCompletedEvent extends BaseEvent {
  inspectionId: string;
  certificationRequestId: string;
  cooperativeId: string;
  inspectorId: string;
  passed: boolean;
  reportSummary: string;
  completedAt: string;
}

export interface CertificationDecisionGrantedEvent extends BaseEvent {
  certificationId: string;
  certificationNumber: string;
  certificationType: CertificationType;
  cooperativeId: string;
  cooperativeName: string;
  productName: string;
  productTypeCode: string;
  batchId: string;
  regionCode: string;
  grantedBy: string;
  grantedAt: string;
  validFrom: string;
  validUntil: string;
  qrCodeId: string;
}

export interface CertificationDecisionDeniedEvent extends BaseEvent {
  certificationRequestId: string;
  cooperativeId: string;
  batchId: string;
  deniedBy: string;
  reason: string;
  deniedAt: string;
}

export interface CertificationDecisionRevokedEvent extends BaseEvent {
  certificationId: string;
  certificationNumber: string;
  cooperativeId: string;
  revokedBy: string;
  reason: string;
  revokedAt: string;
}

export interface CertificationDecisionRenewedEvent extends BaseEvent {
  certificationId: string;
  newCertificationId: string;
  certificationNumber: string;
  cooperativeId: string;
  renewedBy: string;
  validFrom: string;
  validUntil: string;
}

// Sprint 2 — certification chain step events

export interface CertificationReviewStartedEvent extends BaseEvent {
  certificationId: string;
  cooperativeId: string;
  startedBy: string;
  remarks: string | null;
}

export interface CertificationInspectionStartedEvent extends BaseEvent {
  certificationId: string;
  cooperativeId: string;
  inspectorId: string;
  startedAt: string;
}

export interface CertificationLabRequestedEvent extends BaseEvent {
  certificationId: string;
  cooperativeId: string;
  batchId: string;
  requestedBy: string;
  labId: string | null;
  remarks: string | null;
}

export interface CertificationLabResultsReceivedEvent extends BaseEvent {
  certificationId: string;
  cooperativeId: string;
  batchId: string;
  labTestId: string;
  passed: boolean;
  receivedAt: string;
}

// Sprint 3 — steps 8 and 12

export interface CertificationFinalReviewStartedEvent extends BaseEvent {
  certificationId: string;
  cooperativeId: string;
  actorId: string;
}

export interface CertificationRenewedEvent extends BaseEvent {
  oldCertificationId: string;
  newCertificationId: string;
  cooperativeId: string;
  renewedBy: string;
}

/** Published when a super-admin assigns an inspector to an inspection (US-044) */
export interface InspectionInspectorAssignedEvent extends BaseEvent {
  inspectionId: string;
  certificationId: string;
  cooperativeId: string;
  inspectorId: string;
  inspectorName: string;
  scheduledDate: string;
  assignedBy: string;
}
