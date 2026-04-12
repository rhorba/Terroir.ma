import { Test, TestingModule } from '@nestjs/testing';
import { NotificationListener } from '../../../src/modules/notification/listeners/notification.listener';
import { NotificationService } from '../../../src/modules/notification/services/notification.service';
import type { CertificationDecisionGrantedEvent } from '../../../src/common/interfaces/events/certification.events';

const mockNotificationService = {
  send: jest.fn().mockResolvedValue(undefined),
};

const makeGrantedEvent = (): CertificationDecisionGrantedEvent =>
  ({
    eventId: 'evt-001',
    correlationId: 'corr-001',
    timestamp: new Date().toISOString(),
    version: 1,
    source: 'certification',
    certificationId: 'cert-001',
    certificationNumber: 'TERROIR-IGP-SFI-2026-001',
    cooperativeId: 'coop-001',
    cooperativeName: 'Coopérative Argan Essaouira',
    productName: "Huile d'argan",
    productTypeCode: 'ARGAN-OIL',
    batchId: 'batch-001',
    regionCode: 'SFI',
    grantedBy: 'cert-body-001',
    grantedAt: new Date().toISOString(),
    validFrom: '2026-04-10',
    validUntil: '2027-04-10',
    qrCodeId: 'qr-001',
    certificationType: 'IGP',
  }) as unknown as CertificationDecisionGrantedEvent;

describe('NotificationListener', () => {
  let listener: NotificationListener;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationListener,
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    listener = module.get<NotificationListener>(NotificationListener);
  });

  it('should be defined', () => {
    expect(listener).toBeDefined();
  });

  describe('handleCertificationGranted()', () => {
    it('sends certification-granted notification email', async () => {
      const event = makeGrantedEvent();

      await listener.handleCertificationGranted(event, {} as never);

      expect(mockNotificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'coop-001',
          channel: 'email',
          templateCode: 'certification-granted',
          language: 'fr-MA',
        }),
      );
    });

    it('swallows errors without rethrowing', async () => {
      const event = makeGrantedEvent();
      mockNotificationService.send.mockRejectedValue(new Error('SMTP down'));

      await expect(
        listener.handleCertificationGranted(event, {} as never),
      ).resolves.toBeUndefined();
    });
  });

  describe('handleLabTestCompleted()', () => {
    it('sends lab-test-completed notification email', async () => {
      const event = {
        eventId: 'evt-002',
        correlationId: 'corr-002',
        timestamp: new Date().toISOString(),
        version: 1,
        source: 'product',
        batchId: 'batch-001',
        batchReference: 'BATCH-REF-001',
        labTestId: 'lab-001',
        cooperativeId: 'coop-001',
        passed: true,
        productName: "Huile d'argan",
        productTypeCode: 'ARGAN-OIL',
        completedAt: new Date().toISOString(),
        labName: 'Laboratoire Maroc',
        testValues: {},
        failedParameters: [],
        technician: 'tech-001',
      } as never;

      await listener.handleLabTestCompleted(event, {} as never);

      expect(mockNotificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'email',
          templateCode: 'lab-test-completed',
        }),
      );
    });
  });

  describe('handleInspectionScheduled()', () => {
    it('sends inspection-scheduled notification email', async () => {
      const event = {
        eventId: 'evt-003',
        correlationId: 'corr-003',
        timestamp: new Date().toISOString(),
        version: 1,
        source: 'certification',
        inspectionId: 'insp-001',
        certificationRequestId: 'cert-001',
        cooperativeId: 'coop-001',
        cooperativeName: 'Coopérative Argan Essaouira',
        inspectorId: 'inspector-001',
        inspectorName: 'Hassan Benali',
        scheduledDate: '2026-05-01',
        location: 'Essaouira',
        farmIds: ['farm-001'],
      } as never;

      await listener.handleInspectionScheduled(event, {} as never);

      expect(mockNotificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'email',
          templateCode: 'inspection-scheduled',
        }),
      );
    });
  });
});
