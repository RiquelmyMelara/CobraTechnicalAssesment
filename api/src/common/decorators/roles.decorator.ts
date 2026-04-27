import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../enums/user-role.enum.js';

export const ROLES_METADATA_KEY = 'requiredRoles';

/**
 * Attach to a controller or method to require one of the given roles.
 * Read by `RolesGuard`. Always combine with `JwtAuthGuard`.
 *
 * @example
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles(UserRole.STAFF)
 *   @Post()
 *   create(...) {}
 */
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_METADATA_KEY, roles);
