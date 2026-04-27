import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import type { AppEnv } from './config/env.validation.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService<AppEnv, true>);

  // Enable CORS so the frontend (default :3001) can call the API. Without
  // this the browser preflight OPTIONS gets a 404 from Express and the
  // actual POST is blocked. CORS_ORIGIN can be a comma-separated list,
  // a single origin, or '*' (default in dev).
  const corsOrigin = config.get('CORS_ORIGIN', { infer: true });
  app.enableCors({
    origin: parseCorsOrigin(corsOrigin),
    credentials: false,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  // OpenAPI / Swagger UI at /docs. The bearer scheme lets reviewers
  // paste a token from /auth/login into the "Authorize" button and try
  // the protected endpoints directly from the docs page.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Pet Adoption Board API')
    .setDescription(
      'REST API for the Cobra Studio backend assessment (Option E).',
    )
    .setVersion('0.1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = config.get('PORT', { infer: true });
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`API listening on http://localhost:${port}`);
  logger.log(`OpenAPI docs at  http://localhost:${port}/docs`);
}

function parseCorsOrigin(raw: string): boolean | string | string[] {
  const trimmed = raw.trim();
  if (trimmed === '*' || trimmed === '') return true;
  if (trimmed.includes(',')) {
    return trimmed
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return trimmed;
}

void bootstrap();
