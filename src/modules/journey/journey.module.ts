import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JourneyController } from './journey.controller';
import { JourneyService } from './journey.service';
import { Journey, JourneySchema } from './schemas/journey.schema';
import { Settings, SettingsSchema } from './schemas/settings.schema';
import { AuthModule } from '../auth/auth.module';
import { CategoryModule } from '../category/category.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Journey.name,  schema: JourneySchema  },
      { name: Settings.name, schema: SettingsSchema },
    ]),
    AuthModule,
    CategoryModule, // gives CategoryModel
  ],
  controllers: [JourneyController],
  providers: [JourneyService],
  exports: [JourneyService, MongooseModule],
})
export class JourneyModule {}