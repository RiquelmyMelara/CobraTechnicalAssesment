import { ConfigService } from '@nestjs/config';
import { SequelizeModuleOptions } from '@nestjs/sequelize';
import { Pet } from '../modules/pets/pet.model.js';
import { User } from '../modules/users/user.model.js';
import { Application } from '../modules/applications/application.model.js';
import type { AppEnv } from './env.validation.js';

/**
 * Built lazily by `SequelizeModule.forRootAsync` so that `ConfigService` is
 * resolved before we read env values. We keep model registration here (not
 * `autoLoadModels`) so the list of bootable entities is explicit and easy to
 * audit when adding a new module.
 */
export function buildSequelizeOptions(
  config: ConfigService<AppEnv, true>,
): SequelizeModuleOptions {
  const isProd = config.get('NODE_ENV', { infer: true }) === 'production';

  return {
    dialect: 'postgres',
    host: config.get('DATABASE_HOST', { infer: true }),
    port: config.get('DATABASE_PORT', { infer: true }),
    username: config.get('DATABASE_USER', { infer: true }),
    password: config.get('DATABASE_PASSWORD', { infer: true }),
    database: config.get('DATABASE_NAME', { infer: true }),
    models: [User, Pet, Application],
    // Keep the assessment runnable in one step by syncing the schema in
    // non-production envs. A real deployment would use migrations.
    synchronize: !isProd,
    autoLoadModels: false,
    logging: false,
    define: {
      underscored: true,
      timestamps: true,
    },
  };
}
