import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ProductTypeService } from '../services/product-type.service';
import { CreateProductTypeDto } from '../dto/create-product-type.dto';
import { UpdateProductTypeDto } from '../dto/update-product-type.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ProductType } from '../entities/product-type.entity';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * ProductTypeController — CRUD for SDOQ product types.
 * US-016: super-admins manage the canonical list of recognized designations.
 */
@ApiTags('product-types')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('product-types')
export class ProductTypeController {
  constructor(private readonly productTypeService: ProductTypeService) {}

  /** US-016 — List active SDOQ product types (all authenticated roles) */
  @Get()
  @ApiOperation({ summary: 'US-016: List active SDOQ product types' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @Query() query: PaginationDto,
  ): Promise<{ data: ProductType[]; meta: { page: number; limit: number; total: number } }> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(query.limit ?? 20, 100);
    const [data, total] = await this.productTypeService.findAll(page, limit);
    return { data, meta: { page, limit, total } };
  }

  /** US-016 — Get a product type by ID */
  @Get(':id')
  @ApiOperation({ summary: 'US-016: Get SDOQ product type by ID' })
  async findOne(@Param('id') id: string): Promise<ProductType> {
    return this.productTypeService.findById(id);
  }

  /** US-016 — Create a new product type (super-admin) */
  @Post()
  @UseGuards(RolesGuard)
  @Roles('super-admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'US-016: Create SDOQ product type (super-admin)' })
  async create(@Body() dto: CreateProductTypeDto): Promise<ProductType> {
    return this.productTypeService.create(dto);
  }

  /** US-016 — Update a product type (super-admin) */
  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('super-admin')
  @ApiOperation({ summary: 'US-016: Update SDOQ product type (super-admin)' })
  async update(@Param('id') id: string, @Body() dto: UpdateProductTypeDto): Promise<ProductType> {
    return this.productTypeService.update(id, dto);
  }

  /** US-016 — Soft-deactivate a product type (super-admin) */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('super-admin')
  @ApiOperation({ summary: 'US-016: Deactivate SDOQ product type (super-admin)' })
  async deactivate(@Param('id') id: string): Promise<ProductType> {
    return this.productTypeService.deactivate(id);
  }
}
