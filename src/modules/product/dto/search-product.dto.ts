import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Query params for GET /products
 * Filters by productTypeCode (exact) and/or regionCode (via ProductType join).
 */
export class SearchProductDto {
  @ApiPropertyOptional({ example: 'ARGAN_OIL', description: 'Exact SDOQ product type code' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  productTypeCode?: string;

  @ApiPropertyOptional({
    example: 'SOUSS-MASSA',
    description: 'Region code (matched via ProductType)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  regionCode?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
