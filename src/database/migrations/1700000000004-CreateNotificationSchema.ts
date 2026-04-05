import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Create notification schema and tables.
 * Tables: notification_template, notification
 * Supports trilingual templates: fr-MA, ar-MA, zgh
 */
export class CreateNotificationSchema1700000000004 implements MigrationInterface {
  name = 'CreateNotificationSchema1700000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS notification`);

    // notification_template — Handlebars templates per code+channel+language
    await queryRunner.query(`
      CREATE TABLE "notification"."notification_template" (
        "id"              UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
        "code"            VARCHAR(100) NOT NULL,
        "channel"         VARCHAR(10)  NOT NULL,
        "language"        VARCHAR(10)  NOT NULL DEFAULT 'fr-MA',
        "subject_template" VARCHAR(500),
        "body_template"   TEXT         NOT NULL,
        "is_active"       BOOLEAN      NOT NULL DEFAULT TRUE,
        "created_at"      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        "updated_at"      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        UNIQUE ("code", "channel", "language")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_template_code_channel_lang" ON "notification"."notification_template" ("code", "channel", "language");
    `);

    // notification — delivery log
    await queryRunner.query(`
      CREATE TABLE "notification"."notification" (
        "id"               UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
        "recipient_id"     UUID         NOT NULL,
        "recipient_email"  VARCHAR(200),
        "recipient_phone"  VARCHAR(20),
        "channel"          VARCHAR(10)  NOT NULL,
        "template_code"    VARCHAR(100) NOT NULL,
        "language"         VARCHAR(10)  NOT NULL DEFAULT 'fr-MA',
        "subject"          VARCHAR(300),
        "body"             TEXT         NOT NULL,
        "context_data"     JSONB        NOT NULL DEFAULT '{}',
        "status"           VARCHAR(10)  NOT NULL DEFAULT 'pending',
        "error_message"    TEXT,
        "sent_at"          TIMESTAMPTZ,
        "correlation_id"   UUID,
        "trigger_event_id" UUID,
        "created_at"       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_notification_recipient_id"    ON "notification"."notification" ("recipient_id");
      CREATE INDEX "idx_notification_status"          ON "notification"."notification" ("status");
      CREATE INDEX "idx_notification_trigger_event"   ON "notification"."notification" ("trigger_event_id");
      CREATE INDEX "idx_notification_correlation_id"  ON "notification"."notification" ("correlation_id");
    `);

    // Seed default notification templates
    await queryRunner.query(`
      INSERT INTO "notification"."notification_template" ("code", "channel", "language", "subject_template", "body_template") VALUES
      ('certification_granted', 'email', 'fr-MA',
        'Certification {{certificationNumber}} accordée',
        '<p>Votre coopérative <strong>{{cooperativeName}}</strong> a obtenu la certification <strong>{{certificationNumber}}</strong>.</p><p>Valide du {{validFrom}} au {{validUntil}}.</p>'),
      ('certification_granted', 'email', 'ar-MA',
        'تم منح الشهادة {{certificationNumber}}',
        '<div dir="rtl"><p>حصلت تعاونيتكم <strong>{{cooperativeName}}</strong> على شهادة <strong>{{certificationNumber}}</strong>.</p><p>صالحة من {{validFrom}} إلى {{validUntil}}.</p></div>'),
      ('lab_test_completed', 'email', 'fr-MA',
        'Résultat d''analyse: {{#if passed}}CONFORME{{else}}NON CONFORME{{/if}}',
        '<p>L''analyse du lot <strong>{{batchNumber}}</strong> est terminée.</p>{{#if passed}}<p style="color:green">Résultat: CONFORME</p>{{else}}<p style="color:red">Résultat: NON CONFORME</p><p>Paramètres défaillants: {{failedParameters}}</p>{{/if}}'),
      ('inspection_scheduled', 'email', 'fr-MA',
        'Inspection planifiée le {{scheduledDate}}',
        '<p>Une inspection est planifiée pour votre coopérative <strong>{{cooperativeName}}</strong> le <strong>{{scheduledDate}}</strong>.</p><p>Inspecteur: {{inspectorName}}</p>')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "notification"."notification"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notification"."notification_template"`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS notification CASCADE`);
  }
}
