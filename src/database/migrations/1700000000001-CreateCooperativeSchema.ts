import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Create cooperative schema and tables.
 * Tables: cooperative, member, farm
 * PostGIS geography type for farm.location (SRID 4326)
 */
export class CreateCooperativeSchema1700000000001 implements MigrationInterface {
  name = 'CreateCooperativeSchema1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS cooperative`);

    // cooperative table
    await queryRunner.query(`
      CREATE TABLE "cooperative"."cooperative" (
        "id"               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "name"             VARCHAR(200)  NOT NULL,
        "name_ar"          VARCHAR(200),
        "ice"              VARCHAR(15)   NOT NULL UNIQUE,
        "if_number"        VARCHAR(8),
        "rc_number"        VARCHAR(20),
        "email"            VARCHAR(100)  NOT NULL,
        "phone"            VARCHAR(20)   NOT NULL,
        "address"          TEXT,
        "region_code"      VARCHAR(50)   NOT NULL,
        "city"             VARCHAR(100)  NOT NULL,
        "president_name"   VARCHAR(200)  NOT NULL,
        "president_cin"    VARCHAR(10)   NOT NULL,
        "president_phone"  VARCHAR(20)   NOT NULL,
        "status"           VARCHAR(20)   NOT NULL DEFAULT 'pending',
        "product_types"    JSONB         NOT NULL DEFAULT '[]',
        "verified_at"      TIMESTAMPTZ,
        "verified_by"      UUID,
        "created_at"       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "updated_at"       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        "created_by"       UUID          NOT NULL,
        "deleted_at"       TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_cooperative_ice"         ON "cooperative"."cooperative" ("ice");
      CREATE INDEX "idx_cooperative_region_code" ON "cooperative"."cooperative" ("region_code");
      CREATE INDEX "idx_cooperative_status"      ON "cooperative"."cooperative" ("status");
    `);

    // member table
    await queryRunner.query(`
      CREATE TABLE "cooperative"."member" (
        "id"              UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
        "cooperative_id"  UUID         NOT NULL REFERENCES "cooperative"."cooperative" ("id"),
        "full_name"       VARCHAR(200) NOT NULL,
        "full_name_ar"    VARCHAR(200),
        "cin"             VARCHAR(10)  NOT NULL UNIQUE,
        "email"           VARCHAR(100),
        "phone"           VARCHAR(20),
        "role"            VARCHAR(50)  NOT NULL DEFAULT 'member',
        "joined_at"       DATE,
        "is_active"       BOOLEAN      NOT NULL DEFAULT TRUE,
        "created_at"      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updated_at"      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "created_by"      UUID         NOT NULL,
        "deleted_at"      TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_member_cooperative_id" ON "cooperative"."member" ("cooperative_id");
      CREATE INDEX "idx_member_cin"            ON "cooperative"."member" ("cin");
    `);

    // farm table — uses PostGIS geography for GPS coordinates
    await queryRunner.query(`
      CREATE TABLE "cooperative"."farm" (
        "id"              UUID           DEFAULT gen_random_uuid() PRIMARY KEY,
        "cooperative_id"  UUID           NOT NULL REFERENCES "cooperative"."cooperative" ("id"),
        "name"            VARCHAR(200)   NOT NULL,
        "region_code"     VARCHAR(50)    NOT NULL,
        "commune"         VARCHAR(100),
        "area_hectares"   DECIMAL(10,2)  NOT NULL,
        "crop_types"      JSONB          NOT NULL DEFAULT '[]',
        "latitude"        DECIMAL(10,7),
        "longitude"       DECIMAL(10,7),
        "location"        geography(Point, 4326),
        "created_at"      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
        "updated_at"      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
        "created_by"      UUID           NOT NULL,
        "deleted_at"      TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_farm_cooperative_id" ON "cooperative"."farm" ("cooperative_id");
      CREATE INDEX "idx_farm_location"       ON "cooperative"."farm" USING GIST ("location");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "cooperative"."farm"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cooperative"."member"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cooperative"."cooperative"`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS cooperative CASCADE`);
  }
}
