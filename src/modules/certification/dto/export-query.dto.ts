import { IsOptional, IsDateString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CertificationStatus } from '../entities/certification.entity';

export class ExportQueryDto {
  @ApiPropertyOptional({ description: 'Start date filter (YYYY-MM-DD)', example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'End date filter (YYYY-MM-DD)', example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ enum: CertificationStatus, description: 'Filter by certification status' })
  @IsOptional()
  @IsEnum(CertificationStatus)
  status?: CertificationStatus;
}
