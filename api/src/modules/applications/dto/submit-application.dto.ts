import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SubmitApplicationDto {
  @IsUUID()
  petId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}
