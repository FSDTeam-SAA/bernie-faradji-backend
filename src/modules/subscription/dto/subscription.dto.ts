import { IsOptional, IsString, IsDateString, IsNotEmpty } from 'class-validator';

export class BuySubscriptionDto {
  @IsNotEmpty()
  @IsDateString()
  startDate: string; // user selected start date e.g. "2026-05-20"
}

export class GetSubscriptionsQueryDto {
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
