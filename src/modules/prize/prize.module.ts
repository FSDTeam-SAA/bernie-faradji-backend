import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PrizeController } from './prize.controller';
import { PrizeService } from './prize.service';
import { Prize, PrizeSchema } from './schemas/prize.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Prize.name, schema: PrizeSchema },
    ]),
    AuthModule,
  ],
  controllers: [PrizeController],
  providers: [PrizeService],
  exports: [PrizeService, MongooseModule], // export so TokenModule can use Prize model
})
export class PrizeModule {}