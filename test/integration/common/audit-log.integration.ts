/**
 * Integration test: AuditLog entity with real PostgreSQL (Testcontainers).
 * Verifies append-only nature, persist/read, and userId index queries.
 * US-085
 */
import { AuditLog } from '../../../src/common/entities/audit-log.entity';
import {
  startTestDatabase,
  stopTestDatabase,
  TestDatabase,
} from '../helpers/test-containers.setup';

describe('AuditLog (integration)', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await startTestDatabase([AuditLog]);
  });

  afterAll(async () => {
    await stopTestDatabase(db);
  });

  afterEach(async () => {
    await db.dataSource.query(`TRUNCATE TABLE common.audit_log`);
  });

  it('should persist an audit log row', async () => {
    const repo = db.dataSource.getRepository(AuditLog);
    const entry = repo.create({
      userId: 'user-uuid-001',
      userEmail: 'admin@terroir.ma',
      userRole: 'super-admin',
      method: 'POST',
      path: '/api/v1/cooperatives',
      statusCode: 201,
      ip: '127.0.0.1',
    });
    await repo.save(entry);

    const found = await repo.findOneBy({ userId: 'user-uuid-001' });
    expect(found).not.toBeNull();
    expect(found?.method).toBe('POST');
    expect(found?.statusCode).toBe(201);
  });

  it('should not have an updatedAt column (append-only schema)', async () => {
    const rows = await db.dataSource.query<Array<{ column_name: string }>>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'common' AND table_name = 'audit_log'`,
    );
    const columns = rows.map((r) => r.column_name);
    expect(columns).toContain('created_at');
    expect(columns).not.toContain('updated_at');
  });

  it('should retrieve audit logs filtered by userId', async () => {
    const repo = db.dataSource.getRepository(AuditLog);
    await repo.save([
      repo.create({
        userId: 'user-A',
        userRole: 'super-admin',
        method: 'GET',
        path: '/health',
        statusCode: 200,
        ip: null,
        userEmail: null,
      }),
      repo.create({
        userId: 'user-A',
        userRole: 'super-admin',
        method: 'POST',
        path: '/api/v1/certifications',
        statusCode: 201,
        ip: null,
        userEmail: null,
      }),
      repo.create({
        userId: 'user-B',
        userRole: 'cooperative-admin',
        method: 'GET',
        path: '/api/v1/cooperatives',
        statusCode: 200,
        ip: null,
        userEmail: null,
      }),
    ]);

    const userALogs = await repo.findBy({ userId: 'user-A' });
    expect(userALogs.length).toBe(2);

    const userBLogs = await repo.findBy({ userId: 'user-B' });
    expect(userBLogs.length).toBe(1);
  });
});
