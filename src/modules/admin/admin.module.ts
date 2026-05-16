import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthModule } from '../auth/auth.module';
import { JourneyModule } from '../journey/journey.module';
import { TokenModule } from '../token/token.module';
import { CategoryModule } from '../category/category.module';

@Module({
  imports: [
    AuthModule,
    JourneyModule,
    TokenModule,
    CategoryModule, // gives CategoryModel for category stats
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}