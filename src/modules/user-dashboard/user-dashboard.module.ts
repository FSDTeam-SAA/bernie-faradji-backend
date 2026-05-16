import { Module } from '@nestjs/common';
import { UserDashboardController } from './user-dashboard.controller';
import { UserDashboardService } from './user-dashboard.service';
import { AuthModule } from '../auth/auth.module';
import { JourneyModule } from '../journey/journey.module';
import { TokenModule } from '../token/token.module';

@Module({
  imports: [
    AuthModule,
    JourneyModule, // gives JourneyModel
    TokenModule,   // gives TokenModel
  ],
  controllers: [UserDashboardController],
  providers: [UserDashboardService],
})
export class UserDashboardModule {}