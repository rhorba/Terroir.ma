import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';

// Prometheus scrapes from within Docker network (172.x, 10.x) or localhost
const ALLOWED_PREFIXES = ['127.0.0.1', '::1', '::ffff:127.0.0.1', '172.', '10.'];

@Injectable()
export class MetricsIpGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
      req.socket.remoteAddress ??
      '';
    if (!ALLOWED_PREFIXES.some((prefix) => ip.startsWith(prefix))) {
      throw new ForbiddenException('Metrics endpoint is internal only');
    }
    return true;
  }
}
