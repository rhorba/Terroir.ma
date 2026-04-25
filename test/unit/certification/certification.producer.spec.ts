import { Test, TestingModule } from '@nestjs/testing';
import { CertificationProducer } from '../../../src/modules/certification/events/certification.producer';
import { KafkaProducerService } from '../../../src/common/kafka/kafka-producer.service';

const mockKafkaProducer = { send: jest.fn().mockResolvedValue(undefined) };

describe('CertificationProducer', () => {
  let producer: CertificationProducer;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CertificationProducer,
        { provide: KafkaProducerService, useValue: mockKafkaProducer },
      ],
    }).compile();
    producer = module.get<CertificationProducer>(CertificationProducer);
  });

  it('publishCertificationRequested() sends to certification.request.submitted', async () => {
    const certification = {
      id: 'cert-001',
      cooperativeId: 'c-001',
      batchId: 'b-001',
      productTypeCode: 'ARGAN-OIL',
      certificationType: 'IGP',
      requestedBy: 'user-001',
    } as never;

    await producer.publishCertificationRequested(certification, 'corr-001');

    expect(mockKafkaProducer.send).toHaveBeenCalledWith(
      'certification.request.submitted',
      expect.objectContaining({ certificationRequestId: 'cert-001', certificationType: 'IGP' }),
    );
  });

  it('publishCertificationRequested() swallows errors without rethrowing', async () => {
    mockKafkaProducer.send.mockRejectedValueOnce(new Error('broker down'));
    await expect(
      producer.publishCertificationRequested({ id: 'cert-001' } as never, 'corr-001'),
    ).resolves.toBeUndefined();
  });

  it('publishCertificationGranted() sends to certification.decision.granted', async () => {
    const certification = {
      id: 'cert-001',
      certificationNumber: 'TERROIR-IGP-SFI-2026-001',
      certificationType: 'IGP',
      cooperativeId: 'c-001',
      cooperativeName: 'Coop Argan',
      productTypeCode: 'ARGAN-OIL',
      batchId: 'b-001',
      regionCode: 'SFI',
      grantedAt: new Date('2026-04-01'),
      validFrom: '2026-04-01',
      validUntil: '2027-04-01',
    } as never;

    await producer.publishCertificationGranted(
      certification,
      'qr-001',
      'cert-body-001',
      'corr-001',
    );

    expect(mockKafkaProducer.send).toHaveBeenCalledWith(
      'certification.decision.granted',
      expect.objectContaining({ certificationId: 'cert-001', qrCodeId: 'qr-001' }),
    );
  });

  it('publishQrCodeGenerated() sends to qrcode.generated', async () => {
    const qrCode = {
      id: 'qr-001',
      certificationId: 'cert-001',
      verificationUrl: 'https://terroir.ma/verify/abc123',
    } as never;

    await producer.publishQrCodeGenerated(qrCode, 'TERROIR-IGP-SFI-2026-001', 'c-001', 'corr-001');

    expect(mockKafkaProducer.send).toHaveBeenCalledWith(
      'qrcode.generated',
      expect.objectContaining({ qrCodeId: 'qr-001', certificationId: 'cert-001' }),
    );
  });
});
