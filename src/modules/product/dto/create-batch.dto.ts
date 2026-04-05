import {
  IsString,
  IsNumber,
  IsArray,
  IsDateString,
  Length,
  Min,
  Max,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateBatchDto {
  @ApiProperty({ example: 'ARGAN_OIL' })
  @IsString()
  @Length(2, 50)
  productTypeCode: string;

  @ApiProperty({ example: ['uuid-1', 'uuid-2'], description: 'Harvest IDs to group into this batch' })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  harvestIds: string[];

  @ApiProperty({ example: 3800.75, description: 'Total quantity in kg' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(10_000_000)
  totalQuantityKg: number;

  @ApiProperty({ example: '2025-12-01', description: 'Date of processing' })
  @IsDateString()
  processingDate: string;
}
