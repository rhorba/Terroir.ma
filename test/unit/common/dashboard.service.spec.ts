import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { DashboardService } from '../../../src/common/services/dashboard.service';

const makeDataSource = () => ({ query: jest.fn() });
const makeCache = () => ({ get: jest.fn(), set: jest.fn() });

describe('DashboardService', () => {
  let service: DashboardService;
  let ds: ReturnType<typeof makeDataSource>;
  let cache: ReturnType<typeof makeCache>;

  beforeEach(async () => {
    ds = makeDataSource();
    cache = makeCache();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: DataSource, useValue: ds },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();
    service = module.get(DashboardService);
  });

  afterEach(() => jest.clearAllMocks());

  it('is defined', () => expect(service).toBeDefined());

  it('getDashboard() returns cached result when available', async () => {
    const cached = {
      cooperatives: { total: 1, verified: 1, pending: 0, suspended: 0 },
      products: { total: 2 },
      certifications: { total: 1, granted: 1, pending: 0, denied: 0, revoked: 0 },
      labTests: { total: 1, passed: 1, failed: 0 },
      notifications: { total: 5, sent: 5, failed: 0 },
      generatedAt: '2026-04-13T00:00:00.000Z',
    };
    cache.get.mockResolvedValue(cached);

    const result = await service.getDashboard();

    expect(result).toBe(cached);
    expect(ds.query).not.toHaveBeenCalled();
  });

  it('getDashboard() queries all 5 schemas and returns mapped metrics', async () => {
    cache.get.mockResolvedValue(null);
    cache.set.mockResolvedValue(undefined);
    ds.query
      .mockResolvedValueOnce([{ total: '10', verified: '7', pending: '2', suspended: '1' }])
      .mockResolvedValueOnce([{ total: '20' }])
      .mockResolvedValueOnce([
        { total: '15', granted: '10', pending: '3', denied: '1', revoked: '1' },
      ])
      .mockResolvedValueOnce([{ total: '8', passed: '6', failed: '2' }])
      .mockResolvedValueOnce([{ total: '50', sent: '45', failed: '5' }]);

    const result = await service.getDashboard();

    expect(result.cooperatives.total).toBe(10);
    expect(result.cooperatives.verified).toBe(7);
    expect(result.cooperatives.pending).toBe(2);
    expect(result.cooperatives.suspended).toBe(1);
    expect(result.products.total).toBe(20);
    expect(result.certifications.total).toBe(15);
    expect(result.certifications.granted).toBe(10);
    expect(result.labTests.passed).toBe(6);
    expect(result.labTests.failed).toBe(2);
    expect(result.notifications.sent).toBe(45);
    expect(result.notifications.failed).toBe(5);
    expect(ds.query).toHaveBeenCalledTimes(5);
    expect(cache.set).toHaveBeenCalledWith('dashboard:admin', result, 300_000);
  });

  it('getDashboard() handles zero counts gracefully', async () => {
    cache.get.mockResolvedValue(null);
    cache.set.mockResolvedValue(undefined);
    ds.query
      .mockResolvedValueOnce([{ total: '0', verified: '0', pending: '0', suspended: '0' }])
      .mockResolvedValueOnce([{ total: '0' }])
      .mockResolvedValueOnce([
        { total: '0', granted: '0', pending: '0', denied: '0', revoked: '0' },
      ])
      .mockResolvedValueOnce([{ total: '0', passed: '0', failed: '0' }])
      .mockResolvedValueOnce([{ total: '0', sent: '0', failed: '0' }]);

    const result = await service.getDashboard();

    expect(result.cooperatives.total).toBe(0);
    expect(result.notifications.sent).toBe(0);
    expect(typeof result.generatedAt).toBe('string');
  });
});
