import { Test, TestingModule } from '@nestjs/testing';
import { CooperativeProducer } from '../../../src/modules/cooperative/events/cooperative.producer';
import { KafkaProducerService } from '../../../src/common/kafka/kafka-producer.service';

const mockKafkaProducer = { send: jest.fn().mockResolvedValue(undefined) };

describe('CooperativeProducer', () => {
  let producer: CooperativeProducer;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CooperativeProducer,
        { provide: KafkaProducerService, useValue: mockKafkaProducer },
      ],
    }).compile();
    producer = module.get<CooperativeProducer>(CooperativeProducer);
  });

  it('publishRegistrationSubmitted() sends to cooperative.registration.submitted', async () => {
    const cooperative = {
      id: 'c-001',
      name: 'Coop Argan',
      ice: '001234567000012',
      regionCode: 'SFI',
      presidentName: 'Ali Hassan',
      presidentCin: 'AB123456',
    } as never;

    await producer.publishRegistrationSubmitted(cooperative, 'corr-001');

    expect(mockKafkaProducer.send).toHaveBeenCalledWith(
      'cooperative.registration.submitted',
      expect.objectContaining({ cooperativeId: 'c-001', regionCode: 'SFI' }),
    );
  });

  it('publishRegistrationSubmitted() swallows errors without rethrowing', async () => {
    mockKafkaProducer.send.mockRejectedValueOnce(new Error('broker down'));
    await expect(
      producer.publishRegistrationSubmitted({ id: 'c-001' } as never, 'corr-001'),
    ).resolves.toBeUndefined();
  });

  it('publishFarmMapped() sends to cooperative.farm.mapped', async () => {
    const farm = {
      id: 'farm-001',
      cooperativeId: 'c-001',
      name: 'Ferme Argan',
      latitude: 31.5,
      longitude: -9.8,
      areaHectares: 10.5,
      cropTypes: ['argan'],
    } as never;

    await producer.publishFarmMapped(farm, 'corr-001');

    expect(mockKafkaProducer.send).toHaveBeenCalledWith(
      'cooperative.farm.mapped',
      expect.objectContaining({ farmId: 'farm-001', cooperativeId: 'c-001' }),
    );
  });

  it('publishCooperativeDeactivated() sends to cooperative.cooperative.deactivated', async () => {
    const cooperative = {
      id: 'c-001',
      name: 'Coop Argan',
      ice: '001234567000012',
      regionCode: 'SFI',
    } as never;

    await producer.publishCooperativeDeactivated(
      cooperative,
      'admin-001',
      'Non-conformité',
      'corr-001',
    );

    expect(mockKafkaProducer.send).toHaveBeenCalledWith(
      'cooperative.cooperative.deactivated',
      expect.objectContaining({ cooperativeId: 'c-001', deactivatedBy: 'admin-001' }),
    );
  });
});
