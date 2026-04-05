import { BaseEvent } from '../kafka-event.interface';

export interface QrCodeGeneratedEvent extends BaseEvent {
  qrCodeId: string;
  certificationId: string;
  certificationNumber: string;
  cooperativeId: string;
  verificationUrl: string;
  generatedAt: string;
}

export interface QrCodeScannedEvent extends BaseEvent {
  qrCodeId: string;
  certificationId: string;
  scannedAt: string;
  scannedFromIp: string;
  userAgent: string;
  valid: boolean;
}

export interface ExportDocumentGeneratedEvent extends BaseEvent {
  exportDocumentId: string;
  certificationId: string;
  cooperativeId: string;
  destinationCountry: string;
  hsCode: string;
  onssaReference: string;
  generatedAt: string;
}

export interface AuditEventLoggedEvent extends BaseEvent {
  action: string;
  actorId: string;
  actorRole: string;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, unknown>;
}
