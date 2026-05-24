import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleType } from '../../common/enums/role.enum';
import { GetTransactionsQueryDto, GetWeeklyQueryDto } from './dto/admin.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.ADMIN, RoleType.SUPER_ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ─── Dashboard Stats (cards) ──────────────────────────
  @Get('dashboard/stats')
  getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  // ─── Dashboard Charts (weekly earnings + category %) ──
  @Get('dashboard/charts')
  getDashboardCharts(@Query() query: GetWeeklyQueryDto) {
    return this.adminService.getDashboardCharts(query.week);
  }

  // ─── Transactions ──────────────────────────────────────
  @Get('transactions')
  getAllTransactions(@Query() query: GetTransactionsQueryDto) {
    return this.adminService.getAllTransactions(query);
  }

  @Get('transactions/:id')
  getOneTransaction(
    @Param('id') id: string,
    @Query('type') type: string,
  ) {
    return this.adminService.getOneTransaction(id, type);
  }

}