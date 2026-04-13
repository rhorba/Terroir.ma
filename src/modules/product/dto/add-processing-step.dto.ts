import { IsEnum, IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProcessingStepType } from '../entities/processing-step.entity';

export class AddProcessingStepDto {
  @ApiProperty({ enum: ProcessingStepType, description: 'Type of processing step' })
  @IsEnum(ProcessingStepType)
  stepType: ProcessingStepType;

  @ApiProperty({
    description: 'When the step was performed (ISO 8601)',
    example: '2026-04-10T08:00:00Z',
  })
  @IsDateString()
  doneAt: string;

  @ApiPropertyOptional({ description: 'Notes or observations', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
