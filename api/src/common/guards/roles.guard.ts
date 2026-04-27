import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_METADATA_KEY } from '../decorators/roles.decorator.js';
import type { UserRole } from '../enums/user-role.enum.js';
import type { AuthUser } from '../types/auth-user.js';

/**
 * Reads roles attached by `@Roles(...)` and rejects requests whose
 * authenticated user does not match. Always pair with `JwtAuthGuard` so
 * `req.user` is populated.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Authentication required.');
    }
    if (!required.includes(user.role)) {
      throw new ForbiddenException('Insufficient role for this action.');
    }
    return true;
  }
}
