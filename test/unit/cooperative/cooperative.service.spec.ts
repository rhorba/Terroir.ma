import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CooperativeService } from '../../../src/modules/cooperative/services/cooperative.service';
import { Cooperative } from '../../../src/modules/cooperative/entities/cooperative.entity';
import { Member } from '../../../src/modules/cooperative/entities/member.entity';
import { Farm } from '../../../src/modules/cooperative/entities/farm.entity';
import { CooperativeProducer } from '../../../src/modules/cooperative/events/cooperative.producer';

const makeRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  create: jest.fn().mockImplementation((dto) => ({ ...dto })),
  update: jest.fn(),
});

const makeProducer = () => ({
  publishRegistrationSubmitted: jest.fn().mockResolvedValue(undefined),
  publishRegistrationVerified: jest.fn().mockResolvedValue(undefined),
  publishFarmMapped: jest.fn().mockResolvedValue(undefined),
});

function buildCooperative(overrides: Partial<Cooperative> = {}): Cooperative {
  return {
    id: 'coop-uuid',
    name: 'Coopérative Test',
    nameAr: null,
    ice: '001234567890001',
    ifNumber: null,
    rcNumber: null,
    email: 'admin@coop.ma',
    phone: '+212661234567',
    address: null,
    regionCode: 'SFI',
    city: 'Agadir',
    presidentName: 'Ahmed Ait Brahim',
    presidentCin: 'AB12345',
    presidentPhone: '+212661111111',
    status: 'pending',
    productTypes: [],
    verifiedAt: null,
    verifiedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'user-uuid',
    deletedAt: null,
    members: [],
    farms: [],
    ...overrides,
  } as Cooperative;
}

describe('CooperativeService', () => {
  let service: CooperativeService;
  let coopRepo: ReturnType<typeof makeRepo>;
  let producer: ReturnType<typeof makeProducer>;

  beforeEach(async () => {
    coopRepo = makeRepo();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CooperativeService,
        { provide: getRepositoryToken(Cooperative), useValue: coopRepo },
        { provide: getRepositoryToken(Member), useFactory: makeRepo },
        { provide: getRepositoryToken(Farm), useFactory: makeRepo },
        { provide: CooperativeProducer, useFactory: makeProducer },
      ],
    }).compile();

    service = module.get<CooperativeService>(CooperativeService);
    producer = module.get<CooperativeProducer>(CooperativeProducer) as ReturnType<typeof makeProducer>;
  });

  describe('register()', () => {
    it('should save and publish event when ICE is unique', async () => {
      coopRepo.findOne.mockResolvedValue(null);
      const saved = buildCooperative();
      coopRepo.save.mockResolvedValue(saved);

      const result = await service.register(
        {
          name: 'Coopérative Test',
          ice: '001234567890001',
          email: 'admin@coop.ma',
          phone: '+212661234567',
          regionCode: 'SFI',
          city: 'Agadir',
          presidentName: 'Ahmed Ait Brahim',
          presidentCin: 'AB12345',
          presidentPhone: '+212661111111',
          productTypes: [],
        },
        'user-uuid',
      );

      expect(result).toEqual(saved);
      expect(producer.publishRegistrationSubmitted).toHaveBeenCalledWith(saved, 'user-uuid');
    });

    it('should throw ConflictException when ICE already exists', async () => {
      coopRepo.findOne.mockResolvedValue(buildCooperative());

      await expect(
        service.register(
          { name: 'Dup', ice: '001234567890001', email: 'x@x.ma', phone: '+212600000000', regionCode: 'SFI', city: 'X', presidentName: 'X', presidentCin: 'X12345', presidentPhone: '+212600000001', productTypes: [] },
          'user-uuid',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('verify()', () => {
    it('should set status to active and publish verified event', async () => {
      const pending = buildCooperative({ status: 'pending' });
      const active = buildCooperative({ status: 'active', verifiedAt: new Date(), verifiedBy: 'admin-uuid' });
      // findById is called twice: once to check, once after update
      coopRepo.findOne
        .mockResolvedValueOnce(pending)   // first findById (guard check)
        .mockResolvedValueOnce(active)    // second findById (after update)
        .mockResolvedValueOnce(active);   // relations load
      coopRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.verify('coop-uuid', 'admin-uuid', 'corr-id');

      expect(coopRepo.update).toHaveBeenCalledWith(
        { id: 'coop-uuid' },
        expect.objectContaining({ status: 'active', verifiedBy: 'admin-uuid' }),
      );
      expect(producer.publishRegistrationVerified).toHaveBeenCalledWith(
        active,
        'admin-uuid',
        'corr-id',
      );
      expect(result.status).toBe('active');
    });

    it('should throw NotFoundException when cooperative does not exist', async () => {
      coopRepo.findOne.mockResolvedValue(null);

      await expect(service.verify('bad-uuid', 'admin', 'corr')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when cooperative is already active', async () => {
      coopRepo.findOne.mockResolvedValue(buildCooperative({ status: 'active' }));

      await expect(service.verify('coop-uuid', 'admin', 'corr')).rejects.toThrow(BadRequestException);
    });
  });

  describe('findById()', () => {
    it('should return cooperative when found', async () => {
      const coop = buildCooperative();
      coopRepo.findOne.mockResolvedValue(coop);

      expect(await service.findById('coop-uuid')).toEqual(coop);
    });

    it('should throw NotFoundException when not found', async () => {
      coopRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('bad-uuid')).rejects.toThrow(NotFoundException);
    });
  });
});
