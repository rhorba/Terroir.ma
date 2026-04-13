import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateProductTypeDto } from './create-product-type.dto';

export class UpdateProductTypeDto extends PartialType(CreateProductTypeDto) {
  @ApiPropertyOptional({ description: 'Certificate validity in days (1–3650)', example: 365 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  validityDays?: number;
}
