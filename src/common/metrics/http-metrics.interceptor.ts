import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const method = req.method;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        // req.route.path is the Express template (/certifications/:id), not the raw URL
        const route = (req.route as { path?: string } | undefined)?.path ?? 'unknown';
        this.metricsService.record(method, route, res.statusCode, Date.now() - start);
      }),
    );
  }
}
