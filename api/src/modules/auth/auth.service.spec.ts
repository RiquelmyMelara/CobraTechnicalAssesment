import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/sequelize';
import { Test, type TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { UniqueConstraintError } from 'sequelize';
import { UserRole } from '../../common/enums/user-role.enum.js';
import { User } from '../users/user.model.js';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  const users = {
    create: jest.fn(),
    findOne: jest.fn(),
  };

  const jwt = {
    sign: jest.fn().mockReturnValue('signed.jwt.token'),
  };

  const config = {
    get: jest.fn((key: string) => {
      if (key === 'BCRYPT_COST') return 4; // tests run faster at low cost
      return undefined;
    }),
  };

  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getModelToken(User), useValue: users },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  describe('register', () => {
    it('hashes the password, normalises email, returns user + token', async () => {
      users.create.mockImplementation(async (attrs: Record<string, unknown>) => ({
        id: 'new-user-id',
        email: attrs['email'],
        name: attrs['name'],
        role: UserRole.USER,
        passwordHash: attrs['passwordHash'],
      }));

      const out = await service.register({
        email: '  Alice@Example.COM ',
        password: 'hunter2hunter2',
        name: 'Alice',
      });

      expect(out.user.email).toBe('alice@example.com');
      expect(out.user.role).toBe(UserRole.USER);
      expect(out.accessToken).toBe('signed.jwt.token');

      const createCall = users.create.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(createCall['email']).toBe('alice@example.com');
      // The DB never sees the plain password.
      expect(createCall['passwordHash']).not.toEqual('hunter2hunter2');
      // And the hash actually verifies.
      const ok = await bcrypt.compare(
        'hunter2hunter2',
        createCall['passwordHash'] as string,
      );
      expect(ok).toBe(true);
    });

    it('translates a Sequelize unique-constraint error into 409', async () => {
      users.create.mockRejectedValue(
        new UniqueConstraintError({ errors: [], message: 'unique' }),
      );
      await expect(
        service.register({
          email: 'taken@example.com',
          password: 'hunter2hunter2',
          name: 'Alice',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('returns a token on a correct password', async () => {
      const passwordHash = await bcrypt.hash('hunter2hunter2', 4);
      users.findOne.mockResolvedValue({
        id: 'u1',
        email: 'alice@example.com',
        name: 'Alice',
        role: UserRole.USER,
        passwordHash,
      });
      const out = await service.login({
        email: 'alice@example.com',
        password: 'hunter2hunter2',
      });
      expect(out.accessToken).toBe('signed.jwt.token');
      expect(out.user.id).toBe('u1');
    });

    it('rejects unknown email with the same error as bad password', async () => {
      users.findOne.mockResolvedValue(null);
      await expect(
        service.login({ email: 'nope@example.com', password: 'whatever' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects wrong password with the same error as unknown email', async () => {
      const passwordHash = await bcrypt.hash('the-real-one', 4);
      users.findOne.mockResolvedValue({
        id: 'u1',
        email: 'alice@example.com',
        name: 'Alice',
        role: UserRole.USER,
        passwordHash,
      });
      await expect(
        service.login({ email: 'alice@example.com', password: 'guessing' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
