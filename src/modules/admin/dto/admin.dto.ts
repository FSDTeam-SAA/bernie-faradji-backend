import { IsOptional, IsString } from 'class-validator';

export class GetTransactionsQueryDto {
  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;

  @IsOptional()
  @IsString()
  date?: string;
}

export class GetWeeklyQueryDto {
  @IsOptional()
  @IsString()
  week?: string; // e.g. "2026-05-14" — any date within the desired week
}