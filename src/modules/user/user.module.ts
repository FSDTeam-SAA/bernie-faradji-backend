import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { AuthModule } from '../auth/auth.module';
import { CloudinaryModule } from '../../infrastructure/cloudinary/cloudinary.module';


@Module({
  imports: [
    AuthModule,
    CloudinaryModule,
  ],
  controllers: [UserController],
  providers: [UserService],
})

export class UserModule {}
