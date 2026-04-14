import { IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ProductExportQueryDto {
  @ApiPropertyOptional({ description: 'Filter products registered on or after this date' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Filter products registered on or before this date' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
