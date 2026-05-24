import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import configs from './config';
import { LoggerModule } from './common/logger/logger.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './infrastructure/database/database.module';
import { CategoryModule } from './modules/category/category.module';
import { InsuranceModule } from './modules/insurance/insurance.module';
import { PlanModule } from './modules/plan/plan.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { TokenModule } from './modules/token/token.module';
import { PrizeModule } from './modules/prize/prize.module';
import { JourneyModule } from './modules/journey/journey.module';
import { AdminModule } from './modules/admin/admin.module';
import { UserDashboardModule } from './modules/user-dashboard/user-dashboard.module';
import { MembershipModule } from './modules/membership/membership.module';
import { TeamModule } from './modules/team/team.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: configs,
      envFilePath: '.env',
    }),

    ThrottlerModule.forRootAsync({
      useFactory: (configService: ConfigService) => [
        {
          ttl: configService.get<number>('app.rateLimitWindow', 15) * 60 * 1000,
          limit: configService.get<number>('app.rateLimitMax', 100),
        },
      ],
      inject: [ConfigService],
    }),

    LoggerModule,
    DatabaseModule,
    AuthModule,
    UserModule,
    CategoryModule,
    InsuranceModule,
    PlanModule,
    SubscriptionModule,
    TokenModule,
    PrizeModule,
    JourneyModule,
    AdminModule,
    MembershipModule,
    UserDashboardModule,
    TeamModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})


export class AppModule {}
