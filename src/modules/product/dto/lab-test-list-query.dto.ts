import { IsOptional, IsUUID, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { LabTestStatus } from '../entities/lab-test.entity';

export class LabTestListQueryDto {
  @ApiPropertyOptional({ description: 'Filter by batch UUID' })
  @IsOptional()
  @IsUUID()
  batchId?: string;

  @ApiPropertyOptional({ description: 'Filter by cooperative UUID' })
  @IsOptional()
  @IsUUID()
  cooperativeId?: string;

  @ApiPropertyOptional({ enum: ['submitted', 'in_progress', 'completed', 'cancelled'] })
  @IsOptional()
  @IsEnum(['submitted', 'in_progress', 'completed', 'cancelled'])
  status?: LabTestStatus;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
