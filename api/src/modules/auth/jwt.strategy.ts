import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import {
  ExtractJwt,
  Strategy,
  type StrategyOptionsWithoutRequest,
} from 'passport-jwt';
import type { AppEnv } from '../../config/env.validation.js';
import type { AuthUser, JwtPayload } from '../../common/types/auth-user.js';
import { USER_ROLE_VALUES } from '../../common/enums/user-role.enum.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService<AppEnv, true>) {
    const options: StrategyOptionsWithoutRequest = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', { infer: true }),
    };
    super(options);
  }

  /**
   * passport-jwt has already validated signature + expiry by the time this
   * runs. We do a defensive shape check so a forged-but-valid-secret token
   * with the wrong claims still gets bounced.
   */
  validate(payload: unknown): AuthUser {
    if (!isJwtPayload(payload)) {
      throw new UnauthorizedException('Malformed token payload.');
    }
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}

function isJwtPayload(value: unknown): value is JwtPayload {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['sub'] === 'string' &&
    typeof v['email'] === 'string' &&
    typeof v['role'] === 'string' &&
    (USER_ROLE_VALUES as readonly string[]).includes(v['role'])
  );
}
