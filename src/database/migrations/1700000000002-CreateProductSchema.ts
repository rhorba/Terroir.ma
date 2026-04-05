import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Create product schema and tables.
 * Tables: product_type, product, harvest, production_batch, lab_test, lab_test_result
 * campaign_year format: YYYY/YYYY (e.g., 2025/2026) — October–September boundary
 */
export class CreateProductSchema1700000000002 implements MigrationInterface {
  name = 'CreateProductSchema1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS product`);

    // product_type table — static reference data seeded on startup
    await queryRunner.query(`
      CREATE TABLE "product"."product_type" (
        "id"                   UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
        "code"                 VARCHAR(50)  NOT NULL UNIQUE,
        "name_fr"              VARCHAR(200) NOT NULL,
        "name_ar"              VARCHAR(200),
        "name_zgh"             VARCHAR(200),
        "region_code"          VARCHAR(50)  NOT NULL,
        "certification_types"  JSONB        NOT NULL DEFAULT '[]',
        "lab_test_parameters"  JSONB        NOT NULL DEFAULT '[]',
        "is_active"            BOOLEAN      NOT NULL DEFAULT TRUE,
        "created_at"           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updated_at"           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_product_type_code"   ON "product"."product_type" ("code");
      CREATE INDEX "idx_product_type_region" ON "product"."product_type" ("region_code");
    `);

    // product table
    await queryRunner.query(`
      CREATE TABLE "product"."product" (
        "id"                UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
        "cooperative_id"    UUID         NOT NULL,
        "product_type_code" VARCHAR(50)  NOT NULL,
        "name"              VARCHAR(200) NOT NULL,
        "description"       TEXT,
        "is_active"         BOOLEAN      NOT NULL DEFAULT TRUE,
        "created_at"        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updated_at"        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "created_by"        UUID         NOT NULL,
        "deleted_at"        TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_product_cooperative_id" ON "product"."product" ("cooperative_id");
      CREATE INDEX "idx_product_type_code_ref"  ON "product"."product" ("product_type_code");
    `);

    // harvest table
    await queryRunner.query(`
      CREATE TABLE "product"."harvest" (
        "id"                UUID           DEFAULT gen_random_uuid() PRIMARY KEY,
        "farm_id"           UUID           NOT NULL,
        "cooperative_id"    UUID           NOT NULL,
        "product_type_code" VARCHAR(50)    NOT NULL,
        "quantity_kg"       DECIMAL(10,2)  NOT NULL,
        "harvest_date"      DATE           NOT NULL,
        "campaign_year"     VARCHAR(10)    NOT NULL,
        "method"            VARCHAR(100)   NOT NULL,
        "metadata"          JSONB,
        "created_at"        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
        "updated_at"        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
        "created_by"        UUID           NOT NULL,
        "deleted_at"        TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_harvest_farm_id"        ON "product"."harvest" ("farm_id");
      CREATE INDEX "idx_harvest_cooperative_id" ON "product"."harvest" ("cooperative_id");
      CREATE INDEX "idx_harvest_campaign_year"  ON "product"."harvest" ("campaign_year");
    `);

    // production_batch table
    await queryRunner.query(`
      CREATE TABLE "product"."production_batch" (
        "id"                UUID           DEFAULT gen_random_uuid() PRIMARY KEY,
        "batch_number"      VARCHAR(50)    NOT NULL UNIQUE,
        "cooperative_id"    UUID           NOT NULL,
        "product_type_code" VARCHAR(50)    NOT NULL,
        "harvest_ids"       JSONB          NOT NULL DEFAULT '[]',
        "total_quantity_kg" DECIMAL(10,2)  NOT NULL,
        "processing_date"   DATE           NOT NULL,
        "status"            VARCHAR(30)    NOT NULL DEFAULT 'created',
        "created_at"        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
        "updated_at"        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
        "created_by"        UUID           NOT NULL,
        "deleted_at"        TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_batch_cooperative_id"    ON "product"."production_batch" ("cooperative_id");
      CREATE INDEX "idx_batch_product_type_code" ON "product"."production_batch" ("product_type_code");
      CREATE INDEX "idx_batch_status"            ON "product"."production_batch" ("status");
    `);

    // lab_test table
    await queryRunner.query(`
      CREATE TABLE "product"."lab_test" (
        "id"                   UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
        "batch_id"             UUID        NOT NULL REFERENCES "product"."production_batch" ("id"),
        "cooperative_id"       UUID        NOT NULL,
        "product_type_code"    VARCHAR(50) NOT NULL,
        "laboratory_id"        UUID,
        "submitted_at"         TIMESTAMPTZ NOT NULL,
        "submitted_by"         UUID        NOT NULL,
        "expected_result_date" DATE,
        "status"               VARCHAR(20) NOT NULL DEFAULT 'submitted',
        "created_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_lab_test_batch_id"       ON "product"."lab_test" ("batch_id");
      CREATE INDEX "idx_lab_test_cooperative_id" ON "product"."lab_test" ("cooperative_id");
      CREATE INDEX "idx_lab_test_status"         ON "product"."lab_test" ("status");
    `);

    // lab_test_result table
    await queryRunner.query(`
      CREATE TABLE "product"."lab_test_result" (
        "id"                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
        "lab_test_id"       UUID        NOT NULL REFERENCES "product"."lab_test" ("id"),
        "batch_id"          UUID        NOT NULL,
        "product_type_code" VARCHAR(50) NOT NULL,
        "passed"            BOOLEAN     NOT NULL,
        "test_values"       JSONB       NOT NULL DEFAULT '{}',
        "failed_parameters" JSONB       NOT NULL DEFAULT '[]',
        "technician_name"   VARCHAR(200) NOT NULL,
        "technician_id"     UUID        NOT NULL,
        "laboratory_name"   VARCHAR(200),
        "completed_at"      TIMESTAMPTZ NOT NULL,
        "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_lab_result_lab_test_id" ON "product"."lab_test_result" ("lab_test_id");
      CREATE INDEX "idx_lab_result_batch_id"    ON "product"."lab_test_result" ("batch_id");
      CREATE INDEX "idx_lab_result_passed"      ON "product"."lab_test_result" ("passed");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "product"."lab_test_result"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product"."lab_test"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product"."production_batch"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product"."harvest"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product"."product"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product"."product_type"`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS product CASCADE`);
  }
}
