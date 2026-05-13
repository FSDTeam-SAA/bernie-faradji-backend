import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * @Public()
 * ─────────────────────────────────────────────────────────
 * Marks a route as publicly accessible (no JWT required).
 * Applied on top of JwtAuthGuard which is set globally.
 *
 * Usage:
 *   @Public()
 *   @Post('register')
 *   register(@Body() dto: RegisterDto) { ... }
*/

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
