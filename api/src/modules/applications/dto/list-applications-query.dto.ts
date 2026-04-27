import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  APPLICATION_STATUS_VALUES,
  ApplicationStatus,
} from '../../../common/enums/application-status.enum.js';

export class ListApplicationsQueryDto {
  @IsOptional()
  @IsEnum(APPLICATION_STATUS_VALUES)
  status?: ApplicationStatus;

  @IsOptional()
  @IsUUID()
  petId?: string;

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
