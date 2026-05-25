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


  @IsOptional()
  @IsString()
  serviceType?: string; // e.g. "JOURNEY" or "TOKEN"

  @IsOptional()
  @IsString()
  search?: string;


}

export class GetWeeklyQueryDto {
  @IsOptional()
  @IsString()
  week?: string; // e.g. "2026-05-14" — any date within the desired week
}