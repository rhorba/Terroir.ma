import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CooperativeService } from '../../../src/modules/cooperative/services/cooperative.service';
import { Cooperative } from '../../../src/modules/cooperative/entities/cooperative.entity';
import { Member } from '../../../src/modules/cooperative/entities/member.entity';
import { Farm } from '../../../src/modules/cooperative/entities/farm.entity';
import { CooperativeProducer } from '../../../src/modules/cooperative/events/cooperative.producer';
import { UpdateMemberDto } from '../../../src/modules/cooperative/dto/update-member.dto';

const makeRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  findAndCount: jest.fn().mockResolvedValue([[], 0]),
  save: jest.fn(),
  create: jest.fn().mockImplementation((dto) => ({ ...dto })),
  update: jest.fn(),
});

const makeProducer = () => ({
  publishRegistrationSubmitted: jest.fn().mockResolvedValue(undefined),
  publishRegistrationVerified: jest.fn().mockResolvedValue(undefined),
  publishFarmMapped: jest.fn().mockResolvedValue(undefined),
  publishCooperativeDeactivated: jest.fn().mockResolvedValue(undefined),
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
    producer = module.get<CooperativeProducer>(CooperativeProducer) as unknown as ReturnType<
      typeof makeProducer
    >;
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
          {
            name: 'Dup',
            ice: '001234567890001',
            email: 'x@x.ma',
            phone: '+212600000000',
            regionCode: 'SFI',
            city: 'X',
            presidentName: 'X',
            presidentCin: 'X12345',
            presidentPhone: '+212600000001',
            productTypes: [],
          },
          'user-uuid',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('verify()', () => {
    it('should set status to active and publish verified event', async () => {
      const pending = buildCooperative({ status: 'pending' });
      const active = buildCooperative({
        status: 'active',
        verifiedAt: new Date(),
        verifiedBy: 'admin-uuid',
      });
      // findById is called twice: once to check, once after update
      coopRepo.findOne
        .mockResolvedValueOnce(pending) // first findById (guard check)
        .mockResolvedValueOnce(active) // second findById (after update)
        .mockResolvedValueOnce(active); // relations load
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

      await expect(service.verify('coop-uuid', 'admin', 'corr')).rejects.toThrow(
        BadRequestException,
      );
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

  describe('getMembers() — US-009', () => {
    let memberRepo: ReturnType<typeof makeRepo>;

    beforeEach(async () => {
      memberRepo = makeRepo();
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CooperativeService,
          { provide: getRepositoryToken(Cooperative), useFactory: makeRepo },
          { provide: getRepositoryToken(Member), useValue: memberRepo },
          { provide: getRepositoryToken(Farm), useFactory: makeRepo },
          { provide: CooperativeProducer, useFactory: makeProducer },
        ],
      }).compile();
      service = module.get<CooperativeService>(CooperativeService);
    });

    it('returns paginated members for a cooperative', async () => {
      const members = [{ id: 'm1', cooperativeId: 'coop-uuid' }];
      memberRepo.findAndCount.mockResolvedValue([members, 1]);

      const [data, total] = await service.getMembers('coop-uuid', 1, 20);

      expect(memberRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { cooperativeId: 'coop-uuid', isActive: true },
          take: 20,
          skip: 0,
        }),
      );
      expect(data).toEqual(members);
      expect(total).toBe(1);
    });
  });

  describe('updateMember() — US-008', () => {
    let memberRepo: ReturnType<typeof makeRepo>;

    beforeEach(async () => {
      memberRepo = makeRepo();
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CooperativeService,
          { provide: getRepositoryToken(Cooperative), useFactory: makeRepo },
          { provide: getRepositoryToken(Member), useValue: memberRepo },
          { provide: getRepositoryToken(Farm), useFactory: makeRepo },
          { provide: CooperativeProducer, useFactory: makeProducer },
        ],
      }).compile();
      service = module.get<CooperativeService>(CooperativeService);
    });

    it('throws BadRequestException when requester is not the member', async () => {
      await expect(
        service.updateMember('coop-uuid', 'member-uuid', {} as UpdateMemberDto, 'different-user'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when member not found in cooperative', async () => {
      memberRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateMember('coop-uuid', 'member-uuid', {} as UpdateMemberDto, 'member-uuid'),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates phone and email when member owns the profile', async () => {
      const member = {
        id: 'member-uuid',
        cooperativeId: 'coop-uuid',
        phone: '+212600000000',
        email: null,
      };
      memberRepo.findOne.mockResolvedValue(member);
      memberRepo.save.mockResolvedValue({
        ...member,
        phone: '+212611111111',
        email: 'new@coop.ma',
      });

      const dto: UpdateMemberDto = { phone: '+212611111111', email: 'new@coop.ma' };
      const result = await service.updateMember('coop-uuid', 'member-uuid', dto, 'member-uuid');

      expect(memberRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ phone: '+212611111111', email: 'new@coop.ma' }),
      );
      expect(result.phone).toBe('+212611111111');
    });
  });

  describe('update()', () => {
    it('updates cooperative and returns saved entity', async () => {
      const existing = buildCooperative();
      const updated = buildCooperative({ city: 'Casablanca' });
      coopRepo.findOne.mockResolvedValue(existing);
      coopRepo.save.mockResolvedValue(updated);

      const result = await service.update('coop-uuid', { city: 'Casablanca' } as never, 'admin');

      expect(coopRepo.save).toHaveBeenCalled();
      expect(result.city).toBe('Casablanca');
    });
  });

  describe('addMember()', () => {
    let memberRepo: ReturnType<typeof makeRepo>;

    beforeEach(async () => {
      memberRepo = makeRepo();
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CooperativeService,
          { provide: getRepositoryToken(Cooperative), useValue: coopRepo },
          { provide: getRepositoryToken(Member), useValue: memberRepo },
          { provide: getRepositoryToken(Farm), useFactory: makeRepo },
          { provide: CooperativeProducer, useFactory: makeProducer },
        ],
      }).compile();
      service = module.get<CooperativeService>(CooperativeService);
    });

    it('adds a member when CIN is unique', async () => {
      coopRepo.findOne.mockResolvedValue(buildCooperative());
      memberRepo.findOne.mockResolvedValue(null);
      memberRepo.save.mockResolvedValue({ id: 'member-001' });

      await expect(
        service.addMember(
          'coop-uuid',
          {
            cin: 'AB12346',
            fullName: 'Fatima Ait Ali',
            phone: '+212661234568',
            role: 'member',
            joinedAt: '2026-01-01',
          } as never,
          'admin',
        ),
      ).resolves.toBeUndefined();

      expect(memberRepo.save).toHaveBeenCalled();
    });

    it('throws ConflictException when CIN already exists', async () => {
      coopRepo.findOne.mockResolvedValue(buildCooperative());
      memberRepo.findOne.mockResolvedValue({ id: 'existing-member', cin: 'AB12345' });

      await expect(
        service.addMember('coop-uuid', { cin: 'AB12345' } as never, 'admin'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('deactivate() — US-010', () => {
    it('should set status to suspended and publish Kafka event', async () => {
      const active = buildCooperative({ status: 'active' });
      coopRepo.findOne.mockResolvedValue(active);
      coopRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.deactivate('coop-uuid', 'admin-uuid', 'Raison test', 'corr-id');

      expect(coopRepo.update).toHaveBeenCalledWith({ id: 'coop-uuid' }, { status: 'suspended' });
      expect(producer.publishCooperativeDeactivated).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'coop-uuid', status: 'suspended' }),
        'admin-uuid',
        'Raison test',
        'corr-id',
      );
      expect(result.status).toBe('suspended');
    });

    it('should throw ConflictException if cooperative is already suspended', async () => {
      coopRepo.findOne.mockResolvedValue(buildCooperative({ status: 'suspended' }));

      await expect(service.deactivate('coop-uuid', 'admin-uuid', null, 'corr-id')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw NotFoundException if cooperative does not exist', async () => {
      coopRepo.findOne.mockResolvedValue(null);

      await expect(service.deactivate('bad-uuid', 'admin-uuid', null, 'corr-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('mapFarm()', () => {
    let farmRepo: ReturnType<typeof makeRepo>;

    beforeEach(async () => {
      farmRepo = makeRepo();
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CooperativeService,
          { provide: getRepositoryToken(Cooperative), useValue: coopRepo },
          { provide: getRepositoryToken(Member), useFactory: makeRepo },
          { provide: getRepositoryToken(Farm), useValue: farmRepo },
          { provide: CooperativeProducer, useFactory: makeProducer },
        ],
      }).compile();
      service = module.get<CooperativeService>(CooperativeService);
    });

    it('creates a farm and publishes event', async () => {
      const coop = buildCooperative();
      coopRepo.findOne.mockResolvedValue(coop);
      farmRepo.save.mockResolvedValue({ id: 'farm-001' });

      const dto = { name: 'Ferme Argan', areaHectares: 5, latitude: 30.5, longitude: -9.2 };

      await service.mapFarm('coop-uuid', dto as never, 'admin');

      expect(farmRepo.save).toHaveBeenCalled();
    });
  });
});
