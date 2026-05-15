import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TokenController } from './token.controller';
import { TokenService } from './token.service';
import { Token, TokenSchema } from './schemas/token.schema';
import { Winner, WinnerSchema } from './schemas/winner.schema';
import { AuthModule } from '../auth/auth.module';
import { PrizeModule } from '../prize/prize.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Token.name,  schema: TokenSchema  },
      { name: Winner.name, schema: WinnerSchema },
    ]),
    AuthModule,
    PrizeModule, 
  ],
  controllers: [TokenController],
  providers: [TokenService],
  exports: [TokenService, MongooseModule],
})

export class TokenModule {}