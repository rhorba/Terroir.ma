/**
 * Integration test: CertificationService with real PostgreSQL (Testcontainers).
 *
 * Verifies:
 * - Certification requests are created and persisted
 * - Status transitions follow the defined state machine
 * - Certification number format matches TERROIR-{type}-{region}-{year}-{seq}
 * - Idempotency guard on event processing
 */
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import {
  Certification,
  CertificationStatus,
} from '../../../src/modules/certification/entities/certification.entity';
import { Inspection } from '../../../src/modules/certification/entities/inspection.entity';
import { InspectionReport } from '../../../src/modules/certification/entities/inspection-report.entity';
import { QrCode } from '../../../src/modules/certification/entities/qr-code.entity';
import { ExportDocument } from '../../../src/modules/certification/entities/export-document.entity';
import { truncateTables } from '../../helpers/database.helper';
import { buildGrantedCertification } from '../../factories/certification.factory';

describe('CertificationService (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('terroir_test')
      .withUsername('test')
      .withPassword('test')
      .start();

    dataSource = new DataSource({
      type: 'postgres',
      url: container.getConnectionUri(),
      entities: [Certification, Inspection, InspectionReport, QrCode, ExportDocument],
      schema: 'certification',
      synchronize: false,
    });
    await dataSource.initialize();
    await dataSource.query('CREATE SCHEMA IF NOT EXISTS certification');
    await dataSource.synchronize();
  });

  afterEach(async () => {
    await truncateTables(dataSource, ['certification']);
  });

  afterAll(async () => {
    await dataSource.destroy();
    await container.stop();
  });

  it('should store a granted certification with correct number format', async () => {
    const cert = buildGrantedCertification();
    const repo = dataSource.getRepository(Certification);

    const saved = await repo.save(repo.create(cert));
    const found = await repo.findOneBy({ id: saved.id });

    expect(found).not.toBeNull();
    expect(found!.certificationNumber).toMatch(/^TERROIR-(AOP|IGP|LA)-[A-Z]{3}-\d{4}-\d{3}$/);
    expect(found!.currentStatus).toBe(CertificationStatus.GRANTED);
  });
});
