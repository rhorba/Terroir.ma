import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CooperativeListener } from '../../../src/modules/cooperative/listeners/cooperative.listener';
import { Cooperative } from '../../../src/modules/cooperative/entities/cooperative.entity';
import type { CooperativeRegistrationVerifiedEvent } from '../../../src/common/interfaces/events/cooperative.events';

const makeRepo = () => ({
  update: jest.fn().mockResolvedValue(undefined),
});

const makeEvent = (): CooperativeRegistrationVerifiedEvent =>
  ({
    eventId: 'evt-001',
    correlationId: 'corr-001',
    timestamp: new Date().toISOString(),
    version: 1,
    source: 'cooperative',
    cooperativeId: 'coop-001',
    cooperativeName: 'Coopérative Argan Essaouira',
    ice: '123456789012345',
    regionCode: 'ESS',
    verifiedBy: 'admin-001',
    verifiedAt: new Date().toISOString(),
  }) as unknown as CooperativeRegistrationVerifiedEvent;

describe('CooperativeListener', () => {
  let listener: CooperativeListener;
  let cooperativeRepo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    jest.clearAllMocks();
    cooperativeRepo = makeRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CooperativeListener,
        { provide: getRepositoryToken(Cooperative), useValue: cooperativeRepo },
      ],
    }).compile();

    listener = module.get<CooperativeListener>(CooperativeListener);
  });

  it('should be defined', () => {
    expect(listener).toBeDefined();
  });

  describe('handleRegistrationVerified()', () => {
    it('updates cooperative status to active when verification event received', async () => {
      const event = makeEvent();

      await listener.handleRegistrationVerified(event, {} as never);

      expect(cooperativeRepo.update).toHaveBeenCalledWith(
        { id: 'coop-001' },
        expect.objectContaining({
          status: 'active',
          verifiedBy: 'admin-001',
        }),
      );
    });

    it('swallows errors without rethrowing', async () => {
      const event = makeEvent();
      cooperativeRepo.update.mockRejectedValue(new Error('DB error'));

      await expect(
        listener.handleRegistrationVerified(event, {} as never),
      ).resolves.toBeUndefined();
    });
  });
});
