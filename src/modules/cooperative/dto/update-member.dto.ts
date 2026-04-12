import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEmail, MaxLength } from 'class-validator';
import { IsMoroccanPhone } from '../../../common/dto/morocco-validators.dto';

/**
 * Fields a cooperative-member may update on their own profile.
 * CIN and fullName are immutable — they are tied to the legal registration.
 */
export class UpdateMemberDto {
  @ApiPropertyOptional({ example: '+212612345678', description: 'Moroccan phone number' })
  @IsOptional()
  @IsMoroccanPhone()
  phone?: string;

  @ApiPropertyOptional({ example: 'member@coop.ma', description: 'Contact email address' })
  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  email?: string;
}
