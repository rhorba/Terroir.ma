import { IsOptional, IsISO8601 } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class NotificationStatsQueryDto {
  @ApiPropertyOptional({ description: 'Filter from date (ISO 8601)', example: '2026-01-01' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'Filter to date (ISO 8601)', example: '2026-12-31' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
