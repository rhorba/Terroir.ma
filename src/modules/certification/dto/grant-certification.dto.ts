import { IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GrantCertificationDto {
  @ApiProperty({ example: '2026-01-01' })
  @IsDateString()
  validFrom: string;

  @ApiProperty({ example: '2029-01-01' })
  @IsDateString()
  validUntil: string;
}
