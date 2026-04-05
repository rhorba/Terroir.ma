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
