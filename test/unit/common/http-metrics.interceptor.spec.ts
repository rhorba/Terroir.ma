import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { HttpMetricsInterceptor } from '@common/metrics/http-metrics.interceptor';
import { MetricsService } from '@common/metrics/metrics.service';

describe('HttpMetricsInterceptor', () => {
  let interceptor: HttpMetricsInterceptor;
  let metricsService: jest.Mocked<Pick<MetricsService, 'record'>>;

  beforeEach(() => {
    metricsService = { record: jest.fn() };
    interceptor = new HttpMetricsInterceptor(metricsService as unknown as MetricsService);
  });

  const makeContext = (method: string, routePath: string | undefined): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ method, route: routePath ? { path: routePath } : undefined }),
        getResponse: () => ({ statusCode: 200 }),
      }),
    }) as unknown as ExecutionContext;

  it('calls record() with normalized route after response', (done) => {
    const ctx = makeContext('GET', '/certifications/:id');
    const next: CallHandler = { handle: () => of(null) };
    interceptor.intercept(ctx, next).subscribe(() => {
      expect(metricsService.record).toHaveBeenCalledWith(
        'GET',
        '/certifications/:id',
        200,
        expect.any(Number),
      );
      done();
    });
  });

  it('falls back to "unknown" when route is not resolved (404)', (done) => {
    const ctx = makeContext('GET', undefined);
    const next: CallHandler = { handle: () => of(null) };
    interceptor.intercept(ctx, next).subscribe(() => {
      expect(metricsService.record).toHaveBeenCalledWith('GET', 'unknown', 200, expect.any(Number));
      done();
    });
  });

  it('records the correct HTTP method label', (done) => {
    const ctx = makeContext('POST', '/certifications');
    const next: CallHandler = { handle: () => of(null) };
    interceptor.intercept(ctx, next).subscribe(() => {
      expect(metricsService.record).toHaveBeenCalledWith(
        'POST',
        '/certifications',
        200,
        expect.any(Number),
      );
      done();
    });
  });
});
