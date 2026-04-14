import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { ProductService } from '../services/product.service';
import { CreateProductDto } from '../dto/create-product.dto';
import { SearchProductDto } from '../dto/search-product.dto';
import { ProductExportQueryDto } from '../dto/product-export-query.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { Product } from '../entities/product.entity';

@ApiTags('products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('cooperative-admin', 'cooperative-member')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a product for a cooperative' })
  async create(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<Product> {
    const cooperativeId = user.cooperative_id ?? '';
    return this.productService.create(dto, cooperativeId, user.sub);
  }

  /**
   * US-020: Export product registry as CSV.
   * Registered before GET /:id to avoid NestJS param collision.
   */
  @Get('export')
  @UseGuards(RolesGuard)
  @Roles('super-admin')
  @ApiOperation({ summary: 'US-020: Export product registry as CSV (super-admin)' })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  async exportProductRegistry(
    @Query() query: ProductExportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const csv = await this.productService.exportProductRegistry(query.from, query.to);
    const date = new Date().toISOString().slice(0, 10);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="products-${date}.csv"`,
    });
    return new StreamableFile(Buffer.from(csv, 'utf-8'));
  }

  /** Search products by SDOQ type and/or region (US-015) */
  @Get()
  @ApiOperation({ summary: 'Search products by SDOQ type and region (US-015)' })
  async searchProducts(@Query() dto: SearchProductDto): Promise<{
    success: boolean;
    data: Product[];
    meta: { page: number; limit: number; total: number };
  }> {
    const [data, total] = await this.productService.searchProducts(dto);
    const page = Math.max(1, dto.page ?? 1);
    const limit = Math.min(dto.limit ?? 20, 100);
    return { success: true, data, meta: { page, limit, total } };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  async findOne(@Param('id') id: string): Promise<Product> {
    return this.productService.findById(id);
  }

  @Get('cooperative/:cooperativeId')
  @ApiOperation({ summary: 'Get all products for a cooperative' })
  async findByCooperative(@Param('cooperativeId') cooperativeId: string): Promise<Product[]> {
    return this.productService.findByCooperative(cooperativeId);
  }
}
