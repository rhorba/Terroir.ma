import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 008 — Sprint 7: Add is_active to product.product_type.
 * Also resolves residual FK naming drift from migration 007
 * (cooperative.farm and cooperative.member FKs renamed to TypeORM-managed names).
 *
 * US-016: is_active allows super-admins to soft-deactivate SDOQ product types
 * without breaking historical product/certification records that reference them.
 */
export class AddProductTypeIsActive1700000000008 implements MigrationInterface {
  name = 'AddProductTypeIsActive1700000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Rename FK constraints to TypeORM-managed names ───────────────────────────
    await queryRunner.query(
      `ALTER TABLE "cooperative"."farm" DROP CONSTRAINT IF EXISTS "FK_farm_cooperative_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cooperative"."member" DROP CONSTRAINT IF EXISTS "FK_member_cooperative_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cooperative"."farm" ADD CONSTRAINT "FK_3ca263fd9aca7b93fa413dad7e2" FOREIGN KEY ("cooperative_id") REFERENCES "cooperative"."cooperative"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cooperative"."member" ADD CONSTRAINT "FK_6d12cf09622b87b72b0e2afdda6" FOREIGN KEY ("cooperative_id") REFERENCES "cooperative"."cooperative"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // ── US-016: add is_active to product_type ────────────────────────────────────
    await queryRunner.query(
      `ALTER TABLE "product"."product_type" ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product"."product_type" DROP COLUMN IF EXISTS "is_active"`,
    );

    await queryRunner.query(
      `ALTER TABLE "cooperative"."member" DROP CONSTRAINT IF EXISTS "FK_6d12cf09622b87b72b0e2afdda6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cooperative"."farm" DROP CONSTRAINT IF EXISTS "FK_3ca263fd9aca7b93fa413dad7e2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cooperative"."farm" ADD CONSTRAINT "FK_farm_cooperative_id" FOREIGN KEY ("cooperative_id") REFERENCES "cooperative"."cooperative"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cooperative"."member" ADD CONSTRAINT "FK_member_cooperative_id" FOREIGN KEY ("cooperative_id") REFERENCES "cooperative"."cooperative"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
