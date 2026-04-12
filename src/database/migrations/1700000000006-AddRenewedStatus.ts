import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Documents addition of RENEWED status to CertificationStatus enum.
 * No DDL change required — current_status is varchar(30), no DB-level enum constraint.
 * Also documents FINAL_REVIEW_STARTED and CERTIFICATE_RENEWED event types added to
 * the CertificationEventType enum for the certification_events ledger.
 */
export class AddRenewedStatus1700000000006 implements MigrationInterface {
  name = 'AddRenewedStatus1700000000006';

  async up(_queryRunner: QueryRunner): Promise<void> {
    // No DDL required — varchar(30) column accepts new values without migration.
    // This migration documents the schema intent for the audit log.
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    // No DDL to revert.
  }
}
