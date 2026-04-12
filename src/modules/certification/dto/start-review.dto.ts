import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Body for POST /certifications/:id/start-review */
export class StartReviewDto {
  @ApiPropertyOptional({ description: 'Optional reviewer remarks' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}
