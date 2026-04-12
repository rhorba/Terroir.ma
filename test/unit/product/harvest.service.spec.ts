import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { HarvestService } from '../../../src/modules/product/services/harvest.service';
import { Harvest } from '../../../src/modules/product/entities/harvest.entity';
import { ProductProducer } from '../../../src/modules/product/events/product.producer';

const makeRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  create: jest.fn().mockImplementation((dto) => ({ id: 'harvest-uuid', ...dto })),
  createQueryBuilder: jest.fn(),
});

const mockProducer = {
  publishHarvestLogged: jest.fn().mockResolvedValue(undefined),
};

describe('HarvestService', () => {
  let service: HarvestService;
  let harvestRepo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    jest.clearAllMocks();
    harvestRepo = makeRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HarvestService,
        { provide: getRepositoryToken(Harvest), useValue: harvestRepo },
        { provide: ProductProducer, useValue: mockProducer },
      ],
    }).compile();

    service = module.get<HarvestService>(HarvestService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('computeCampaignYear() (static)', () => {
    it('returns 2025/2026 for October harvest (start of new campaign)', () => {
      expect(HarvestService.computeCampaignYear('2025-10-01')).toBe('2025/2026');
    });

    it('returns 2024/2025 for September harvest (end of previous campaign)', () => {
      expect(HarvestService.computeCampaignYear('2025-09-30')).toBe('2024/2025');
    });

    it('returns 2025/2026 for December harvest', () => {
      expect(HarvestService.computeCampaignYear('2025-12-15')).toBe('2025/2026');
    });
  });

  describe('logHarvest()', () => {
    const dto = {
      farmId: 'farm-001',
      productTypeCode: 'ARGAN-OIL',
      harvestDate: '2026-04-10',
      quantityKg: 150,
      method: 'manual',
    };

    it('creates a harvest with computed campaign year', async () => {
      const savedHarvest = { id: 'harvest-001', ...dto, campaignYear: '2025/2026' };
      harvestRepo.save.mockResolvedValue(savedHarvest);

      const result = await service.logHarvest(dto as never, 'coop-001', 'user-001');

      expect(harvestRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          farmId: 'farm-001',
          cooperativeId: 'coop-001',
          createdBy: 'user-001',
          campaignYear: expect.any(String),
        }),
      );
      expect(harvestRepo.save).toHaveBeenCalled();
      expect(mockProducer.publishHarvestLogged).toHaveBeenCalledWith(savedHarvest, 'user-001');
      expect(result).toEqual(savedHarvest);
    });
  });

  describe('findByFarm()', () => {
    it('returns harvests for a farm', async () => {
      const harvests = [{ id: 'harvest-001' }];
      harvestRepo.find.mockResolvedValue(harvests);

      const result = await service.findByFarm('farm-001');

      expect(harvestRepo.find).toHaveBeenCalledWith({ where: { farmId: 'farm-001' } });
      expect(result).toEqual(harvests);
    });
  });

  describe('findById()', () => {
    it('returns harvest when found', async () => {
      const harvest = { id: 'harvest-001' };
      harvestRepo.findOne.mockResolvedValue(harvest);

      const result = await service.findById('harvest-001');

      expect(result).toEqual(harvest);
    });

    it('throws NotFoundException when not found', async () => {
      harvestRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByCooperative()', () => {
    it('returns harvests filtered by cooperativeId and optional campaignYear', async () => {
      const harvests = [{ id: 'harvest-001' }, { id: 'harvest-002' }];
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(harvests),
      };
      harvestRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.findByCooperative('coop-001', '2025/2026');

      expect(mockQb.where).toHaveBeenCalledWith('harvest.cooperative_id = :cooperativeId', {
        cooperativeId: 'coop-001',
      });
      expect(mockQb.andWhere).toHaveBeenCalledWith('harvest.campaign_year = :campaignYear', {
        campaignYear: '2025/2026',
      });
      expect(result).toEqual(harvests);
    });

    it('omits campaignYear filter when not provided', async () => {
      const mockQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      harvestRepo.createQueryBuilder.mockReturnValue(mockQb);

      await service.findByCooperative('coop-001');

      expect(mockQb.andWhere).not.toHaveBeenCalled();
    });
  });
});
