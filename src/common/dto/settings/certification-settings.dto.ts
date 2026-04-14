import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CertificationSettingsDto {
  @ApiProperty({ example: 365 })
  @IsInt()
  @Min(1)
  defaultValidityDays: number;

  @ApiProperty({ example: 90 })
  @IsInt()
  @Min(0)
  maxRenewalGraceDays: number;
}
