import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';

/**
 * Shapes every error response into a consistent envelope:
 *
 *     {
 *       "error": {
 *         "code": "CONFLICT",
 *         "message": "You have already applied to this pet.",
 *         "details": null,
 *         "requestId": "1a2b…"
 *       }
 *     }
 *
 * `code` is the canonical HTTP status name (`CONFLICT`, `NOT_FOUND`, etc.)
 * so the client can branch on it without parsing the human message.
 *
 * Validation errors from `ValidationPipe` arrive as a `BadRequestException`
 * whose response body has a `message: string[]`; that array becomes
 * `details` so the client can show field-level feedback.
 *
 * Unknown errors (anything not extending `HttpException`) become a 500
 * with a generic message and the original error logged server-side, keyed
 * by the same `requestId` we send to the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = randomUUID();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const { message, details } = unpackHttpExceptionBody(
        body,
        exception.message,
      );
      response.status(status).json({
        error: {
          code: codeForStatus(status),
          message,
          details,
          requestId,
        },
      });
      return;
    }

    const message =
      exception instanceof Error ? exception.message : String(exception);
    this.logger.error(
      `Unhandled exception on ${request.method} ${request.originalUrl} ` +
        `[requestId=${requestId}]: ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred.',
        details: null,
        requestId,
      },
    });
  }
}

interface UnpackedException {
  message: string;
  details: unknown;
}

function unpackHttpExceptionBody(
  body: string | object,
  fallbackMessage: string,
): UnpackedException {
  if (typeof body === 'string') {
    return { message: body, details: null };
  }
  const record = body as Record<string, unknown>;
  const raw = record['message'];
  if (Array.isArray(raw)) {
    // class-validator -> BadRequestException populates `message` with an
    // array of strings. Surface them as `details` and use a stable
    // human message.
    return {
      message: 'Validation failed.',
      details: raw,
    };
  }
  if (typeof raw === 'string') {
    return { message: raw, details: null };
  }
  return { message: fallbackMessage, details: null };
}

function codeForStatus(status: number): string {
  const name = HttpStatus[status as unknown as keyof typeof HttpStatus];
  return typeof name === 'string' ? name : `HTTP_${status}`;
}
