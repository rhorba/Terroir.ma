import { BaseEvent } from '../kafka-event.interface';

export interface CooperativeRegistrationSubmittedEvent extends BaseEvent {
  cooperativeId: string;
  cooperativeName: string;
  ice: string;
  regionCode: string;
  presidentName: string;
  presidentCin: string;
}

export interface CooperativeRegistrationVerifiedEvent extends BaseEvent {
  cooperativeId: string;
  cooperativeName: string;
  ice: string;
  regionCode: string;
  verifiedBy: string;
  verifiedAt: string;
}

export interface CooperativeFarmMappedEvent extends BaseEvent {
  cooperativeId: string;
  farmId: string;
  farmName: string;
  latitude: number;
  longitude: number;
  areaHectares: number;
  cropTypes: string[];
}

/** Published when a super-admin deactivates a cooperative (US-010) */
export interface CooperativeDeactivatedEvent extends BaseEvent {
  cooperativeId: string;
  cooperativeName: string;
  ice: string;
  regionCode: string;
  deactivatedBy: string;
  reason: string | null;
}
