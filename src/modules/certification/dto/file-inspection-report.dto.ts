import { IsString, IsBoolean, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FileInspectionReportDto {
  @ApiProperty({ description: 'Did the cooperative pass the inspection?' })
  @IsBoolean()
  passed: boolean;

  @ApiProperty({ description: 'Summary of inspection findings (min 20 chars)' })
  @IsString()
  @MinLength(20)
  reportSummary: string;

  @ApiPropertyOptional({ description: 'Detailed observations in Markdown' })
  @IsOptional()
  @IsString()
  detailedObservations?: string;

  @ApiPropertyOptional({ description: 'Non-conformities found (if any)' })
  @IsOptional()
  @IsString()
  nonConformities?: string;
}
