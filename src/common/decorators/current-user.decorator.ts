import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * @CurrentUser()
 * ─────────────────────────────────────────────────────────
 * Replaces req.user in controllers.
 *
 * Usage:
 *   getProfile(@CurrentUser() user: UserDocument) { ... }
 */

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
