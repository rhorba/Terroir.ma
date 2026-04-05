import { IsBoolean, IsString, IsArray, IsOptional, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class FarmFindingDto {
  @IsString()
  farmId: string;

  @IsString()
  findings: string;

  @IsBoolean()
  passed: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];
}

class NonConformityDto {
  @IsString()
  code: string;

  @IsString()
  description: string;

  @IsString()
  severity: 'minor' | 'major' | 'critical';

  @IsOptional()
  @IsString()
  corrective_action?: string;
}

export class CompleteInspectionDto {
  @ApiProperty()
  @IsBoolean()
  passed: boolean;

  @ApiProperty({ example: 'Inspection completed successfully. No major non-conformities found.' })
  @IsString()
  summary: string;

  @ApiPropertyOptional({ type: [FarmFindingDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FarmFindingDto)
  farmFindings?: FarmFindingDto[];

  @ApiPropertyOptional({ type: [NonConformityDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NonConformityDto)
  nonConformities?: NonConformityDto[];
}
