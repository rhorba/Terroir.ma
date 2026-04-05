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
  cooperativeId: string;
  productTypeCode: string;
  passed: boolean;
  testValues: Record<string, number | string>;
  failedParameters: string[];
  completedAt: string;
  technician: string;
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
  inspectorId: string;
  scheduledDate: string;
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
  productTypeCode: string;
  batchId: string;
  regionCode: string;
  grantedBy: string;
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
