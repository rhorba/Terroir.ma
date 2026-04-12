import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CertificationType } from '../../../common/interfaces/morocco.interface';

class LabTestParameterDto {
  @ApiProperty({ description: 'Parameter name (e.g., acidity)', example: 'acidity' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Unit of measurement', example: '%' })
  @IsString()
  @IsNotEmpty()
  unit: string;

  @ApiPropertyOptional({ description: 'Minimum acceptable value' })
  @IsOptional()
  @IsNumber()
  minValue?: number;

  @ApiPropertyOptional({ description: 'Maximum acceptable value' })
  @IsOptional()
  @IsNumber()
  maxValue?: number;

  @ApiPropertyOptional({ description: 'Parameter type (numeric, enum)', example: 'numeric' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Allowed enum values', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  values?: string[];
}

export class CreateProductTypeDto {
  @ApiProperty({ description: 'Unique product type code', example: 'SAFFRON_TALIOUINE' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @ApiProperty({ description: 'French name', example: 'Safran de Taliouine' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nameFr: string;

  @ApiProperty({ description: 'Arabic name', example: 'زعفران تالوين' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nameAr: string;

  @ApiPropertyOptional({ description: 'Amazigh (Tifinagh) name', example: 'ⵣⵄⴼⵔⴰⵏ' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nameZgh?: string;

  @ApiProperty({ description: 'SDOQ certification type', enum: ['IGP', 'AOP', 'LA'] })
  @IsEnum(['IGP', 'AOP', 'LA'])
  certificationType: CertificationType;

  @ApiProperty({ description: 'Region code', example: 'SOUSS_MASSA' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  regionCode: string;

  @ApiProperty({ description: 'Required lab test parameters', type: [LabTestParameterDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LabTestParameterDto)
  labTestParameters: LabTestParameterDto[];

  @ApiPropertyOptional({ description: 'HS code for customs', example: '0910.20' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  hsCode?: string;

  @ApiPropertyOptional({ description: 'ONSSA category code' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  onssaCategory?: string;
}
