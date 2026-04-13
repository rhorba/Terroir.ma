import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLogService } from '../../../src/common/services/audit-log.service';
import { AuditLog } from '../../../src/common/entities/audit-log.entity';

const makeRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('AuditLogService', () => {
  let service: AuditLogService;
  let repo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    repo = makeRepo();
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditLogService, { provide: getRepositoryToken(AuditLog), useValue: repo }],
    }).compile();
    service = module.get(AuditLogService);
  });

  afterEach(() => jest.clearAllMocks());

  it('is defined', () => expect(service).toBeDefined());

  it('record() saves one audit log entry', async () => {
    const entry = {
      userId: 'u1',
      userEmail: 'a@b.com',
      userRole: 'super-admin',
      method: 'GET',
      path: '/admin/dashboard',
      statusCode: 200,
      ip: '127.0.0.1',
    };
    repo.create.mockReturnValue(entry);
    repo.save.mockResolvedValue(entry);
    await expect(service.record(entry)).resolves.toBeUndefined();
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('record() swallows errors silently', async () => {
    repo.create.mockReturnValue({});
    repo.save.mockRejectedValue(new Error('DB down'));
    await expect(
      service.record({
        userId: 'u1',
        userEmail: null,
        userRole: 'super-admin',
        method: 'GET',
        path: '/',
        statusCode: 200,
        ip: null,
      }),
    ).resolves.toBeUndefined();
  });

  it('findAll() applies userId filter and returns paginated result', async () => {
    const qb: Record<string, jest.Mock> = {
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    repo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.findAll({ userId: 'u1', page: 1, limit: 20 });

    expect(result.total).toBe(0);
    expect(result.page).toBe(1);
    expect(qb.andWhere).toHaveBeenCalledWith('a.userId = :userId', { userId: 'u1' });
  });

  it('findAll() applies date range filters', async () => {
    const qb: Record<string, jest.Mock> = {
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    repo.createQueryBuilder.mockReturnValue(qb);

    await service.findAll({ from: '2026-01-01', to: '2026-04-13', page: 1, limit: 20 });

    expect(qb.andWhere).toHaveBeenCalledWith('a.createdAt >= :from', { from: '2026-01-01' });
    expect(qb.andWhere).toHaveBeenCalledWith('a.createdAt <= :to', { to: '2026-04-13' });
  });
});
