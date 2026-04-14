import { IsArray, IsIn, ArrayNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class NotificationPreferenceDto {
  @ApiProperty({ type: [String], enum: ['email', 'sms'], example: ['email'] })
  channels: string[];

  @ApiProperty({ enum: ['ar', 'fr', 'zgh'], example: 'fr' })
  language: string;
}

export class UpsertNotificationPreferenceDto {
  @ApiProperty({ type: [String], enum: ['email', 'sms'] })
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(['email', 'sms'], { each: true })
  channels: string[];

  @ApiProperty({ enum: ['ar', 'fr', 'zgh'] })
  @IsString()
  @IsIn(['ar', 'fr', 'zgh'])
  language: string;
}
