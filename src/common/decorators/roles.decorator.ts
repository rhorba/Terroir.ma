import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

export type TerroirRole =
  | 'super-admin'
  | 'cooperative-admin'
  | 'cooperative-member'
  | 'lab-technician'
  | 'inspector'
  | 'certification-body'
  | 'customs-agent'
  | 'consumer'
  | 'service-account';

/**
 * Sets required roles for an endpoint.
 * Use with @UseGuards(JwtAuthGuard, RolesGuard).
 *
 * @example
 * @Roles('cooperative-admin', 'super-admin')
 */
export const Roles = (...roles: TerroirRole[]) => SetMetadata(ROLES_KEY, roles);
