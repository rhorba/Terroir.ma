import { IsString, IsEmail, Length, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsMoroccanICE,
  IsMoroccanPhone,
  IsMoroccanCIN,
  IsMoroccanIF,
} from '../../../common/dto/morocco-validators.dto';

export class CreateCooperativeDto {
  @ApiProperty({ example: 'Coopérative Tifawin' })
  @IsString()
  @Length(3, 200)
  name: string;

  @ApiPropertyOptional({ example: 'تعاونية تيفاوين' })
  @IsOptional()
  @IsString()
  @Length(3, 200)
  nameAr?: string;

  @ApiProperty({ example: '001234567891234' })
  @IsMoroccanICE()
  ice: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMoroccanIF()
  ifNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rcNumber?: string;

  @ApiProperty({ example: 'contact@tifawin.ma' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+212661234567' })
  @IsMoroccanPhone()
  phone: string;

  @ApiProperty({ example: 'SOUSS_MASSA' })
  @IsString()
  regionCode: string;

  @ApiProperty({ example: 'Tiznit' })
  @IsString()
  city: string;

  @ApiProperty({ example: 'Fatima Zahra Ait Benhamed' })
  @IsString()
  @Length(3, 200)
  presidentName: string;

  @ApiProperty({ example: 'AB123456' })
  @IsMoroccanCIN()
  presidentCin: string;

  @ApiProperty({ example: '+212661234568' })
  @IsMoroccanPhone()
  presidentPhone: string;

  @ApiPropertyOptional({ example: ['ARGAN_OIL', 'SAFFRON'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productTypes?: string[];
}
