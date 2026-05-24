import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as jwt from 'jsonwebtoken';
import { Team, TeamDocument } from '../../modules/team/schemas/team.schema';

@Injectable()
export class TeamAuthGuard implements CanActivate {
  constructor(
    @InjectModel(Team.name) private readonly teamModel: Model<TeamDocument>,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('No token provided');
    }

    const token = authHeader.split(' ')[1];

    try {
      const payload: any = jwt.verify(
        token,
        this.configService.get<string>('auth.accessTokenSecret'),
      );

      const admin = await this.teamModel.findById(payload._id).select('-password');
      if (!admin) throw new UnauthorizedException('Admin not found');
      if (admin.status === 'Suspended') throw new UnauthorizedException('Account suspended');

      request.teamAdmin = admin;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}