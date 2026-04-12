import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Body for POST /certifications/:id/start-inspection */
export class StartInspectionDto {
  @ApiPropertyOptional({ description: 'Optional remarks from the inspector on arrival' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}
