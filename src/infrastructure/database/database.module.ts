import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { AppLogger } from '../../common/logger/app-logger.service';
import mongoose from 'mongoose';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: (configService: ConfigService, logger: AppLogger) => {
        mongoose.set('strictQuery', true);
        logger.setContext('Database');

        const uri = configService.get<string>('database.uri');
        const env = configService.get<string>('app.env');

        mongoose.connection.on('connected', () => {
          if (env !== 'production') logger.log('MongoDB connected successfully');
        });

        mongoose.connection.on('error', (err) => {
          logger.error('MongoDB connection error', err);
        });

        mongoose.connection.on('disconnected', () => {
          logger.warn('MongoDB disconnected');
        });

        return { uri };
      },
      inject: [ConfigService, AppLogger],
    }),
  ],
  exports: [MongooseModule],
})

export class DatabaseModule {}
