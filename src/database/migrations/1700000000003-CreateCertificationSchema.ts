import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Create certification schema and tables.
 * Tables: certification, certification_seq, inspection, inspection_report, qr_code, export_document
 *
 * certification_seq: per-region, per-type, per-year sequential counter.
 * Format: TERROIR-{AOP|IGP|LA}-{REGION_CODE}-{YEAR}-{SEQ3}
 * Example: TERROIR-IGP-SFI-2025-042
 */
export class CreateCertificationSchema1700000000003 implements MigrationInterface {
  name = 'CreateCertificationSchema1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS certification`);

    // Sequential counter for certification numbers — one row per (type, region, year)
    await queryRunner.query(`
      CREATE TABLE "certification"."certification_seq" (
        "id"                  SERIAL       PRIMARY KEY,
        "certification_type"  VARCHAR(20)  NOT NULL,
        "region_code"         VARCHAR(50)  NOT NULL,
        "year"                INTEGER      NOT NULL,
        "last_seq"            INTEGER      NOT NULL DEFAULT 0,
        UNIQUE ("certification_type", "region_code", "year")
      )
    `);

    // certification table
    await queryRunner.query(`
      CREATE TABLE "certification"."certification" (
        "id"                  UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
        "certification_number" VARCHAR(80)  UNIQUE,
        "cooperative_id"      UUID         NOT NULL,
        "cooperative_name"    VARCHAR(200) NOT NULL,
        "batch_id"            UUID         NOT NULL,
        "product_type_code"   VARCHAR(50)  NOT NULL,
        "certification_type"  VARCHAR(20)  NOT NULL,
        "region_code"         VARCHAR(50)  NOT NULL,
        "status"              VARCHAR(30)  NOT NULL DEFAULT 'pending',
        "requested_by"        UUID         NOT NULL,
        "requested_at"        TIMESTAMPTZ  NOT NULL,
        "granted_by"          UUID,
        "granted_at"          TIMESTAMPTZ,
        "valid_from"          DATE,
        "valid_until"         DATE,
        "denied_by"           UUID,
        "denied_at"           TIMESTAMPTZ,
        "denial_reason"       TEXT,
        "revoked_by"          UUID,
        "revoked_at"          TIMESTAMPTZ,
        "revocation_reason"   TEXT,
        "renewed_from_id"     UUID,
        "created_at"          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updated_at"          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "created_by"          UUID         NOT NULL,
        "deleted_at"          TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_cert_cooperative_id"    ON "certification"."certification" ("cooperative_id");
      CREATE INDEX "idx_cert_batch_id"          ON "certification"."certification" ("batch_id");
      CREATE INDEX "idx_cert_status"            ON "certification"."certification" ("status");
      CREATE INDEX "idx_cert_type_region"       ON "certification"."certification" ("certification_type", "region_code");
    `);

    // inspection table
    await queryRunner.query(`
      CREATE TABLE "certification"."inspection" (
        "id"                    UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
        "certification_id"      UUID        NOT NULL REFERENCES "certification"."certification" ("id"),
        "cooperative_id"        UUID        NOT NULL,
        "inspector_id"          UUID        NOT NULL,
        "inspector_name"        VARCHAR(200) NOT NULL,
        "scheduled_date"        DATE        NOT NULL,
        "completed_at"          TIMESTAMPTZ,
        "status"                VARCHAR(30) NOT NULL DEFAULT 'scheduled',
        "farm_ids"              JSONB       NOT NULL DEFAULT '[]',
        "notes"                 TEXT,
        "created_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "created_by"            UUID        NOT NULL,
        "deleted_at"            TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_inspection_certification_id" ON "certification"."inspection" ("certification_id");
      CREATE INDEX "idx_inspection_inspector_id"     ON "certification"."inspection" ("inspector_id");
      CREATE INDEX "idx_inspection_status"           ON "certification"."inspection" ("status");
    `);

    // inspection_report table
    await queryRunner.query(`
      CREATE TABLE "certification"."inspection_report" (
        "id"             UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
        "inspection_id"  UUID         NOT NULL REFERENCES "certification"."inspection" ("id"),
        "passed"         BOOLEAN      NOT NULL,
        "summary"        TEXT         NOT NULL,
        "findings"       JSONB        NOT NULL DEFAULT '[]',
        "photos"         JSONB        NOT NULL DEFAULT '[]',
        "filed_by"       UUID         NOT NULL,
        "filed_at"       TIMESTAMPTZ  NOT NULL,
        "created_at"     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_report_inspection_id" ON "certification"."inspection_report" ("inspection_id");
    `);

    // qr_code table
    await queryRunner.query(`
      CREATE TABLE "certification"."qr_code" (
        "id"               UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
        "certification_id" UUID         NOT NULL REFERENCES "certification"."certification" ("id"),
        "hmac_signature"   VARCHAR(64)  NOT NULL UNIQUE,
        "verification_url" VARCHAR(500) NOT NULL,
        "is_active"        BOOLEAN      NOT NULL DEFAULT TRUE,
        "scans_count"      INTEGER      NOT NULL DEFAULT 0,
        "issued_at"        TIMESTAMPTZ  NOT NULL,
        "expires_at"       TIMESTAMPTZ,
        "created_at"       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updated_at"       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_qr_certification_id" ON "certification"."qr_code" ("certification_id");
      CREATE INDEX "idx_qr_hmac_signature"   ON "certification"."qr_code" ("hmac_signature");
      CREATE INDEX "idx_qr_is_active"        ON "certification"."qr_code" ("is_active");
    `);

    // export_document table
    await queryRunner.query(`
      CREATE TABLE "certification"."export_document" (
        "id"               UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
        "certification_id" UUID         NOT NULL REFERENCES "certification"."certification" ("id"),
        "document_type"    VARCHAR(50)  NOT NULL,
        "document_number"  VARCHAR(80)  UNIQUE,
        "destination_country" VARCHAR(100),
        "hs_code"          VARCHAR(20),
        "quantity_kg"      DECIMAL(10,2),
        "status"           VARCHAR(30)  NOT NULL DEFAULT 'pending',
        "issued_at"        TIMESTAMPTZ,
        "expires_at"       TIMESTAMPTZ,
        "created_at"       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updated_at"       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "created_by"       UUID         NOT NULL,
        "deleted_at"       TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_export_certification_id" ON "certification"."export_document" ("certification_id");
      CREATE INDEX "idx_export_status"           ON "certification"."export_document" ("status");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "certification"."export_document"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "certification"."qr_code"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "certification"."inspection_report"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "certification"."inspection"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "certification"."certification"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "certification"."certification_seq"`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS certification CASCADE`);
  }
}
