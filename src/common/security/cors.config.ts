import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

export function buildCorsConfig(allowedOrigins: string[]): CorsOptions {
  return {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id'],
    exposedHeaders: ['x-correlation-id'],
    credentials: true,
    maxAge: 86400,
  };
}
