import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Thin wrapper over `AuthGuard('jwt')` — kept as a named class so controllers
 * can reference `JwtAuthGuard` without sprinkling string literals.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
