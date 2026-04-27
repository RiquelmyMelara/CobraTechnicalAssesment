import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../types/auth-user.js';

/**
 * Pulls the `AuthUser` attached by `JwtStrategy.validate`. Use only on
 * routes guarded by `JwtAuthGuard`.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    if (!request.user) {
      throw new Error(
        'CurrentUser used on an unauthenticated route — apply JwtAuthGuard first.',
      );
    }
    return request.user;
  },
);
