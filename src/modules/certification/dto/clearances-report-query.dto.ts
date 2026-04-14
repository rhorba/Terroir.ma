import { IsOptional, IsDateString, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ClearancesReportQueryDto {
  @ApiPropertyOptional({ description: 'Filter clearances updated on or after this date' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Filter clearances updated on or before this date' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ description: 'ISO 3166-1 alpha-2 destination country code (e.g. FR, DE)' })
  @IsOptional()
  @IsString()
  destinationCountry?: string;
}
