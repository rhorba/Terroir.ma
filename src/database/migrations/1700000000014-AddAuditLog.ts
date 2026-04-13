import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuditLog1700000000014 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS common`);
    await queryRunner.query(`
      CREATE TABLE common.audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(36) NOT NULL,
        user_email VARCHAR(255),
        user_role VARCHAR(100) NOT NULL,
        method VARCHAR(10) NOT NULL,
        path VARCHAR(500) NOT NULL,
        status_code INT NOT NULL,
        ip VARCHAR(45),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_audit_log_user_id ON common.audit_log (user_id)`);
    await queryRunner.query(
      `CREATE INDEX idx_audit_log_created_at ON common.audit_log (created_at)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS common.audit_log`);
  }
}
