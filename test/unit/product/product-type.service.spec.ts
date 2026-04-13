import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProductTypeService } from '../../../src/modules/product/services/product-type.service';
import { ProductType } from '../../../src/modules/product/entities/product-type.entity';

const makeRepo = () => ({
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  create: jest.fn().mockImplementation((dto) => ({ ...dto })),
  save: jest.fn(),
  update: jest.fn(),
});

function buildProductType(overrides: Partial<ProductType> = {}): ProductType {
  return {
    id: 'pt-uuid',
    code: 'SAFFRON_TALIOUINE',
    nameFr: 'Safran de Taliouine',
    nameAr: 'زعفران تالوين',
    nameZgh: null,
    certificationType: 'IGP',
    regionCode: 'SOUSS_MASSA',
    labTestParameters: [],
    hsCode: null,
    onssaCategory: null,
    isActive: true,
    validityDays: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ProductType;
}

describe('ProductTypeService', () => {
  let service: ProductTypeService;
  let repo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    repo = makeRepo();
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductTypeService, { provide: getRepositoryToken(ProductType), useValue: repo }],
    }).compile();
    service = module.get<ProductTypeService>(ProductTypeService);
  });

  describe('findAll()', () => {
    it('returns paginated active product types', async () => {
      const pt = buildProductType();
      repo.findAndCount.mockResolvedValue([[pt], 1]);

      const [data, total] = await service.findAll(1, 20);

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
          skip: 0,
          take: 20,
        }),
      );
      expect(data).toEqual([pt]);
      expect(total).toBe(1);
    });
  });

  describe('findById()', () => {
    it('returns product type when found', async () => {
      const pt = buildProductType();
      repo.findOne.mockResolvedValue(pt);

      expect(await service.findById('pt-uuid')).toEqual(pt);
    });

    it('throws NotFoundException for unknown id', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findById('bad-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create()', () => {
    it('saves and returns new product type', async () => {
      const pt = buildProductType();
      repo.findOne.mockResolvedValue(null); // no duplicate
      repo.save.mockResolvedValue(pt);

      const result = await service.create({
        code: 'SAFFRON_TALIOUINE',
        nameFr: 'Safran de Taliouine',
        nameAr: 'زعفران تالوين',
        certificationType: 'IGP',
        regionCode: 'SOUSS_MASSA',
        labTestParameters: [],
      });

      expect(repo.save).toHaveBeenCalled();
      expect(result).toEqual(pt);
    });

    it('throws ConflictException on duplicate code', async () => {
      repo.findOne.mockResolvedValue(buildProductType());

      await expect(
        service.create({
          code: 'SAFFRON_TALIOUINE',
          nameFr: 'Dup',
          nameAr: 'dup',
          certificationType: 'IGP',
          regionCode: 'X',
          labTestParameters: [],
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update()', () => {
    it('updates and returns fresh product type', async () => {
      const original = buildProductType();
      const updated = buildProductType({ nameFr: 'Updated' });
      repo.findOne
        .mockResolvedValueOnce(original) // first findById (guard)
        .mockResolvedValueOnce(updated); // second findById (return fresh)
      repo.update.mockResolvedValue({ affected: 1 });

      const result = await service.update('pt-uuid', { nameFr: 'Updated' });

      expect(repo.update).toHaveBeenCalledWith({ id: 'pt-uuid' }, { nameFr: 'Updated' });
      expect(result.nameFr).toBe('Updated');
    });

    it('throws NotFoundException for unknown id', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.update('bad-uuid', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivate()', () => {
    it('sets isActive to false and returns updated type', async () => {
      const active = buildProductType({ isActive: true });
      const inactive = buildProductType({ isActive: false });
      repo.findOne
        .mockResolvedValueOnce(active) // guard check
        .mockResolvedValueOnce(inactive); // return after update
      repo.update.mockResolvedValue({ affected: 1 });

      const result = await service.deactivate('pt-uuid');

      expect(repo.update).toHaveBeenCalledWith({ id: 'pt-uuid' }, { isActive: false });
      expect(result.isActive).toBe(false);
    });

    it('throws ConflictException if already inactive', async () => {
      repo.findOne.mockResolvedValue(buildProductType({ isActive: false }));

      await expect(service.deactivate('pt-uuid')).rejects.toThrow(ConflictException);
    });
  });

  describe('update() — US-045 validityDays', () => {
    it('sets validityDays when provided', async () => {
      const original = buildProductType({ validityDays: null });
      const updated = buildProductType({ validityDays: 365 });
      repo.findOne.mockResolvedValueOnce(original).mockResolvedValueOnce(updated);
      repo.update.mockResolvedValue({ affected: 1 });

      const result = await service.update('pt-uuid', { validityDays: 365 });

      expect(repo.update).toHaveBeenCalledWith(
        { id: 'pt-uuid' },
        expect.objectContaining({ validityDays: 365 }),
      );
      expect(result.validityDays).toBe(365);
    });

    it('US-025: updates labTestParameters via existing PUT endpoint (PartialType inheritance)', async () => {
      const newParams = [{ name: 'acidity', unit: '%', minValue: 0.1, maxValue: 1.5 }];
      const original = buildProductType({ labTestParameters: [] });
      const updated = buildProductType({ labTestParameters: newParams });
      repo.findOne.mockResolvedValueOnce(original).mockResolvedValueOnce(updated);
      repo.update.mockResolvedValue({ affected: 1 });

      const result = await service.update('pt-uuid', { labTestParameters: newParams });

      expect(repo.update).toHaveBeenCalledWith(
        { id: 'pt-uuid' },
        expect.objectContaining({ labTestParameters: newParams }),
      );
      expect(result.labTestParameters).toEqual(newParams);
    });
  });
});
