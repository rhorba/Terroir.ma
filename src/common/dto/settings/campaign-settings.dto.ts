import { IsString, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CampaignSettingsDto {
  @ApiProperty({ example: '2025-2026' })
  @IsString()
  currentCampaignYear: string;

  @ApiProperty({ example: 10, minimum: 1, maximum: 12 })
  @IsInt()
  @Min(1)
  @Max(12)
  campaignStartMonth: number;

  @ApiProperty({ example: 9, minimum: 1, maximum: 12 })
  @IsInt()
  @Min(1)
  @Max(12)
  campaignEndMonth: number;
}
