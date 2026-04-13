import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { AuditLogService } from '../services/audit-log.service';

interface JwtUser {
  sub?: string;
  email?: string;
  realm_access?: { roles?: string[] };
}

/**
 * US-085: Globally registers one audit_log row per authenticated HTTP request.
 * Skips requests with no req.user (public endpoints, health checks, QR verify).
 * Fire-and-forget — never blocks the response path.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { user?: JwtUser }>();
    const res = context.switchToHttp().getResponse<Response>();

    if (!req.user) return next.handle();

    const userId = req.user.sub ?? 'unknown';
    const userEmail = req.user.email ?? null;
    const userRole = req.user.realm_access?.roles?.[0] ?? 'unknown';
    const method = req.method;
    const path = req.path;
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
      req.socket.remoteAddress ??
      null;

    return next.handle().pipe(
      tap(() => {
        const statusCode = res.statusCode;
        void this.auditLogService.record({
          userId,
          userEmail,
          userRole,
          method,
          path,
          statusCode,
          ip,
        });
      }),
    );
  }
}
