import { IsString, IsEmail, IsOptional, IsEnum, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsMoroccanCIN, IsMoroccanPhone } from '../../../common/dto/morocco-validators.dto';
import { MemberRole } from '../entities/member.entity';

export class AddMemberDto {
  @ApiProperty({ example: 'Amina Benali' })
  @IsString()
  @Length(3, 200)
  fullName: string;

  @ApiPropertyOptional({ example: 'أمينة بنعلي' })
  @IsOptional()
  @IsString()
  fullNameAr?: string;

  @ApiProperty({ example: 'CD789012' })
  @IsMoroccanCIN()
  cin: string;

  @ApiProperty({ example: '+212662345678' })
  @IsMoroccanPhone()
  phone: string;

  @ApiPropertyOptional({ example: 'amina@tifawin.ma' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ enum: ['president', 'secretary', 'treasurer', 'member'], default: 'member' })
  @IsEnum(['president', 'secretary', 'treasurer', 'member'])
  role: MemberRole;
}
