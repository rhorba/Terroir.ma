// Re-export from common interfaces for module-local use
export type {
  ProductHarvestLoggedEvent,
  ProductBatchCreatedEvent,
  ProductBatchProcessingStepAddedEvent,
} from '../../../common/interfaces/events/product.events';

export type {
  LabTestSubmittedEvent,
  LabTestCompletedEvent,
} from '../../../common/interfaces/events/certification.events';
