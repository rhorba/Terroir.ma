import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Sprint 2 — Event-sourced certification chain.
 *
 * Changes:
 * 1. Add `current_status` VARCHAR column to certification.certification
 *    (replaces the old `status` column that no longer exists — entity was updated)
 * 2. Create append-only `certification.certification_events` ledger table
 *    for the CQRS-lite event sourcing pattern (Law 25-06 immutability requirement)
 */
export class AddCertificationEventAndCurrentStatus1700000000005 implements MigrationInterface {
  name = 'AddCertificationEventAndCurrentStatus1700000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Rename status → current_status and backfill any existing rows to DRAFT
    await queryRunner.query(`
      ALTER TABLE "certification"."certification"
        RENAME COLUMN "status" TO "current_status"
    `);

    await queryRunner.query(`
      UPDATE "certification"."certification"
        SET "current_status" = 'DRAFT'
        WHERE "current_status" IS NOT NULL
    `);

    // 2. Create the append-only certification_events ledger
    await queryRunner.query(`
      CREATE TABLE "certification"."certification_events" (
        "id"              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        "certification_id" UUID         NOT NULL,
        "event_type"      VARCHAR(50)   NOT NULL,
        "from_status"     VARCHAR(30)   NOT NULL,
        "to_status"       VARCHAR(30)   NOT NULL,
        "actor_id"        VARCHAR(50)   NOT NULL,
        "actor_role"      VARCHAR(50)   NOT NULL,
        "payload"         JSONB,
        "correlation_id"  VARCHAR(50)   NOT NULL,
        "occurred_at"     TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT "fk_cert_events_certification"
          FOREIGN KEY ("certification_id")
          REFERENCES "certification"."certification"("id")
          ON DELETE RESTRICT
      )
    `);

    // Index for fast lookup by certification and for idempotency checks
    await queryRunner.query(`
      CREATE INDEX "idx_cert_events_certification_id"
        ON "certification"."certification_events" ("certification_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_cert_events_correlation_id"
        ON "certification"."certification_events" ("correlation_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "certification"."certification_events"`);
    await queryRunner.query(`
      ALTER TABLE "certification"."certification"
        RENAME COLUMN "current_status" TO "status"
    `);
  }
}
