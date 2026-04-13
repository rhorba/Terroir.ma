import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { DashboardMetrics } from '../interfaces/dashboard.interface';

const CACHE_KEY = 'dashboard:admin';
const CACHE_TTL_MS = 300_000;

/**
 * US-081: Aggregates platform-wide counts for the super-admin dashboard.
 * Uses raw SQL via DataSource — no cross-module service imports.
 * Redis-cached for 300s.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async getDashboard(): Promise<DashboardMetrics> {
    const cached = await this.cacheManager.get<DashboardMetrics>(CACHE_KEY);
    if (cached) return cached;

    const [coopRows, productRows, certRows, labRows, notifRows] = await Promise.all([
      this.dataSource.query<Array<Record<string, string>>>(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'VERIFIED') AS verified,
          COUNT(*) FILTER (WHERE status = 'PENDING') AS pending,
          COUNT(*) FILTER (WHERE status = 'SUSPENDED') AS suspended
        FROM cooperative.cooperative
      `),
      this.dataSource.query<Array<Record<string, string>>>(`
        SELECT COUNT(*) AS total FROM product.product
      `),
      this.dataSource.query<Array<Record<string, string>>>(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE current_status = 'GRANTED') AS granted,
          COUNT(*) FILTER (WHERE current_status = 'PENDING') AS pending,
          COUNT(*) FILTER (WHERE current_status = 'DENIED') AS denied,
          COUNT(*) FILTER (WHERE current_status = 'REVOKED') AS revoked
        FROM certification.certification
      `),
      this.dataSource.query<Array<Record<string, string>>>(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'PASSED') AS passed,
          COUNT(*) FILTER (WHERE status = 'FAILED') AS failed
        FROM product.lab_test
      `),
      this.dataSource.query<Array<Record<string, string>>>(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'sent') AS sent,
          COUNT(*) FILTER (WHERE status = 'failed') AS failed
        FROM notification.notification
      `),
    ]);

    const n = (v: string | undefined) => Number(v ?? 0);
    const coop = coopRows[0]!;
    const prod = productRows[0]!;
    const cert = certRows[0]!;
    const lab = labRows[0]!;
    const notif = notifRows[0]!;

    const result: DashboardMetrics = {
      cooperatives: {
        total: n(coop['total']),
        verified: n(coop['verified']),
        pending: n(coop['pending']),
        suspended: n(coop['suspended']),
      },
      products: { total: n(prod['total']) },
      certifications: {
        total: n(cert['total']),
        granted: n(cert['granted']),
        pending: n(cert['pending']),
        denied: n(cert['denied']),
        revoked: n(cert['revoked']),
      },
      labTests: {
        total: n(lab['total']),
        passed: n(lab['passed']),
        failed: n(lab['failed']),
      },
      notifications: {
        total: n(notif['total']),
        sent: n(notif['sent']),
        failed: n(notif['failed']),
      },
      generatedAt: new Date().toISOString(),
    };

    await this.cacheManager.set(CACHE_KEY, result, CACHE_TTL_MS);
    return result;
  }
}
