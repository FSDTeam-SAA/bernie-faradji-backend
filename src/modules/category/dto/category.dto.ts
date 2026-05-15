import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  shortDetails?: string;

  @Transform(({ value }) => Number(value))
  rateActual: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  rateDiscounted?: number;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  shortDetails?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  rateActual?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  rateDiscounted?: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;
}

export class GetCategoriesQueryDto {
  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  date?: string;
}