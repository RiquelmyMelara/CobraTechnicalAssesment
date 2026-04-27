import * as Joi from 'joi';

/**
 * Single source of truth for the env contract. Used by `ConfigModule.forRoot`
 * via `validationSchema`; the app refuses to boot if any value is missing or
 * malformed.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),

  DATABASE_HOST: Joi.string().hostname().required(),
  DATABASE_PORT: Joi.number().port().default(5432),
  DATABASE_USER: Joi.string().required(),
  DATABASE_PASSWORD: Joi.string().allow('').required(),
  DATABASE_NAME: Joi.string().required(),

  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default('1d'),
  BCRYPT_COST: Joi.number().integer().min(4).max(15).default(10),

  CORS_ORIGIN: Joi.string().default('*'),
});

/** Strongly-typed env shape, matching the schema above. */
export interface AppEnv {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;

  DATABASE_HOST: string;
  DATABASE_PORT: number;
  DATABASE_USER: string;
  DATABASE_PASSWORD: string;
  DATABASE_NAME: string;

  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  BCRYPT_COST: number;

  CORS_ORIGIN: string;
}
