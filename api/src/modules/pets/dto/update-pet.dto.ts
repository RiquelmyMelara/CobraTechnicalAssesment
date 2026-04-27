import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  PET_STATUS_VALUES,
  PetStatus,
} from '../../../common/enums/pet-status.enum.js';

export class UpdatePetDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  species?: string;

  @IsOptional()
  // Allow `null` to explicitly clear the breed.
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(120)
  breed?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  ageYears?: number;

  @IsOptional()
  @IsString()
  @Length(1, 4000)
  description?: string;

  @IsOptional()
  @IsEnum(PET_STATUS_VALUES)
  status?: PetStatus;
}
