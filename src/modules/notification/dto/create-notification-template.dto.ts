import { IsString, IsIn, IsOptional, IsBoolean, Length, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNotificationTemplateDto {
  @ApiProperty({
    example: 'certification-granted',
    description: 'Template code matching notification event',
  })
  @IsString()
  @Length(1, 100)
  code: string;

  @ApiProperty({ example: 'email', enum: ['email', 'sms'] })
  @IsIn(['email', 'sms'])
  channel: string;

  @ApiProperty({ example: 'fr-MA', enum: ['fr-MA', 'ar-MA', 'zgh'] })
  @IsIn(['fr-MA', 'ar-MA', 'zgh'])
  language: string;

  @ApiPropertyOptional({ example: 'Votre certificat {{certificationNumber}} a été délivré' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  subjectTemplate?: string;

  @ApiProperty({ example: '<p>Bonjour {{cooperativeName}},</p>' })
  @IsString()
  bodyTemplate: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
