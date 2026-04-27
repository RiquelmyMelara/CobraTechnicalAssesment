import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { buildSequelizeOptions } from './config/database.config.js';
import { envValidationSchema, type AppEnv } from './config/env.validation.js';
import { ApplicationsModule } from './modules/applications/applications.module.js';
import { PetsModule } from './modules/pets/pets.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),
    SequelizeModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnv, true>) =>
        buildSequelizeOptions(config),
    }),
    UsersModule,
    PetsModule,
    ApplicationsModule,
  ],
})
export class AppModule {}
