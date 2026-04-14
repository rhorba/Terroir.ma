import { IsOptional, IsDateString, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ComplianceExportQueryDto {
  @ApiPropertyOptional({ description: 'Filter certifications created on or after this date' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Filter certifications created on or before this date' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ description: 'Filter by current_status (e.g. GRANTED, DENIED)' })
  @IsOptional()
  @IsString()
  status?: string;
}
