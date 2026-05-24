import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TeamService } from './team.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleType } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateTeamDto, UpdateTeamDto, GetTeamQueryDto, TeamLoginDto } from './dto/team.dto';

@Controller('team')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  // Worker login via dashboard
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: TeamLoginDto) {
    return this.teamService.login(dto);
  }

  // SUPER_ADMIN: Create Worker Admin
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.SUPER_ADMIN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser('_id') superAdminId: string, @Body() dto: CreateTeamDto) {
    return this.teamService.create(superAdminId, dto);
  }

  // SUPER_ADMIN + ADMIN: Get all workers
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.ADMIN, RoleType.SUPER_ADMIN)
  @Get()
  getAll(@Query() query: GetTeamQueryDto) {
    return this.teamService.getAll(query);
  }

  // SUPER_ADMIN + ADMIN: Get single worker
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.ADMIN, RoleType.SUPER_ADMIN)
  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.teamService.getOne(id);
  }

  // SUPER_ADMIN: Update permissions/status
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.SUPER_ADMIN)
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTeamDto) {
    return this.teamService.update(id, dto);
  }

  // SUPER_ADMIN: Delete worker
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.SUPER_ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.teamService.remove(id);
  }
}