import { IsBoolean, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PlatformSettingsDto {
  @ApiProperty({ example: false })
  @IsBoolean()
  maintenanceMode: boolean;

  @ApiProperty({ example: 'support@terroir.ma' })
  @IsEmail()
  supportEmail: string;
}
