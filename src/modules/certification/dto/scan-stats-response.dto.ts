import { IsUUID, IsInt, IsDateString, IsOptional } from 'class-validator';

/**
 * Response shape for GET /certifications/:id/scan-stats
 * US-058
 */
export class ScanStatsResponseDto {
  @IsUUID()
  certificationId: string;

  @IsInt()
  totalScans: number;

  @IsInt()
  last30DaysScans: number;

  @IsDateString()
  @IsOptional()
  firstScanAt: string | null;

  @IsDateString()
  @IsOptional()
  lastScanAt: string | null;
}
