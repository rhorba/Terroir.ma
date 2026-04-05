import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { CreateProductDto } from '../dto/create-product.dto';

/**
 * Product service — manages product catalog for cooperatives.
 */
@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  async create(
    dto: CreateProductDto,
    cooperativeId: string,
    createdBy: string,
  ): Promise<Product> {
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
}
