import { IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ReportQueryDto {
  @ApiPropertyOptional({ example: '2025-01-01', description: 'Start date YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2025-12-31', description: 'End date YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
