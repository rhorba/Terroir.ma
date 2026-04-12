import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../decorators/current-user.decorator';

/**
 * UserController — read-only view of the authenticated user's profile and Keycloak roles.
 * US-086: roles are read from the Keycloak JWT (realm_access.roles claim).
 * No Keycloak Admin API call — YAGNI for v1.
 */
@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  /** US-086 — Get current user profile (id, email, roles, cooperative_id) from JWT claims */
  @Get('me')
  @ApiOperation({ summary: 'US-086: Get current user profile from JWT claims' })
  getMe(@CurrentUser() user: CurrentUserPayload): CurrentUserPayload {
    return user;
  }

  /** US-086 — Get current user Keycloak role list */
  @Get('me/roles')
  @ApiOperation({ summary: 'US-086: Get current user Keycloak roles' })
  getMyRoles(@CurrentUser() user: CurrentUserPayload): { roles: string[] } {
    const roles: string[] = user.realm_access?.roles ?? [];
    return { roles };
  }
}
