import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, IsMongoId } from 'class-validator';
import { Transform } from 'class-transformer';

export const TOKEN_PRICE = 5; 

export class BuyTokenDto {
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  quantity: number;

  @IsString()
  @IsNotEmpty()
  vehicleNumber: string;
}

export class SelectWinnerManualDto {
  @IsMongoId()
  tokenId: string; // admin picks a specific token purchase record
}

export class GetTokensQueryDto {
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