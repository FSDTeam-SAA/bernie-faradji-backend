import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const PERMISSIONS_KEY = 'permissions';

@Injectable()
export class TeamPermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    const request    = context.switchToHttp().getRequest();
    const teamAdmin  = request.teamAdmin;

    if (!teamAdmin) throw new ForbiddenException('Access denied');

    // SUPER_ADMIN or All Access bypasses permission check
    if (
      teamAdmin.role === 'SUPER_ADMIN' ||
      teamAdmin.permissions.includes('All Access')
    ) {
      return true;
    }

    const hasPermission = requiredPermissions.some((p) =>
      teamAdmin.permissions.includes(p),
    );

    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to access this resource');
    }

    return true;
  }
}