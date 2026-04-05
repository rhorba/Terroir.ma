import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Middleware that ensures every request has a correlation ID.
 * Applied globally for Kafka event chain tracing.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    if (!req.headers['x-correlation-id']) {
      req.headers['x-correlation-id'] = uuidv4();
    }
    next();
  }
}
