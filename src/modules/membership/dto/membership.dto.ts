import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class UpdateMembershipStatusDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['PENDING', 'ACTIVE', 'CLEARED', 'EXPIRED'])
  status: string;
}

export class GetMembershipsQueryDto {
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