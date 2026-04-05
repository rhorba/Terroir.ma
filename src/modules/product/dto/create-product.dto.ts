import { IsString, IsOptional, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({ example: 'Huile d\'argan vierge pressée à froid' })
  @IsString()
  @Length(3, 200)
  name: string;

  @ApiProperty({ example: 'ARGAN_OIL' })
  @IsString()
  @Length(2, 50)
  productTypeCode: string;

  @ApiPropertyOptional({ example: 'Huile d\'argan bio certifiée IGP Souss-Massa' })
  @IsOptional()
  @IsString()
  description?: string;
}
