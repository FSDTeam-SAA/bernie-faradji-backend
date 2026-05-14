import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreatePrizeDto {
  @IsString()
  @IsNotEmpty()
  prizeTag: string;
}

export class UpdatePrizeDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  prizeTag?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;
}

export class GetPrizesQueryDto {
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