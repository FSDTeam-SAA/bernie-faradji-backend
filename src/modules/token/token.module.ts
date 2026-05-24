import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { TokenController } from './token.controller';
import { TokenService } from './token.service';
import { TokenCronService } from './token.cron.service';
import { Token, TokenSchema } from './schemas/token.schema';
import { Winner, WinnerSchema } from './schemas/winner.schema';
import { AuthModule } from '../auth/auth.module';
import { PrizeModule } from '../prize/prize.module';
import { EmailModule } from '../../infrastructure/email/email.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Token.name,  schema: TokenSchema  },
      { name: Winner.name, schema: WinnerSchema },
    ]),
    ScheduleModule.forRoot(),
    AuthModule,
    PrizeModule,
    EmailModule,
  ],
  controllers: [TokenController],
  providers: [TokenService, TokenCronService],
  exports: [TokenService, MongooseModule],
})
export class TokenModule {}