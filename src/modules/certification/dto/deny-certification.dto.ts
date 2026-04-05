import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DenyCertificationDto {
  @ApiProperty({ example: 'Lab test parameters for acidity exceeded maximum allowed values.' })
  @IsString()
  @MinLength(10)
  reason: string;
}
