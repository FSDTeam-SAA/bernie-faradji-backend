import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Team, TeamSchema } from './schemas/team.schema';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../../infrastructure/email/email.module';
import { TeamAuthGuard } from '../../common/guards/team-auth.guard';
import { TeamPermissionsGuard } from '../../common/guards/team-permissions.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Team.name, schema: TeamSchema },
      { name: User.name, schema: UserSchema },
    ]),
    AuthModule,
    EmailModule,
  ],
  controllers: [TeamController],
  providers: [TeamService, TeamAuthGuard, TeamPermissionsGuard],
  exports: [TeamService, TeamAuthGuard, TeamPermissionsGuard, MongooseModule],
})
export class TeamModule {}
