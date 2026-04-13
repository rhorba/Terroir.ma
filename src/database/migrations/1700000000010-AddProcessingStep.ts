import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProcessingStep1700000000010 implements MigrationInterface {
  name = 'AddProcessingStep1700000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product"."processing_step" (
        "id"             uuid              NOT NULL DEFAULT gen_random_uuid(),
        "batch_id"       uuid              NOT NULL,
        "cooperative_id" uuid              NOT NULL,
        "step_type"      varchar(30)       NOT NULL,
        "done_at"        timestamptz       NOT NULL,
        "done_by"        uuid              NOT NULL,
        "notes"          text              NULL,
        "created_at"     timestamptz       NOT NULL DEFAULT now(),
        CONSTRAINT "pk_processing_step" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_processing_step_batch_id"
       ON "product"."processing_step" ("batch_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "product"."idx_processing_step_batch_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product"."processing_step"`);
  }
}
