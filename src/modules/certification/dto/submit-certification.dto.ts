import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Body for POST /certifications/:id/submit — no required fields */
export class SubmitCertificationDto {
  @ApiPropertyOptional({ description: 'Optional remarks from the cooperative admin' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}
