import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQrScanEvent1700000000017 implements MigrationInterface {
  name = 'AddQrScanEvent1700000000017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE certification.qr_scan_event (
        id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        qr_code_id       UUID        NOT NULL,
        certification_id UUID        NOT NULL,
        scanned_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
        ip_address       VARCHAR(45)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX idx_qr_scan_event_qr_code_id
        ON certification.qr_scan_event(qr_code_id)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_qr_scan_event_certification_id
        ON certification.qr_scan_event(certification_id)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_qr_scan_event_scanned_at
        ON certification.qr_scan_event(scanned_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS certification.qr_scan_event`);
  }
}
