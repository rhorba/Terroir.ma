import { Injectable, OnModuleInit } from '@nestjs/common';
import { Counter, Histogram, Registry } from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new Registry();
  private requestDuration!: Histogram<string>;
  private requestTotal!: Counter<string>;

  onModuleInit(): void {
    this.requestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
      registers: [this.registry],
    });

    this.requestTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });
  }

  /**
   * Records one HTTP request observation into histogram + counter.
   */
  record(method: string, route: string, statusCode: number, durationMs: number): void {
    const labels = { method, route, status: String(statusCode) };
    this.requestDuration.observe(labels, durationMs / 1000);
    this.requestTotal.inc(labels);
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }
}
