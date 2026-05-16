import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PlanController } from './plan.controller';
import { PlanService } from './plan.service';
import { Plan, PlanSchema } from './schemas/plan.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Plan.name, schema: PlanSchema }]),
    AuthModule, // gives UserModel for subscriber count
  ],
  controllers: [PlanController],
  providers: [PlanService],
  exports: [PlanService, MongooseModule],
})
export class PlanModule {}