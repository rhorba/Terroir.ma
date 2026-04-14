import { IsOptional, IsUUID, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class HsCodeQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by cooperative UUID (cooperative-admin is auto-scoped from JWT)',
  })
  @IsOptional()
  @IsUUID()
  cooperativeId?: string;

  @ApiPropertyOptional({ description: 'Filter HS codes assigned on or after this date' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Filter HS codes assigned on or before this date' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
