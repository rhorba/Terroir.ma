import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductType } from '../entities/product-type.entity';
import { CreateProductTypeDto } from '../dto/create-product-type.dto';
import { UpdateProductTypeDto } from '../dto/update-product-type.dto';

/**
 * ProductTypeService — manages SDOQ product type catalog.
 * US-016: super-admins create, update, and soft-deactivate product types.
 */
@Injectable()
export class ProductTypeService {
  private readonly logger = new Logger(ProductTypeService.name);

  constructor(
    @InjectRepository(ProductType)
    private readonly productTypeRepo: Repository<ProductType>,
  ) {}

  /**
   * List active product types, paginated and sorted by French name.
   */
  async findAll(page = 1, limit = 20): Promise<[ProductType[], number]> {
    return this.productTypeRepo.findAndCount({
      where: { isActive: true },
      order: { nameFr: 'ASC' },
      skip: (page - 1) * limit,
      take: Math.min(limit, 100),
    });
  }

  /**
   * Find a single product type by ID.
   * @throws NotFoundException if not found
   */
  async findById(id: string): Promise<ProductType> {
    const pt = await this.productTypeRepo.findOne({ where: { id } });
    if (!pt) {
      throw new NotFoundException({
        code: 'PRODUCT_TYPE_NOT_FOUND',
        message: `Product type ${id} not found`,
      });
    }
    return pt;
  }

  /**
   * Create a new SDOQ product type.
   * @throws ConflictException if the code is already in use
   */
  async create(dto: CreateProductTypeDto): Promise<ProductType> {
    const existing = await this.productTypeRepo.findOne({ where: { code: dto.code } });
    if (existing) {
      throw new ConflictException({
        code: 'PRODUCT_TYPE_CODE_EXISTS',
        message: `Product type code '${dto.code}' already exists`,
      });
    }
    const pt = this.productTypeRepo.create({
      ...dto,
      nameZgh: dto.nameZgh ?? null,
      hsCode: dto.hsCode ?? null,
      onssaCategory: dto.onssaCategory ?? null,
      isActive: true,
    });
    const saved = await this.productTypeRepo.save(pt);
    this.logger.log({ productTypeId: saved.id, code: saved.code }, 'Product type created');
    return saved;
  }

  /**
   * Update a product type's fields.
   * @throws NotFoundException if not found
   */
  async update(id: string, dto: UpdateProductTypeDto): Promise<ProductType> {
    await this.findById(id);
    await this.productTypeRepo.update({ id }, { ...dto });
    return this.findById(id);
  }

  /**
   * Soft-deactivate a product type (sets isActive = false).
   * Historical products/certifications referencing this code are unaffected.
   * @throws NotFoundException if not found
   * @throws ConflictException if already inactive
   */
  async deactivate(id: string): Promise<ProductType> {
    const pt = await this.findById(id);
    if (!pt.isActive) {
      throw new ConflictException({
        code: 'PRODUCT_TYPE_ALREADY_INACTIVE',
        message: 'Product type is already inactive',
      });
    }
    await this.productTypeRepo.update({ id }, { isActive: false });
    this.logger.log({ productTypeId: id }, 'Product type deactivated');
    return this.findById(id);
  }
}
