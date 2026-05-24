import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MembershipService } from './membership.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RoleType } from '../../common/enums/role.enum';
import { UpdateMembershipStatusDto, GetMembershipsQueryDto } from './dto/membership.dto';

@Controller('memberships')
@UseGuards(JwtAuthGuard)
export class MembershipController {
  constructor(private readonly membershipService: MembershipService) {}

  // ─── User: My Membership ──────────────────────────────
  @Get('my')
  getMyMembership(@CurrentUser() user: any) {
    return this.membershipService.getMyMembership(user);
  }

  // ─── Admin: Get All ───────────────────────────────────
  @UseGuards(RolesGuard)
  @Roles(RoleType.ADMIN, RoleType.SUPER_ADMIN)
  @Get('all')
  getAll(@Query() query: GetMembershipsQueryDto) {
    return this.membershipService.getAll(query);
  }

  // ─── Admin: Get Single ────────────────────────────────
  @UseGuards(RolesGuard)
  @Roles(RoleType.ADMIN, RoleType.SUPER_ADMIN)
  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.membershipService.getOne(id);
  }

  // ─── Admin: Update Status ─────────────────────────────
  @UseGuards(RolesGuard)
  @Roles(RoleType.ADMIN, RoleType.SUPER_ADMIN)
  @Put(':id/status')
  @HttpCode(HttpStatus.OK)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateMembershipStatusDto,
  ) {
    return this.membershipService.updateStatus(id, dto);
  }
}
