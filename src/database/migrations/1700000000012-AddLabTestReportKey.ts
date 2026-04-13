import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLabTestReportKey1700000000012 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE product.lab_test
        ADD COLUMN report_s3_key VARCHAR(500) NULL,
        ADD COLUMN report_file_name VARCHAR(255) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE product.lab_test
        DROP COLUMN IF EXISTS report_s3_key,
        DROP COLUMN IF EXISTS report_file_name
    `);
  }
}
