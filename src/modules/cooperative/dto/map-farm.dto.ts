import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  Length,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class MapFarmDto {
  @ApiProperty({ example: 'Ferme Arganier Tifawin Nord' })
  @IsString()
  @Length(3, 200)
  name: string;

  @ApiProperty({ example: 5.5 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  areaHectares: number;

  @ApiProperty({ example: ['ARGAN_OIL'] })
  @IsArray()
  @IsString({ each: true })
  cropTypes: string[];

  @ApiProperty({ example: 'SOUSS_MASSA' })
  @IsString()
  regionCode: string;

  @ApiPropertyOptional({ example: 'Tiznit' })
  @IsOptional()
  @IsString()
  commune?: string;

  @ApiPropertyOptional({ example: 29.6974 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: -9.8022 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}
