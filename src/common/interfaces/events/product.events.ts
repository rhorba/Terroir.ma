import { BaseEvent } from '../kafka-event.interface';

export interface ProductHarvestLoggedEvent extends BaseEvent {
  harvestId: string;
  farmId: string;
  cooperativeId: string;
  productTypeCode: string;
  quantityKg: number;
  harvestDate: string;
  campaignYear: string;
  method: string;
}

export interface ProductBatchCreatedEvent extends BaseEvent {
  batchId: string;
  batchNumber: string;
  cooperativeId: string;
  productTypeCode: string;
  harvestIds: string[];
  totalQuantityKg: number;
  processingDate: string;
}

/** US-019 — Emitted when a cooperative records a post-harvest processing step for a batch. */
export interface ProductBatchProcessingStepAddedEvent extends BaseEvent {
  batchId: string;
  processingStepId: string;
  cooperativeId: string;
  stepType: string;
  doneAt: string;
  doneBy: string;
  notes: string | null;
}
