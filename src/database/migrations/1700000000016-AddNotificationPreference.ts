import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationPreference1700000000016 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE notification.notification_preference (
        user_id    UUID         PRIMARY KEY,
        channels   TEXT[]       NOT NULL DEFAULT '{email}',
        language   VARCHAR(5)   NOT NULL DEFAULT 'fr',
        updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS notification.notification_preference;`);
  }
}
