import { IsString, IsUUID, IsOptional, IsDateString, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitLabTestDto {
  @ApiProperty({ example: 'uuid-of-batch' })
  @IsUUID()
  batchId: string;

  @ApiPropertyOptional({ example: 'uuid-of-laboratory' })
  @IsOptional()
  @IsUUID()
  laboratoryId?: string;

  @ApiPropertyOptional({ example: '2026-01-15' })
  @IsOptional()
  @IsDateString()
  expectedResultDate?: string;
}

export class RecordLabTestResultDto {
  @ApiProperty({ example: 'uuid-of-lab-test' })
  @IsUUID()
  labTestId: string;

  @ApiProperty({
    example: {
      acidity: 0.8,
      peroxideValue: 8.5,
      color: 'golden_yellow',
      unsaponifiables: 1.2,
    },
    description: 'Measured parameter values keyed by parameter name',
  })
  @IsObject()
  testValues: Record<string, number | string>;

  @ApiPropertyOptional({ example: 'Hassan Moussaoui' })
  @IsOptional()
  @IsString()
  technicianName?: string;

  @ApiPropertyOptional({ example: 'Laboratoire ONSSA Agadir' })
  @IsOptional()
  @IsString()
  laboratoryName?: string;
}
