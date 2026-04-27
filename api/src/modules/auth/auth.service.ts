import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/sequelize';
import * as bcrypt from 'bcryptjs';
import { UniqueConstraintError } from 'sequelize';
import type { AppEnv } from '../../config/env.validation.js';
import { UserRole } from '../../common/enums/user-role.enum.js';
import type { JwtPayload } from '../../common/types/auth-user.js';
import { User } from '../users/user.model.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

export interface AuthResult {
  user: { id: string; email: string; name: string; role: UserRole };
  accessToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User) private readonly users: typeof User,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppEnv, true>,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const email = AuthService.normalizeEmail(dto.email);
    const cost = this.config.get('BCRYPT_COST', { infer: true });
    const passwordHash = await bcrypt.hash(dto.password, cost);

    try {
      const user = await this.users.create({
        email,
        passwordHash,
        name: dto.name.trim(),
        // role defaults to UserRole.USER at the DB layer; never trust the
        // client to set this.
      });
      this.logger.log(`User registered: ${user.id}`);
      return this.buildAuthResult(user);
    } catch (err) {
      if (err instanceof UniqueConstraintError) {
        throw new ConflictException(
          'An account with this email already exists.',
        );
      }
      throw err;
    }
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const email = AuthService.normalizeEmail(dto.email);
    const user = await this.users.findOne({ where: { email } });

    // Use the same error for "no such user" and "bad password" so we don't
    // leak which emails are registered.
    const invalid = (): never => {
      throw new UnauthorizedException('Invalid email or password.');
    };

    if (!user) {
      // Run a dummy compare anyway to keep timing roughly constant.
      await bcrypt.compare(
        dto.password,
        '$2b$10$invalidinvalidinvalidinvaliduO',
      );
      return invalid();
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      return invalid();
    }

    return this.buildAuthResult(user);
  }

  private buildAuthResult(user: User): AuthResult {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const accessToken = this.jwt.sign(payload);
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      accessToken,
    };
  }

  private static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
