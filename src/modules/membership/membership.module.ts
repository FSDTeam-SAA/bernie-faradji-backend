import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MembershipController } from './membership.controller';
import { MembershipService } from './membership.service';
import { Membership, MembershipSchema } from './schemas/membership.schema';
import { AuthModule } from '../auth/auth.module';
import { PlanModule } from '../plan/plan.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Membership.name, schema: MembershipSchema },
    ]),
    AuthModule,
    PlanModule,
  ],
  controllers: [MembershipController],
  providers: [MembershipService],
  exports: [MembershipService, MongooseModule],
})
export class MembershipModule {}