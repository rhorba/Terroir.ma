import { IsString, IsNotEmpty, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLabDto {
  @ApiProperty({ example: 'Laboratoire ONSSA Casablanca' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ example: 'ONSSA-2025-0042' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  onssaAccreditationNumber?: string;
}
