import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/** Body for POST /certifications/:id/request-lab */
export class RequestLabDto {
  @ApiPropertyOptional({ description: 'UUID of the accredited laboratory to receive samples' })
  @IsOptional()
  @IsUUID()
  labId?: string;

  @ApiPropertyOptional({ description: 'Optional remarks about the lab request' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}
