import {
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePetDto {
  @IsString()
  @Length(1, 120)
  name!: string;

  @IsString()
  @Length(1, 80)
  species!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  breed?: string;

  @IsInt()
  @Min(0)
  @Max(60)
  ageYears!: number;

  @IsString()
  @Length(1, 4000)
  description!: string;
}
