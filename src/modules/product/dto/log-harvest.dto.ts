import {
  IsString,
  IsNumber,
  IsDateString,
  IsOptional,
  IsObject,
  Length,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class LogHarvestDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsString()
  farmId: string;

  @ApiProperty({ example: 'ARGAN_OIL' })
  @IsString()
  @Length(2, 50)
  productTypeCode: string;

  @ApiProperty({ example: 1250.5, description: 'Quantity in kilograms' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(1_000_000)
  quantityKg: number;

  @ApiProperty({ example: '2025-11-15', description: 'ISO 8601 date' })
  @IsDateString()
  harvestDate: string;

  @ApiProperty({ example: '2025/2026' })
  @IsString()
  @Matches(/^\d{4}\/\d{4}$/, { message: 'campaignYear must be in YYYY/YYYY format' })
  campaignYear: string;

  @ApiProperty({ example: 'manual_picking', description: 'Harvest method' })
  @IsString()
  @Length(2, 100)
  method: string;

  @ApiPropertyOptional({ example: { weatherCondition: 'sunny', workers: 12 } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
