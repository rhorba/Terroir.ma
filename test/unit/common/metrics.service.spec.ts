import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from '@common/metrics/metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetricsService],
    }).compile();
    service = module.get<MetricsService>(MetricsService);
    service.onModuleInit();
  });

  it('getMetrics() returns prometheus text format with correct metric names', async () => {
    service.record('GET', '/certifications', 200, 45);
    const output = await service.getMetrics();
    expect(output).toContain('http_request_duration_seconds');
    expect(output).toContain('http_requests_total');
    expect(output).toContain('route="/certifications"');
    expect(output).toContain('status="200"');
  });

  it('record() increments counter for each call', async () => {
    service.record('POST', '/certifications', 201, 80);
    service.record('POST', '/certifications', 201, 90);
    const output = await service.getMetrics();
    expect(output).toMatch(/http_requests_total\{[^}]*method="POST"[^}]*\} 2/);
  });

  it('getContentType() returns a non-empty string', () => {
    expect(service.getContentType()).toBeTruthy();
  });
});
