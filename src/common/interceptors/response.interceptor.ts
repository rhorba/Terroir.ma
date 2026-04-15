import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';
import { ApiResponse } from '../interfaces/api-response.interface';

/**
 * Wraps all successful responses in the standard ApiResponse envelope.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>();
    const correlationId = (request.headers['x-correlation-id'] as string) ?? 'unknown';

    return next.handle().pipe(
      map((data) => ({
        success: true,
        data: data ?? null,
        error: null,
        meta: { correlationId },
      })),
    );
  }
}
