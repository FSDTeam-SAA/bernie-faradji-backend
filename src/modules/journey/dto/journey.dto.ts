import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsDateString,
  IsMongoId,
  Min,
  IsIn,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class BuyJourneyPassDto {
  @IsMongoId()
  categoryId: string;

  @IsString()
  @IsNotEmpty()
  vehicleNumber: string;

  @IsDateString()
  preferredDate: string; // e.g. "2026-05-14"
  @IsOptional()
  @IsString()
  subOption?: string; // e.g. 'Blackwall' or 'Silvertown'
 
  @IsOptional()
  @IsString()
  @IsIn(['one-way', 'return'])
  journeyType?: string; // default: 'one-way'
}



export class UpdateLateFeeDto {
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0)
  lateFee: number;
}

export class GetJourneysQueryDto {
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
  status?: string;

  @IsOptional()
  @IsString()
  date?: string;
}
