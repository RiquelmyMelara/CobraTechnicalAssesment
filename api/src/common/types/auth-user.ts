import type { UserRole } from '../enums/user-role.enum.js';

/**
 * Slim user shape attached to `req.user` by `JwtStrategy.validate`. Lives in
 * `common` so guards, decorators, and any service can depend on it without
 * pulling in the full Sequelize model.
 */
export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

/**
 * JWT payload schema. `sub` is the user id (RFC 7519 convention).
 */
export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}
