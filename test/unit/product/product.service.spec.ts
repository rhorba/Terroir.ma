import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProductService } from '../../../src/modules/product/services/product.service';
import { Product } from '../../../src/modules/product/entities/product.entity';
import { ProductType } from '../../../src/modules/product/entities/product-type.entity';

const mockQb = {
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
};

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  findAndCount: jest.fn(),
  save: jest.fn(),
  create: jest.fn().mockImplementation((dto) => dto),
  update: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue(mockQb),
});

describe('ProductService', () => {
  let service: ProductService;
  let productRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: getRepositoryToken(Product), useFactory: mockRepo },
        { provide: getRepositoryToken(ProductType), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
    productRepo = module.get(getRepositoryToken(Product));
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findById()', () => {
    it('should return product when found', async () => {
      const mockProduct = { id: 'uuid-1', name: "Huile d'Argan", productTypeCode: 'ARGAN_OIL' };
      productRepo.findOne.mockResolvedValue(mockProduct);

      const result = await service.findById('uuid-1');
      expect(result).toEqual(mockProduct);
      expect(productRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'uuid-1' } }),
      );
    });

    it('should throw NotFoundException when product not found', async () => {
      productRepo.findOne.mockResolvedValue(null);
      await expect(service.findById('non-existent')).rejects.toThrow();
    });

    it('US-018: resolves for any authenticated user — inspector has no role restriction on this endpoint', async () => {
      const mockProduct = { id: 'uuid-1', productTypeCode: 'ARGAN_OIL' };
      productRepo.findOne.mockResolvedValue(mockProduct);
      // ProductController.findOne() uses JwtAuthGuard only (no RolesGuard) — inspector can access
      const result = await service.findById('uuid-1');
      expect(result).toEqual(mockProduct);
    });
  });

  describe('searchProducts() — US-015', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      // Reset the query builder mock after clearAllMocks
      mockQb.where.mockReturnValue(mockQb);
      mockQb.andWhere.mockReturnValue(mockQb);
      mockQb.orderBy.mockReturnValue(mockQb);
      mockQb.take.mockReturnValue(mockQb);
      mockQb.skip.mockReturnValue(mockQb);
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
    });

    it('applies productTypeCode filter when provided', async () => {
      await service.searchProducts({ productTypeCode: 'ARGAN_OIL' });
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('product_type_code'),
        expect.objectContaining({ code: 'ARGAN_OIL' }),
      );
    });

    it('applies regionCode subquery filter when provided', async () => {
      await service.searchProducts({ regionCode: 'SOUSS-MASSA' });
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('region_code'),
        expect.objectContaining({ regionCode: 'SOUSS-MASSA' }),
      );
    });

    it('applies no andWhere when no filters provided', async () => {
      await service.searchProducts({});
      expect(mockQb.andWhere).not.toHaveBeenCalled();
    });

    it('applies pagination defaults (page=1, limit=20)', async () => {
      await service.searchProducts({});
      expect(mockQb.take).toHaveBeenCalledWith(20);
      expect(mockQb.skip).toHaveBeenCalledWith(0);
    });

    it('caps limit at 100', async () => {
      await service.searchProducts({ limit: 999 });
      expect(mockQb.take).toHaveBeenCalledWith(100);
    });
  });

  // ─── exportProductRegistry() — US-020 ────────────────────────────────────

  describe('exportProductRegistry()', () => {
    const makeExportQb = (rows: unknown[]) => ({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(rows),
    });

    it('returns CSV with header and one data row', async () => {
      productRepo.createQueryBuilder.mockReturnValue(
        makeExportQb([
          {
            productId: 'uuid-1',
            name: "Huile d'Argan",
            productTypeCode: 'ARGAN',
            cooperativeId: 'coop-uuid',
            regionCode: 'SOUSS',
            status: 'active',
            registeredAt: new Date('2025-03-01'),
          },
        ]),
      );
      const csv = await service.exportProductRegistry();
      expect(csv).toContain('productId,name,productTypeCode');
      expect(csv).toContain('uuid-1');
      expect(csv).toContain('SOUSS');
    });

    it('returns header-only for empty result', async () => {
      productRepo.createQueryBuilder.mockReturnValue(makeExportQb([]));
      const csv = await service.exportProductRegistry();
      expect(csv.split('\n')).toHaveLength(1);
      expect(csv).toContain('productId,name');
    });
  });
});
