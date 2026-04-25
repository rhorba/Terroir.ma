import { Test, TestingModule } from '@nestjs/testing';
import { NotificationListener } from '../../../src/modules/notification/listeners/notification.listener';
import { NotificationService } from '../../../src/modules/notification/services/notification.service';
import { KafkaConsumerService } from '../../../src/common/kafka/kafka-consumer.service';
import type {
  CertificationDecisionGrantedEvent,
  InspectionInspectorAssignedEvent,
} from '../../../src/common/interfaces/events/certification.events';
import type { CooperativeDeactivatedEvent } from '../../../src/common/interfaces/events/cooperative.events';

const mockNotificationService = {
  send: jest.fn().mockResolvedValue(undefined),
};

const mockKafkaConsumerService = {
  subscribe: jest.fn(),
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
        { provide: KafkaConsumerService, useValue: mockKafkaConsumerService },
      ],
    }).compile();

    listener = module.get<NotificationListener>(NotificationListener);
  });

  it('should be defined', () => {
    expect(listener).toBeDefined();
  });

  describe('onModuleInit()', () => {
    it('registers handlers for all 5 topics', () => {
      listener.onModuleInit();
      expect(mockKafkaConsumerService.subscribe).toHaveBeenCalledTimes(5);
      expect(mockKafkaConsumerService.subscribe).toHaveBeenCalledWith(
        'certification.decision.granted',
        expect.any(Function),
      );
      expect(mockKafkaConsumerService.subscribe).toHaveBeenCalledWith(
        'lab.test.completed',
        expect.any(Function),
      );
      expect(mockKafkaConsumerService.subscribe).toHaveBeenCalledWith(
        'cooperative.cooperative.deactivated',
        expect.any(Function),
      );
      expect(mockKafkaConsumerService.subscribe).toHaveBeenCalledWith(
        'certification.inspection.inspector-assigned',
        expect.any(Function),
      );
      expect(mockKafkaConsumerService.subscribe).toHaveBeenCalledWith(
        'certification.inspection.scheduled',
        expect.any(Function),
      );
    });
  });

  describe('handleCertificationGranted()', () => {
    it('sends certification-granted notification email', async () => {
      const event = makeGrantedEvent();

      await listener.handleCertificationGranted(event);

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

      await expect(listener.handleCertificationGranted(event)).resolves.toBeUndefined();
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

      await listener.handleLabTestCompleted(event);

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

      await listener.handleInspectionScheduled(event);

      expect(mockNotificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'email',
          templateCode: 'inspection-scheduled',
        }),
      );
    });
  });

  describe('handleCooperativeDeactivated()', () => {
    const makeDeactivatedEvent = (
      reason: string | null = 'Non-conformité SDOQ',
    ): CooperativeDeactivatedEvent =>
      ({
        eventId: 'evt-deact-001',
        correlationId: 'corr-deact-001',
        timestamp: new Date().toISOString(),
        version: 1,
        source: 'cooperative',
        cooperativeId: 'coop-001',
        cooperativeName: 'Coopérative Argan Essaouira',
        ice: '001234567000012',
        regionCode: 'SFI',
        deactivatedBy: 'super-admin-001',
        reason,
      }) as unknown as CooperativeDeactivatedEvent;

    it('sends cooperative-deactivated notification with provided reason', async () => {
      const event = makeDeactivatedEvent('Non-conformité SDOQ');

      await listener.handleCooperativeDeactivated(event);

      expect(mockNotificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'coop-001',
          channel: 'email',
          templateCode: 'cooperative-deactivated',
          language: 'fr-MA',
          context: expect.objectContaining({ reason: 'Non-conformité SDOQ' }),
        }),
      );
    });

    it('falls back to default reason text when reason is null', async () => {
      const event = makeDeactivatedEvent(null);

      await listener.handleCooperativeDeactivated(event);

      expect(mockNotificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({ reason: 'Non spécifié' }),
        }),
      );
    });

    it('swallows errors without rethrowing', async () => {
      const event = makeDeactivatedEvent();
      mockNotificationService.send.mockRejectedValueOnce(new Error('SMTP down'));

      await expect(listener.handleCooperativeDeactivated(event)).resolves.toBeUndefined();
    });
  });

  describe('handleInspectorAssigned()', () => {
    const makeInspectorAssignedEvent = (): InspectionInspectorAssignedEvent =>
      ({
        eventId: 'evt-assign-001',
        correlationId: 'corr-assign-001',
        timestamp: new Date().toISOString(),
        version: 1,
        source: 'certification',
        inspectionId: 'insp-001',
        certificationId: 'cert-001',
        cooperativeId: 'coop-001',
        inspectorId: 'inspector-001',
        inspectorName: 'Hassan Benali',
        scheduledDate: '2026-05-01',
        assignedBy: 'cert-body-001',
      }) as unknown as InspectionInspectorAssignedEvent;

    it('sends inspection-assigned notification to inspector', async () => {
      const event = makeInspectorAssignedEvent();

      await listener.handleInspectorAssigned(event);

      expect(mockNotificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'inspector-001',
          channel: 'email',
          templateCode: 'inspection-assigned',
          language: 'fr-MA',
          context: expect.objectContaining({
            inspectorName: 'Hassan Benali',
            scheduledDate: '2026-05-01',
            certificationId: 'cert-001',
          }),
        }),
      );
    });

    it('swallows errors without rethrowing', async () => {
      const event = makeInspectorAssignedEvent();
      mockNotificationService.send.mockRejectedValueOnce(new Error('SMTP down'));

      await expect(listener.handleInspectorAssigned(event)).resolves.toBeUndefined();
    });
  });
});
