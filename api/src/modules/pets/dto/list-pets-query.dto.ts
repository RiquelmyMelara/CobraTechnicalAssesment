import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { PET_STATUS_VALUES, PetStatus } from '../../../common/enums/pet-status.enum.js';

export class ListPetsQueryDto {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  species?: string;

  /**
   * Defaults to 'available' so the public catalog hides adopted/pending
   * pets unless explicitly asked for them.
   */
  @IsOptional()
  @IsEnum(PET_STATUS_VALUES, { message: `status must be one of: ${PET_STATUS_VALUES.join(', ')}` })
  status?: PetStatus = PetStatus.AVAILABLE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}
