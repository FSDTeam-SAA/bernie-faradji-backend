import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserDashboardService } from './user-dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('user-dashboard')
@UseGuards(JwtAuthGuard)
export class UserDashboardController {
  constructor(private readonly userDashboardService: UserDashboardService) {}

  // ─── User: Stats (total tokens + total journeys) ──────
  @Get('stats')
  getStats(@CurrentUser('_id') userId: string) {
    return this.userDashboardService.getStats(userId);
  }
}