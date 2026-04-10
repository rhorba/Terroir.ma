import { Test, TestingModule } from '@nestjs/testing';
import { CertificationListener } from '../../../src/modules/certification/listeners/certification.listener';
import { CertificationService } from '../../../src/modules/certification/services/certification.service';
import type { LabTestCompletedEvent } from '../../../src/common/interfaces/events/certification.events';
import type { CooperativeRegistrationVerifiedEvent } from '../../../src/common/interfaces/events/cooperative.events';
import type {
  CertificationFinalReviewStartedEvent,
  CertificationRenewedEvent,
} from '../../../src/common/interfaces/events/certification.events';

const mockCertificationService = {
  isEventProcessed: jest.fn(),
  receiveLabResults: jest.fn(),
};

/** Helper: build a minimal event payload with a type cast for handler tests. */
const makeLabTestEvent = (overrides = {}): LabTestCompletedEvent =>
  ({
    eventId: 'evt-001',
    correlationId: 'corr-001',
    timestamp: new Date().toISOString(),
    version: 1,
    source: 'product',
    batchId: 'batch-001',
    labTestId: 'lab-001',
    passed: true,
    ...overrides,
  }) as unknown as LabTestCompletedEvent;

describe('CertificationListener', () => {
  let listener: CertificationListener;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CertificationListener,
        { provide: CertificationService, useValue: mockCertificationService },
      ],
    }).compile();

    listener = module.get<CertificationListener>(CertificationListener);
  });

  it('should be defined', () => {
    expect(listener).toBeDefined();
  });

  describe('handleLabTestCompleted()', () => {
    it('calls receiveLabResults when event is not yet processed', async () => {
      const event = makeLabTestEvent();
      mockCertificationService.isEventProcessed.mockResolvedValue(false);
      mockCertificationService.receiveLabResults.mockResolvedValue(undefined);

      await listener.handleLabTestCompleted(event, {} as never);

      expect(mockCertificationService.isEventProcessed).toHaveBeenCalledWith('evt-001');
      expect(mockCertificationService.receiveLabResults).toHaveBeenCalledWith(
        'batch-001',
        'lab-001',
        true,
        'evt-001',
      );
    });

    it('skips processing when event is already processed (idempotency)', async () => {
      const event = makeLabTestEvent();
      mockCertificationService.isEventProcessed.mockResolvedValue(true);

      await listener.handleLabTestCompleted(event, {} as never);

      expect(mockCertificationService.receiveLabResults).not.toHaveBeenCalled();
    });

    it('swallows errors without rethrowing', async () => {
      const event = makeLabTestEvent();
      mockCertificationService.isEventProcessed.mockRejectedValue(new Error('DB down'));

      await expect(listener.handleLabTestCompleted(event, {} as never)).resolves.toBeUndefined();
    });
  });

  describe('handleCooperativeVerified()', () => {
    it('resolves without error', async () => {
      const event = {
        eventId: 'evt-002',
        cooperativeId: 'coop-001',
        cooperativeName: 'Test Coop',
        ice: '123456789012345',
        regionCode: 'SFI',
        verifiedBy: 'admin-001',
        verifiedAt: new Date().toISOString(),
        timestamp: new Date().toISOString(),
        version: 1,
        correlationId: 'corr-002',
        source: 'cooperative',
      } as unknown as CooperativeRegistrationVerifiedEvent;

      await expect(listener.handleCooperativeVerified(event, {} as never)).resolves.toBeUndefined();
    });
  });

  describe('handleFinalReviewStarted()', () => {
    it('resolves without error', async () => {
      const event = {
        eventId: 'evt-003',
        certificationId: 'cert-001',
        cooperativeId: 'coop-001',
        actorId: 'user-001',
        timestamp: new Date().toISOString(),
        version: 1,
        correlationId: 'corr-003',
        source: 'certification',
      } as unknown as CertificationFinalReviewStartedEvent;

      await expect(listener.handleFinalReviewStarted(event, {} as never)).resolves.toBeUndefined();
    });
  });

  describe('handleCertificationRenewed()', () => {
    it('resolves without error', async () => {
      const event = {
        eventId: 'evt-004',
        oldCertificationId: 'cert-old',
        newCertificationId: 'cert-new',
        cooperativeId: 'coop-001',
        renewedBy: 'user-001',
        timestamp: new Date().toISOString(),
        version: 1,
        correlationId: 'corr-004',
        source: 'certification',
      } as unknown as CertificationRenewedEvent;

      await expect(
        listener.handleCertificationRenewed(event, {} as never),
      ).resolves.toBeUndefined();
    });
  });
});
