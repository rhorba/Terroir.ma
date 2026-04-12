import { IsOptional, IsString, MaxLength } from 'class-validator';

export class StartFinalReviewDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}
