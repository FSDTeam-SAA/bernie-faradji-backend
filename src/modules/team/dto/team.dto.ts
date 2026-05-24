import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsArray,
  IsIn,
  IsBoolean,
} from 'class-validator';
import { TeamPermission } from '../schemas/team.schema';

const ALL_PERMISSIONS = Object.values(TeamPermission);

export class CreateTeamDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsArray()
  @IsIn(ALL_PERMISSIONS, { each: true })
  permissions: string[];
}

export class UpdateTeamDto {
  @IsOptional()
  @IsArray()
  @IsIn(ALL_PERMISSIONS, { each: true })
  permissions?: string[];

  @IsOptional()
  @IsString()
  @IsIn(['Active', 'Suspended'])
  status?: string;

  @IsOptional()
  @IsBoolean()
  isSuspended?: boolean;
}

export class GetTeamQueryDto {
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
}

export class TeamLoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
