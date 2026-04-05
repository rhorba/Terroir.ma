import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentUserPayload {
  sub: string;
  preferred_username: string;
  email: string;
  realm_access: { roles: string[] };
  cooperative_id?: string;
}

/**
 * Extracts the authenticated user from the JWT token.
 * Use with @UseGuards(JwtAuthGuard).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserPayload => {
    const request = ctx.switchToHttp().getRequest<{ user: CurrentUserPayload }>();
    return request.user;
  },
);
