import { IsUUID, IsDateString, IsArray, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ScheduleInspectionDto {
  @ApiProperty({ example: 'uuid-of-certification' })
  @IsUUID()
  certificationId: string;

  @ApiProperty({ example: 'uuid-of-inspector' })
  @IsUUID()
  inspectorId: string;

  @ApiPropertyOptional({ example: 'Youssef El Mansouri' })
  @IsOptional()
  @IsString()
  inspectorName?: string;

  @ApiProperty({ example: '2026-04-15' })
  @IsDateString()
  scheduledDate: string;

  @ApiProperty({ example: ['uuid-farm-1', 'uuid-farm-2'] })
  @IsArray()
  @IsUUID(undefined, { each: true })
  farmIds: string[];
}
