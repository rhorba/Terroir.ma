import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  HealthCheckResult,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

/**
 * Health check controller for Terroir.ma.
 * GET /health — liveness probe
 * GET /ready  — readiness probe (checks all dependencies)
 */
@ApiTags('health')
@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  /** Liveness probe — is the app process alive? */
  @Get('health')
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness probe — is the app process alive?' })
  liveness(): Promise<HealthCheckResult> {
    return this.health.check([]);
  }

  /** Readiness probe — are all dependencies available? */
  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe — are all dependencies available?' })
  readiness(): Promise<HealthCheckResult> {
    return this.health.check([() => this.db.pingCheck('postgresql')]);
  }
}
