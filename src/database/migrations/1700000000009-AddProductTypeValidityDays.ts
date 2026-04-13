import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductTypeValidityDays1700000000009 implements MigrationInterface {
  name = 'AddProductTypeValidityDays1700000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product"."product_type" ADD COLUMN IF NOT EXISTS "validity_days" integer NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product"."product_type" DROP COLUMN IF EXISTS "validity_days"`,
    );
  }
}
