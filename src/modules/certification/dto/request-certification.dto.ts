import { IsString, IsUUID, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CertificationType } from '../../../common/interfaces/morocco.interface';

export class RequestCertificationDto {
  @ApiProperty({ example: 'uuid-of-batch' })
  @IsUUID()
  batchId: string;

  @ApiProperty({ example: 'SOUSS_MASSA' })
  @IsString()
  regionCode: string;

  @ApiProperty({ enum: ['IGP', 'AOP', 'LABEL_AGRICOLE'] })
  @IsEnum(['IGP', 'AOP', 'LABEL_AGRICOLE'])
  certificationType: CertificationType;

  @ApiProperty({ example: 'Coopérative Tifawin' })
  @IsString()
  cooperativeName: string;

  @ApiProperty({ example: 'ARGAN_OIL' })
  @IsString()
  productTypeCode: string;
}
