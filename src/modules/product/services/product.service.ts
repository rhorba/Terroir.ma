import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { ProductType } from '../entities/product-type.entity';
import { CreateProductDto } from '../dto/create-product.dto';
import { SearchProductDto } from '../dto/search-product.dto';

/**
 * Product service — manages product catalog for cooperatives.
 */
@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  async create(dto: CreateProductDto, cooperativeId: string, createdBy: string): Promise<Product> {
    const product = this.productRepo.create({
      ...dto,
      description: dto.description ?? null,
      cooperativeId,
      createdBy,
    });
    return this.productRepo.save(product);
  }

  async findByCooperative(cooperativeId: string): Promise<Product[]> {
    return this.productRepo.find({ where: { cooperativeId } });
  }

  async findById(id: string): Promise<Product> {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException({
        code: 'PRODUCT_NOT_FOUND',
        message: `Product ${id} not found`,
      });
    }
    return product;
  }

  /**
   * Search products by SDOQ type code and/or region.
   * Region filtering uses a subquery against product.product_type (same schema — no cross-schema join).
   * Returns paginated results with total count.
   */
  async searchProducts(dto: SearchProductDto): Promise<[Product[], number]> {
    const page = Math.max(1, dto.page ?? 1);
    const limit = Math.min(dto.limit ?? 20, 100);

    const qb = this.productRepo.createQueryBuilder('p').where('p.deleted_at IS NULL');

    if (dto.productTypeCode) {
      qb.andWhere('p.product_type_code = :code', { code: dto.productTypeCode });
    }

    if (dto.regionCode) {
      qb.andWhere(
        `p.product_type_code IN (
          SELECT pt.code FROM product.product_type pt
          WHERE pt.region_code = :regionCode
        )`,
        { regionCode: dto.regionCode },
      );
    }

    return qb
      .orderBy('p.created_at', 'DESC')
      .take(limit)
      .skip((page - 1) * limit)
      .getManyAndCount();
  }

  /**
   * US-020: Export product registry as a CSV string.
   * Columns: productId, name, productTypeCode, cooperativeId, regionCode, status, registeredAt
   */
  async exportProductRegistry(from?: string, to?: string): Promise<string> {
    const qb = this.productRepo
      .createQueryBuilder('p')
      .select('p.id', 'productId')
      .addSelect('p.name', 'name')
      .addSelect('p.productTypeCode', 'productTypeCode')
      .addSelect('p.cooperativeId', 'cooperativeId')
      .leftJoin(ProductType, 'pt', 'pt.code = p.productTypeCode')
      .addSelect('pt.regionCode', 'regionCode')
      .addSelect('p.createdAt', 'registeredAt')
      .where('p.deletedAt IS NULL')
      .orderBy('p.createdAt', 'DESC');

    if (from) qb.andWhere('p.createdAt >= :from', { from });
    if (to) qb.andWhere('p.createdAt <= :to', { to });

    const rows = await qb.getRawMany<{
      productId: string;
      name: string;
      productTypeCode: string;
      cooperativeId: string;
      regionCode: string | null;
      registeredAt: Date;
    }>();

    const header = 'productId,name,productTypeCode,cooperativeId,regionCode,registeredAt';

    const csvRows = rows.map((r) =>
      [
        r.productId,
        `"${r.name.replace(/"/g, '""')}"`,
        r.productTypeCode,
        r.cooperativeId,
        r.regionCode ?? '',
        r.registeredAt.toISOString(),
      ].join(','),
    );

    return [header, ...csvRows].join('\n');
  }
}
