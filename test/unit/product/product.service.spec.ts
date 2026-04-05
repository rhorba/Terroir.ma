import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProductService } from '../../../src/modules/product/services/product.service';
import { Product } from '../../../src/modules/product/entities/product.entity';
import { ProductType } from '../../../src/modules/product/entities/product-type.entity';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  findAndCount: jest.fn(),
  save: jest.fn(),
  create: jest.fn().mockImplementation((dto) => dto),
  update: jest.fn(),
  delete: jest.fn(),
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

  describe('findOne()', () => {
    it('should return product when found', async () => {
      const mockProduct = { id: 'uuid-1', name: 'Huile d\'Argan', productTypeCode: 'ARGAN_OIL' };
      productRepo.findOne.mockResolvedValue(mockProduct);

      const result = await service.findOne('uuid-1');
      expect(result).toEqual(mockProduct);
      expect(productRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'uuid-1' } }),
      );
    });

    it('should return null when product not found', async () => {
      productRepo.findOne.mockResolvedValue(null);
      const result = await service.findOne('non-existent');
      expect(result).toBeNull();
    });
  });
});
