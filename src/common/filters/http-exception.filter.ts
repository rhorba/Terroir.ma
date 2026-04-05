import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiResponse } from '../interfaces/api-response.interface';

/**
 * Global exception filter that wraps all errors in the standard ApiResponse envelope.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'An unexpected error occurred';

    const errorCode = this.getErrorCode(exception);

    this.logger.error({
      errorCode,
      path: request.url,
      method: request.method,
      statusCode: status,
    });

    const errorResponse: ApiResponse<null> = {
      success: false,
      data: null,
      error: {
        code: errorCode,
        message,
      },
      meta: {
        correlationId: (request.headers['x-correlation-id'] as string) ?? 'unknown',
      },
    };

    response.status(status).json(errorResponse);
  }

  private getErrorCode(exception: unknown): string {
    if (exception instanceof HttpException) {
      const exResponse = exception.getResponse();
      if (
        typeof exResponse === 'object' &&
        exResponse !== null &&
        'code' in exResponse
      ) {
        return (exResponse as { code: string }).code;
      }
      return exception.constructor.name.replace('Exception', '').toUpperCase();
    }
    return 'INTERNAL_ERROR';
  }
}
