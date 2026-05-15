import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { AuthModule } from '../auth/auth.module';
import { PlanModule } from '../plan/plan.module';
import { EmailModule } from '../../infrastructure/email/email.module';

@Module({
  imports: [
    AuthModule,   
    PlanModule,  
    EmailModule,
  ],
  controllers: [SubscriptionController],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})

export class SubscriptionModule {}