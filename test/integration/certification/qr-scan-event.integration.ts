/**
 * Integration test: QrScanEvent entity with real PostgreSQL (Testcontainers).
 * Verifies append-only scan event persistence and aggregate stats query.
 * US-058
 */
import { QrScanEvent } from '../../../src/modules/certification/entities/qr-scan-event.entity';
import {
  startTestDatabase,
  stopTestDatabase,
  TestDatabase,
} from '../helpers/test-containers.setup';

const CERT_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380b01';
const QR_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380b02';

describe('QrScanEvent (integration)', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await startTestDatabase([QrScanEvent]);
  });

  afterAll(async () => {
    await stopTestDatabase(db);
  });

  afterEach(async () => {
    await db.dataSource.query(`TRUNCATE TABLE certification.qr_scan_event`);
  });

  it('should persist a QR scan event with ip_address', async () => {
    const repo = db.dataSource.getRepository(QrScanEvent);
    await repo.save(
      repo.create({ qrCodeId: QR_ID, certificationId: CERT_ID, ipAddress: '192.168.1.1' }),
    );
    const found = await repo.findOneBy({ certificationId: CERT_ID });
    expect(found).not.toBeNull();
    expect(found?.ipAddress).toBe('192.168.1.1');
    expect(found?.scannedAt).toBeInstanceOf(Date);
  });

  it('should allow null ip_address', async () => {
    const repo = db.dataSource.getRepository(QrScanEvent);
    await repo.save(repo.create({ qrCodeId: QR_ID, certificationId: CERT_ID, ipAddress: null }));
    const found = await repo.findOneBy({ certificationId: CERT_ID });
    expect(found?.ipAddress).toBeNull();
  });

  it('should aggregate totalScans correctly via raw SQL', async () => {
    const repo = db.dataSource.getRepository(QrScanEvent);
    await repo.save([
      repo.create({ qrCodeId: QR_ID, certificationId: CERT_ID, ipAddress: null }),
      repo.create({ qrCodeId: QR_ID, certificationId: CERT_ID, ipAddress: '10.0.0.1' }),
      repo.create({ qrCodeId: QR_ID, certificationId: CERT_ID, ipAddress: '10.0.0.2' }),
    ]);

    const rows = await db.dataSource.query<Array<{ total: string }>>(
      `SELECT COUNT(*) AS total FROM certification.qr_scan_event WHERE certification_id = $1`,
      [CERT_ID],
    );
    expect(Number(rows[0]!.total)).toBe(3);
  });

  it('should return 0 scans for a certification with no events', async () => {
    const OTHER_CERT = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380b99';
    const rows = await db.dataSource.query<Array<{ total: string }>>(
      `SELECT COUNT(*) AS total FROM certification.qr_scan_event WHERE certification_id = $1`,
      [OTHER_CERT],
    );
    expect(Number(rows[0]!.total)).toBe(0);
  });
});
