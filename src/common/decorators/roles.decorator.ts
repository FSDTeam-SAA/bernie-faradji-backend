import { SetMetadata } from '@nestjs/common';
import { RoleType } from '../enums/role.enum';

export const ROLES_KEY = 'roles';

/**
 * @Roles(...roles)
 * ─────────────────────────────────────────────────────────
 * Replaces your adminMiddleware / userMiddleware inline checks.
 *
 * Usage:
 *   @Roles(RoleType.ADMIN)
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   getAllUsers() { ... }
 */

export const Roles = (...roles: RoleType[]) => SetMetadata(ROLES_KEY, roles);
