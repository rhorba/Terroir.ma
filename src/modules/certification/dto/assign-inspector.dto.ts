import { IsUUID, IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignInspectorDto {
  @ApiProperty({ description: 'Keycloak UUID of the inspector to assign' })
  @IsUUID()
  inspectorId: string;

  @ApiProperty({ description: 'Display name of the inspector', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  inspectorName: string;
}
