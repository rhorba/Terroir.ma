import { IsString, IsUUID, IsNumber, Length, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class RequestExportDocumentDto {
  @ApiProperty({ example: 'uuid-of-certification' })
  @IsUUID()
  certificationId: string;

  @ApiProperty({ example: 'FR', description: 'ISO 3166-1 alpha-2 destination country' })
  @IsString()
  @Length(2, 2)
  destinationCountry: string;

  @ApiProperty({ example: '1515.30', description: 'HS code for argan oil' })
  @IsString()
  @Length(4, 20)
  hsCode: string;

  @ApiProperty({ example: 5000 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(10_000_000)
  quantityKg: number;

  @ApiProperty({ example: 'Naturalia SAS' })
  @IsString()
  consigneeName: string;

  @ApiProperty({ example: 'FR' })
  @IsString()
  @Length(2, 2)
  consigneeCountry: string;
}
